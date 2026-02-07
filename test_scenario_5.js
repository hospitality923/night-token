const { ethers } = require('ethers');
const API_URL = "http://localhost:4000";

// 创建两个模拟的旅行社钱包 (TA1, TA2)
const TA1 = ethers.Wallet.createRandom();
const TA2 = ethers.Wallet.createRandom();

// 辅助函数：模拟线下付款的等待时间
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log("🏨 启动场景 5：全流程托管交易演示 (B2B Pilot Demo)\n");
    console.log("🎭 参与角色:");
    console.log("   一级代理 (TA1):", TA1.address);
    console.log("   二级代理 (TA2):", TA2.address);

    try {
        // --- 登录管理员 (酒店方) ---
        console.log("\n🔑 正在登录酒店管理员账户...");
        const email = "admin_b2b_" + Date.now() + "@hotel.com";
        
        // 注册 & 登录
        await fetch(`${API_URL}/auth/register`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password: "pw", role: "hotel", wallet_address: "0x00" })
        });
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password: "pw" })
        });
        const { token } = await loginRes.json();


        // --- 第 0 步: 创建黑盒库存 ---
        console.log("\n0️⃣  正在创建‘黑盒’库存 (定义资产)...");
        const invRes = await fetch(`${API_URL}/admin/create-inventory`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ hotelId: "HTL-ESCROW", roomName: "Escrow Suite", totalSupply: 100, publicCap: 100 })
        });
        const invData = await invRes.json();
        const REAL_TOKEN_ID = invData.tokenId;
        console.log("   ✅ 资产凭证创建成功! ID:", REAL_TOKEN_ID);

        // 准备工作：酒店先给自己铸造20个，以便通过托管卖给别人
        console.log("   -> 酒店即时铸造 (JIT Mint) 20 个凭证到自己账户 (用于托管销售)...");
        await fetch(`${API_URL}/api/b2b/mint-to-self`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ tokenId: REAL_TOKEN_ID, amount: 20 })
        });


        // --- 第 1 步: 一级市场 (酒店 -> TA1 托管交易) ---
        console.log(`\n1️⃣  一级市场: 酒店向 TA1 出售 20 个房晚 (托管模式)...`);
        
        // A. 存入托管 (酒店操作)
        // 注意：在演示版中，管理员账户即为托管金库，因此资产已锁定。
        console.log("   [托管] 资产已锁定在智能合约中 (等待买家付款).");
        
        // B. 线下付款
        console.log("   ( 💸 模拟: TA1 正在进行线下银行转账... )");
        await wait(1000);
        
        // C. 释放资产 (酒店确认收款)
        console.log("   -> 酒店确认收到款项，释放资产给 TA1...");
        const rel1 = await fetch(`${API_URL}/api/escrow/release`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ 
                tradeId: "TRADE_1", // 模拟订单号
                buyerAddress: TA1.address, 
                tokenId: REAL_TOKEN_ID, 
                amount: 20,
                isRedemption: false 
            })
        });
        const d1 = await rel1.json();
        if(d1.error) throw new Error(d1.error);
        console.log("   ✅ 交易完成: TA1 收到 20 个房晚凭证。");
        console.log("      Tx Hash:", d1.txHash);


        // --- 第 2 步: 二级市场 (TA1 -> TA2 托管交易) ---
        console.log(`\n2️⃣  二级市场: TA1 转售 5 个房晚给 TA2 (托管模式)...`);
        
        // A. 存入托管 (TA1 操作)
        console.log("   -> TA1 将 5 个凭证存入托管合约...");
        const dep2 = await fetch(`${API_URL}/api/escrow/deposit`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                sellerPrivateKey: TA1.privateKey, // TA1 签名
                buyerAddress: TA2.address, 
                tokenId: REAL_TOKEN_ID, 
                amount: 5 
            })
        });
        const d2 = await dep2.json();
        if(d2.error) throw new Error(d2.error);
        const TRADE_ID_2 = d2.tradeId;
        console.log("   ✅ 资产已锁定。托管单号:", TRADE_ID_2);

        // B. 线下付款
        console.log("   ( 💸 模拟: TA2 正在付款... )");
        await wait(1000);

        // C. 释放资产 (TA1 确认收款)
        console.log("   -> TA1 确认收款，触发合约释放...");
        const rel2 = await fetch(`${API_URL}/api/escrow/release`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ 
                tradeId: TRADE_ID_2, 
                buyerAddress: TA2.address, 
                tokenId: REAL_TOKEN_ID, 
                amount: 5,
                isRedemption: false 
            })
        });
        const d3 = await rel2.json();
        if(d3.error) throw new Error(d3.error);
        console.log("   ✅ 交易完成: TA2 收到 5 个房晚凭证。");
        console.log("      Tx Hash:", d3.txHash);


        // --- 第 3 步: 房晚核销 (TA2 -> 预订入住) ---
        // 核销本质上也是一种托管流程：存入 -> 确认入住 -> 销毁
        console.log(`\n3️⃣  房晚核销: TA2 兑换 1 个房晚进行入住 (托管核销流程)...`);

        // A. 存入核销 (TA2 操作)
        console.log("   -> TA2 提交 1 个凭证用于核销...");
        const dep3 = await fetch(`${API_URL}/api/escrow/deposit`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                sellerPrivateKey: TA2.privateKey, 
                buyerAddress: "0x0000000000000000000000000000000000000000", // 销毁地址
                tokenId: REAL_TOKEN_ID, 
                amount: 1 
            })
        });
        const d4 = await dep3.json();
        if(d4.error) throw new Error(d4.error);
        const TRADE_ID_3 = d4.tradeId;
        console.log("   ✅ 凭证已锁定待核销。单号:", TRADE_ID_3);

        // B. 酒店服务确认
        console.log("   ( 🏨 客人办理入住... )");
        await wait(1000);

        // C. 确认销毁 (酒店确认入住 -> 销毁凭证)
        console.log("   -> 酒店确认客人入住，销毁 (Burn) 链上凭证...");
        const rel3 = await fetch(`${API_URL}/api/escrow/release`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ 
                tradeId: TRADE_ID_3, 
                buyerAddress: "0x00", 
                tokenId: REAL_TOKEN_ID, 
                amount: 1,
                isRedemption: true // 触发销毁逻辑
            })
        });
        const d5 = await rel3.json();
        if(d5.error) throw new Error(d5.error);
        console.log("   ✅ 凭证已销毁。预订闭环完成。");
        console.log("      Tx Hash:", d5.txHash);

        console.log("\n🎉 全流程托管交易演示成功 (Full Escrow Pilot Success)!");
        console.log("链上浏览器查询: https://amoy.polygonscan.com/");

    } catch (e) {
        console.error("\n❌ 测试失败:", e.message);
    }
}

main();
