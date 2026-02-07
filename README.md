# Project NightToken (B2B 酒店房晚通证试点)

基于区块链的 B2B 酒店分销原型系统，支持房晚资产代币化及基于托管合约的离线支付结算。

## 1. 项目概览
该项目旨在通过区块链技术将酒店未来房晚资源转化为可交易的数字资产（ERC-1155），并为旅行社提供灵活的预订与转售方案。

### 核心架构
* **Smart Contracts**: 包含 `RoomNightToken.sol` (资产合约) 与 `TokenEscrow.sol` (B2B 交易托管合约)。
* **Backend (Node.js)**: 提供用户认证 (JWT) 和管理员铸币接口。
* **Listener**: 实时监听区块链事件并同步数据至 PostgreSQL 数据库。
* **Frontend**: 响应式 Web 界面，支持中/英双语，集成 MetaMask 钱包。

## 2. 快速上手

### 环境要求
* **Docker & Docker Compose**: 用于容器化部署。
* **Node.js (v18+)**: 用于本地开发与测试。
* **MetaMask**: 需配置 **Polygon Mumbai Testnet** 并领取测试币。

### 初始设置
1.  **克隆代码**:
    ```bash
    git clone git@github.com:hospitality923/night-token.git
    cd night-token
    ```
2.  **配置环境变量**:
    ```bash
    cp .env.example .env
    # 编辑 .env 文件，填入您的合约地址、Alchemy API Key 及私钥
    ```
3.  **安装依赖**:
    ```bash
    cd smart-contracts && npm install
    cd ../backend && npm install
    ```

## 3. 部署与运行

### 智能合约部署
```bash
cd smart-contracts
npx hardhat run scripts/deploy.js --network mumbai
```

### 启动全栈应用 (Docker)
在项目根目录下执行：
```bash
docker-compose up --build -d
```

## 4. 安全说明
* 服务器私钥通过阿里云 KMS (Key Management Service) 进行保护，严禁明文存储在代码库中。
* .env 文件已被 git 忽略，请确保不要将其上传至任何公共仓库。
