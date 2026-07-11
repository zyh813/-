#!/bin/bash
# 代理池服务一键启动脚本（完整恢复）
# 使用方法: bash /workspace/start-services.sh
#
# 注意：TRAE Work CN 使用服务端沙箱，关闭应用后系统环境会重置
# 此脚本会自动检测并安装缺失的依赖，完整恢复所有服务

SUPERVISOR_CONF=/app/supervisord.conf
SUPCTL="supervisorctl -c ${SUPERVISOR_CONF}"

echo "=== 代理池服务启动脚本 ==="

# 0. 安装系统依赖（如果缺失）
echo "[0/6] 检查系统依赖..."
if ! command -v nginx &> /dev/null || ! command -v psql &> /dev/null; then
    echo "  检测到系统依赖缺失，正在安装 PostgreSQL 和 Nginx..."
    apt-get update -qq 2>/dev/null | tail -1
    DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib nginx -qq 2>/dev/null | tail -3
    if command -v nginx &> /dev/null && command -v psql &> /dev/null; then
        echo "  系统依赖安装完成"
    else
        echo "  系统依赖安装失败，退出"
        exit 1
    fi
else
    echo "  系统依赖已安装"
fi

# 1. 安装 pnpm 依赖（如果缺失）
echo "[1/6] 检查项目依赖..."
if [ ! -d /workspace/node_modules ]; then
    echo "  node_modules 缺失，正在安装..."
    cd /workspace && pnpm install -q 2>&1 | tail -3
    echo "  项目依赖安装完成"
else
    echo "  项目依赖已安装"
fi

# 2. 启动 PostgreSQL 并初始化数据库
echo "[2/6] 检查 PostgreSQL..."
# 停止系统管理的 pg，准备由 supervisor 管理
pg_ctlcluster 16 main stop 2>/dev/null || true
sleep 1

# 创建数据目录（如果缺失）
if [ ! -d /var/lib/postgresql/16/main ]; then
    mkdir -p /var/lib/postgresql/16/main
    chown -R postgres:postgres /var/lib/postgresql
    chmod 700 /var/lib/postgresql/16/main
    # 初始化数据库
    su - postgres -c "/usr/lib/postgresql/16/bin/initdb -D /var/lib/postgresql/16/main" 2>/dev/null || true
    # 设置信任连接
    echo "local all all trust" > /var/lib/postgresql/16/main/pg_hba.conf
    echo "host all all 127.0.0.1/32 trust" >> /var/lib/postgresql/16/main/pg_hba.conf
    echo "listen_addresses = 'localhost'" >> /var/lib/postgresql/16/main/postgresql.conf
fi

# 确保数据目录权限正确
chown -R postgres:postgres /var/lib/postgresql/16/main
chmod 700 /var/lib/postgresql/16/main

# 确保数据库存在
if ! PGPASSWORD=postgres psql -h localhost -U postgres -lqt 2>/dev/null | grep -q "proxydb"; then
    echo "  创建数据库 proxydb..."
    # 临时启动 pg 来创建数据库
    su - postgres -c "/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main -c config_file=/etc/postgresql/16/main/postgresql.conf" &
    sleep 3
    su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD 'postgres';\"" 2>/dev/null
    su - postgres -c "psql -c \"CREATE DATABASE proxydb;\"" 2>/dev/null
    # 停止临时 pg
    kill %1 2>/dev/null || true
    sleep 1
    echo "  数据库: 已创建"
else
    echo "  数据库: 已存在"
fi

# 3. 初始化表结构（如果缺失）
echo "[3/6] 检查数据库表结构..."
# 临时启动 pg 来检查/创建表
su - postgres -c "/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main -c config_file=/etc/postgresql/16/main/postgresql.conf" &
sleep 3

if PGPASSWORD=postgres psql -h localhost -U postgres -d proxydb -c "\dt" 2>/dev/null | grep -q "proxies"; then
    echo "  表结构: 已存在，跳过初始化"
else
    echo "  表结构: 不存在，执行初始化..."
    cd /workspace/lib/db
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/proxydb pnpm push 2>&1 | tail -2
    cd /workspace
    echo "  表结构: 已初始化"
fi

# 停止临时 pg（将由 supervisor 管理）
kill %1 2>/dev/null || true
sleep 1

# 4. 注册 supervisor 配置
echo "[4/6] 检查 supervisor 配置..."
mkdir -p /var/log/supervisor
if grep -q "group:proxy-app" "${SUPERVISOR_CONF}" 2>/dev/null; then
    echo "  Supervisor 配置: 已注册"
else
    echo "  追加 proxy-app 服务组配置..."
    cat /workspace/supervisor-proxy-services.conf >> "${SUPERVISOR_CONF}"
    ${SUPCTL} reread 2>/dev/null
    ${SUPCTL} update 2>/dev/null
    echo "  Supervisor 配置: 已追加"
fi

# 5. 启动所有服务
echo "[5/6] 启动应用服务..."
${SUPCTL} reread 2>/dev/null || true
${SUPCTL} update 2>/dev/null || true
${SUPCTL} start proxy-app:* 2>/dev/null || true

sleep 8

# 6. 恢复代理（如果代理池为空且有备份）
echo "[6/6] 检查代理恢复..."
PROXY_COUNT=$(curl -s http://localhost:8080/api/proxies 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['stats']['total'])" 2>/dev/null || echo "0")
if [ "${PROXY_COUNT}" = "0" ] && [ -f /workspace/proxies-backup.txt ]; then
    echo "  代理池为空，从备份恢复..."
    PROXIES_JSON=$(python3 -c "
lines = [l.strip() for l in open('/workspace/proxies-backup.txt') if l.strip()]
urls = []
for line in lines:
    parts = line.split(' ', 1)
    url = parts[0]
    label = parts[1] if len(parts) > 1 else ''
    urls.append({'url': url, 'label': label})
import json
print(json.dumps({'urls': urls}))
")
    curl -s -X POST http://localhost:8080/api/proxies \
        -H "Content-Type: application/json" \
        -d "${PROXIES_JSON}" > /dev/null 2>&1
    NEW_COUNT=$(curl -s http://localhost:8080/api/proxies 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['stats']['total'])" 2>/dev/null || echo "0")
    echo "  已恢复 ${NEW_COUNT} 个代理"
    curl -s -X POST http://localhost:8080/api/proxies/check-all \
        -H "Content-Type: application/json" \
        -d '{"testUrl": "http://ip-api.com/json"}' > /dev/null 2>&1
    echo "  已触发健康检测"
elif [ "${PROXY_COUNT}" != "0" ]; then
    echo "  代理池已有 ${PROXY_COUNT} 个代理，跳过恢复"
else
    echo "  未找到代理备份文件或代理池非空"
fi

# 状态汇总
echo ""
echo "=== 服务状态 ==="
${SUPCTL} status 2>/dev/null

echo ""
echo "=== 端口监听 ==="
ss -tlnp 2>/dev/null | grep -E ":(5432|8080|5173|24039|18888)" || echo "  无端口监听"

echo ""
echo "=== 健康检查 ==="
API_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/proxies 2>/dev/null)
NGINX_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:24039/ 2>/dev/null)
echo "  API (8080): ${API_CODE}"
echo "  Nginx (24039): ${NGINX_CODE}"

echo ""
echo "=== 启动完成 ==="
echo "下次关闭 TRAE 后，只需运行：bash /workspace/start-services.sh"
