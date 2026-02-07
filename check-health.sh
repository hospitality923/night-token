#!/bin/bash

# NightToken 试点项目 - 环境健康检查脚本
# 运行方式: bash check-health.sh

echo "=========================================="
echo "🔍 正在启动 NightToken 环境自检..."
echo "=========================================="

# 1. 检查 .env 文件
if [ ! -f .env ]; then
    echo "❌ 错误: 未发现 .env 文件。请先运行 'cp .env.example .env' 并配置。 "
    exit 1
else
    echo "✅ 发现 .env 配置文件。"
fi

# 2. 检查关键环境变量
source .env

# 检查私钥
if [[ $SERVER_PRIVATE_KEY == "your_private_key_here" ]] || [[ -z $SERVER_PRIVATE_KEY ]]; then
    echo "❌ 错误: SERVER_PRIVATE_KEY 未配置。请填入 MetaMask 导出的 64 位私钥。"
else
    if [[ ${#SERVER_PRIVATE_KEY} -ge 64 ]]; then
        echo "✅ SERVER_PRIVATE_KEY 格式检查通过。"
    else
        echo "⚠️  警告: SERVER_PRIVATE_KEY 长度似乎不足 64 位，请核对。"
    fi
fi

# 检查 Alchemy WSS 地址
if [[ $ALCHEMY_API_URL != wss://* ]]; then
    echo "❌ 错误: ALCHEMY_API_URL 必须以 wss:// 开头 (WebSocket 协议)。"
else
    echo "✅ ALCHEMY_API_URL 格式正确 (WSS)。"
fi

# 3. 检查 Docker 安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: 未安装 Docker。请先安装 Docker 以进行全栈部署。"
else
    echo "✅ Docker 已安装。"
fi

if ! command -v docker-compose &> /dev/null; then
    echo "⚠️  警告: 未发现 docker-compose 命令。请确保安装了 Docker Compose V2。"
else
    echo "✅ Docker Compose 已安装。"
fi

# 4. 检查本地端口占用
echo "正在检查端口占用..."
if lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ 错误: 5432 端口 (数据库) 已被占用。请关闭本地 PostgreSQL 进程。"
else
    echo "✅ 5432 端口可用。"
fi

if lsof -Pi :80 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  警告: 80 端口 (前端) 已被占用。如冲突，请修改 docker-compose.yml 端口映射。"
else
    echo "✅ 80 端口可用。"
fi

# 5. 检查本地依赖 (Optional)
if [ ! -d "smart-contracts/node_modules" ]; then
    echo "⚠️  提示: smart-contracts 目录下缺少 node_modules，请运行 'npm install'。"
fi

echo "=========================================="
echo "🎉 自检完成！"
echo "如果以上检查均为 ✅，请运行 'docker-compose up --build -d' 启动项目。"
echo "=========================================="
