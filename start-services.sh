#!/bin/bash
# 代理池服务一键启动脚本（幂等，不会重复初始化）
# 使用方法: bash /workspace/start-services.sh
#
# 架构说明：
# - supervisord 是 PID 1（通过 tini 启动），环境重启后自动运行
# - 所有服务（PostgreSQL、API、前端、Nginx、本地代理）均由 supervisor 托管
# - autostart=true + autorestart=true，环境重启后自动恢复
# - 此脚本用于环境完全重置后的恢复，或手动重启服务

SUPERVISOR_CONF=/app/supervisord.conf
SUPCTL="supervisorctl -c ${SUPERVISOR_CONF}"

echo "=== 代理池服务启动脚本 ==="

# 1. 检查 supervisord 是否运行（PID 1）
echo "[1/5] 检查 supervisord..."
if pgrep -x supervisord > /dev/null 2>&1; then
    echo "  supervisord: 运行中"
else
    echo "  supervisord: 未运行（环境异常，无法恢复）"
    exit 1
fi

# 2. 检查 PostgreSQL 是否由 supervisor 管理
echo "[2/5] 检查 PostgreSQL..."
PG_STATUS=$(${SUPCTL} status proxy-app:pg-server 2>/dev/null)
if echo "${PG_STATUS}" | grep -q "RUNNING"; then
    echo "  PostgreSQL (supervisor): 运行中"
elif echo "${PG_STATUS}" | grep -qE "FATAL|BACKOFF|STOPPED"; then
    echo "  PostgreSQL (supervisor): ${PG_STATUS}，尝试重启..."
    ${SUPCTL} clear proxy-app:pg-server 2>/dev/null
    ${SUPCTL} start proxy-app:pg-server 2>/dev/null
    sleep 3
else
    echo "  PostgreSQL: 未纳入 supervisor 管理，检查系统 PostgreSQL..."
    if ! pg_isready -q 2>/dev/null; then
        pg_ctlcluster 16 main start 2>/dev/null || service postgresql start 2>/dev/null || true
        sleep 2
    fi
fi

# 确保 PostgreSQL 可连接
if pg_isready -q 2>/dev/null; then
    echo "  PostgreSQL: 可连接"
else
    echo "  PostgreSQL: 不可连接，等待重试..."
    sleep 5
    pg_isready -q 2>/dev/null && echo "  PostgreSQL: 已就绪" || echo "  PostgreSQL: 仍不可连接"
fi

# 3. 确保数据库存在（仅在不存在时创建）
echo "[3/5] 检查数据库..."
if ! PGPASSWORD=postgres psql -h localhost -U postgres -lqt 2>/dev/null | grep -q "proxydb"; then
    echo "  创建数据库 proxydb..."
    su - postgres -c "psql -c \"CREATE DATABASE proxydb;\"" 2>/dev/null
    su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD 'postgres';\"" 2>/dev/null
    echo "  数据库: 已创建"
else
    echo "  数据库: 已存在"
fi

# 4. 确保 schema 已初始化（仅在表不存在时执行，避免重复初始化）
echo "[4/5] 检查数据库表结构..."
if PGPASSWORD=postgres psql -h localhost -U postgres -d proxydb -c "\dt" 2>/dev/null | grep -q "proxies"; then
    echo "  表结构: 已存在，跳过初始化"
else
    echo "  表结构: 不存在，执行初始化..."
    cd /workspace/lib/db
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/proxydb pnpm push 2>&1 | tail -3
    cd /workspace
    echo "  表结构: 已初始化"
fi

# 5. 确保 supervisor 配置已注册并启动所有服务
echo "[5/5] 检查 supervisor 配置和服务..."
mkdir -p /var/log/supervisor
if grep -q "group:proxy-app" "${SUPERVISOR_CONF}" 2>/dev/null; then
    echo "  Supervisor 配置: 已注册"
else
    echo "  追加 proxy-app 服务组配置..."
    cat /workspace/supervisor-proxy-services.conf >> "${SUPERVISOR_CONF}"
    ${SUPCTL} reread 2>/dev/null
    ${SUPCTL} update 2>/dev/null
fi

# 确保所有服务启动
${SUPCTL} reread 2>/dev/null || true
${SUPCTL} update 2>/dev/null || true
${SUPCTL} start proxy-app:* 2>/dev/null || true

sleep 5

# 检查状态
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
echo "所有服务由 supervisor 托管，自动重启"
echo "supervisord 是 PID 1，环境重启后自动恢复所有服务"
echo ""
echo "常用命令："
echo "  查看状态: supervisorctl -c /app/supervisord.conf status"
echo "  重启服务: supervisorctl -c /app/supervisord.conf restart proxy-app:*"
echo "  停止服务: supervisorctl -c /app/supervisord.conf stop proxy-app:*"
echo "  查看日志: tail -f /var/log/supervisor/api-server.out.log"
