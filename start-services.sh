#!/bin/bash
# 代理池服务一键启动脚本（完整恢复 v2）
# 使用方法: bash /workspace/start-services.sh

SUPERVISOR_CONF=/app/supervisord.conf
SUPCTL="supervisorctl -c ${SUPERVISOR_CONF}"

echo "=== 代理池服务启动脚本 ==="

# 0. 安装系统依赖
echo "[0/5] 检查系统依赖..."
if ! command -v nginx &> /dev/null || ! command -v psql &> /dev/null; then
    echo "  安装 PostgreSQL 和 Nginx..."
    apt-get update -qq 2>/dev/null | tail -1
    DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib nginx -qq 2>/dev/null | tail -3
    if ! command -v nginx &> /dev/null || ! command -v psql &> /dev/null; then
        echo "  安装失败，退出"
        exit 1
    fi
    echo "  安装完成"
else
    echo "  已安装"
fi

# 1. 安装项目依赖
echo "[1/5] 检查项目依赖..."
if [ ! -d /workspace/node_modules ]; then
    echo "  安装 pnpm 依赖..."
    cd /workspace && pnpm install -q 2>&1 | tail -3
    echo "  安装完成"
else
    echo "  已安装"
fi

# 2. 确保 PostgreSQL 数据目录和配置
echo "[2/5] 准备 PostgreSQL..."
chown -R postgres:postgres /var/lib/postgresql/16/main 2>/dev/null || true
chmod 700 /var/lib/postgresql/16/main 2>/dev/null || true

# 启动 PostgreSQL（使用系统服务）
echo "  启动 PostgreSQL..."
pg_ctlcluster 16 main start 2>/dev/null || service postgresql start 2>/dev/null || true
sleep 3

if ! pg_isready -q 2>/dev/null; then
    echo "  PostgreSQL 启动失败，尝试手动启动..."
    su - postgres -c "/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main" &
    sleep 4
fi

if pg_isready -q 2>/dev/null; then
    echo "  PostgreSQL: 运行中"
else
    echo "  PostgreSQL: 启动失败，退出"
    exit 1
fi

# 创建数据库（如果不存在）
if ! PGPASSWORD=postgres psql -h localhost -U postgres -lqt 2>/dev/null | grep -q "proxydb"; then
    echo "  创建数据库 proxydb..."
    su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD 'postgres';\"" 2>/dev/null
    su - postgres -c "psql -c \"CREATE DATABASE proxydb;\"" 2>/dev/null
    echo "  数据库: 已创建"
else
    echo "  数据库: 已存在"
fi

# 初始化表结构（如果不存在）
if ! PGPASSWORD=postgres psql -h localhost -U postgres -d proxydb -c "\dt" 2>/dev/null | grep -q "proxies"; then
    echo "  初始化表结构..."
    cd /workspace/lib/db
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/proxydb pnpm push 2>&1 | tail -2
    cd /workspace
    echo "  表结构: 已初始化"
else
    echo "  表结构: 已存在"
fi

# 3. 注册 supervisor 配置
echo "[3/5] 检查 supervisor 配置..."
mkdir -p /var/log/supervisor

# 先停止系统管理的 pg（将由 supervisor 管理）
pg_ctlcluster 16 main stop 2>/dev/null || true
pkill -f "postgres -D /var/lib/postgresql/16/main" 2>/dev/null || true
sleep 2

# 检查 supervisor 配置
if grep -q "group:proxy-app" "${SUPERVISOR_CONF}" 2>/dev/null; then
    echo "  配置已注册"
else
    echo "  追加 proxy-app 配置..."
    cat /workspace/supervisor-proxy-services.conf >> "${SUPERVISOR_CONF}"
    ${SUPCTL} reread 2>/dev/null
    ${SUPCTL} update 2>/dev/null
    echo "  配置已追加"
fi

# 4. 启动所有服务
echo "[4/5] 启动应用服务..."
${SUPCTL} reread 2>/dev/null || true
${SUPCTL} update 2>/dev/null || true

# 清除可能的 BACKOFF 状态并重新启动
${SUPCTL} clear proxy-app:* 2>/dev/null || true
${SUPCTL} restart proxy-app:* 2>/dev/null || true

sleep 8

# 5. 恢复代理
echo "[5/5] 检查代理恢复..."
PROXY_COUNT=$(curl -s http://localhost:8080/api/proxies 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['stats']['total'])" 2>/dev/null || echo "0")
if [ "${PROXY_COUNT}" = "0" ] && [ -f /workspace/proxies-backup.txt ]; then
    echo "  从备份恢复代理..."
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
    curl -s -X POST http://localhost:8080/api/proxies/check-all \
        -H "Content-Type: application/json" \
        -d '{"testUrl": "http://ip-api.com/json"}' > /dev/null 2>&1
    echo "  已恢复并检测"
elif [ "${PROXY_COUNT}" != "0" ]; then
    echo "  代理池已有 ${PROXY_COUNT} 个代理"
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
