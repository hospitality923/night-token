// 1. Initial State
const API_URL = window.location.origin;
const EXPLORER_URL = "https://amoy.polygonscan.com/tx/";
const TOKEN_CONTRACT_URL = "https://amoy.polygonscan.com/token/0xb7844D97c40DDd2AF0e1dec3aFf336141E287629?a=";
let token = localStorage.getItem('token');
let currentUser = null;
let myCharts = {}; 
let platformInventory = []; 

try {
    const storedUser = localStorage.getItem('user');
    if (storedUser) currentUser = JSON.parse(storedUser);
} catch (e) { console.error(e); localStorage.clear(); }

// --- UI HELPERS ---
function toggleBtn(id, loading, loadText = "处理中...") {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (loading) {
        btn.dataset.originalText = btn.innerText;
        btn.innerText = loadText;
        btn.disabled = true;
    } else {
        btn.innerText = btn.dataset.originalText || "提交";
        btn.disabled = false;
    }
}

function handleAuthError(res) {
    if (res.status === 401 || res.status === 403) {
        alert("会话已过期，请重新登录");
        logout();
        return true;
    }
    return false;
}

function log(msg, txHash = null) {
    const box = document.getElementById('logs');
    if (!box) return;
    box.classList.remove('hidden');
    const div = document.createElement('div');
    let html = "> " + msg;
    if (txHash) html += ` <a href="${EXPLORER_URL}${txHash}" target="_blank" style="color:#68d391;">[查看交易]</a>`;
    div.innerHTML = html;
    box.prepend(div);
}

// --- CALCULATION & RESET ---
function calculateCost() {
    const tokenId = document.getElementById('ta_book_id').value;
    const inDate = document.getElementById('ta_book_checkin').value;
    const outDate = document.getElementById('ta_book_checkout').value;
    const rooms = document.getElementById('ta_book_rooms').value;
    const res = document.getElementById('calcResult');
    
    if(inDate && outDate && rooms) {
        if (tokenId && platformInventory.length > 0) {
            const item = platformInventory.find(i => i.token_id == tokenId);
            if (item && item.blackout_dates) {
                const [bStart, bEnd] = item.blackout_dates.split(' 至 ');
                if (bStart && bEnd) {
                    const bs = new Date(bStart);
                    const be = new Date(bEnd);
                    const ci = new Date(inDate);
                    const co = new Date(outDate);
                    if (ci <= be && co > bs) {
                        res.innerText = `⚠️ 预订限制: 包含不适用日期 (${item.blackout_dates})`;
                        res.style.color = "red";
                        return; 
                    }
                }
            }
        }

        const start = new Date(inDate);
        const end = new Date(outDate);
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)); 
        if(diffDays > 0) {
            const total = diffDays * rooms;
            res.innerText = `预计消耗: ${total} Token (${diffDays}晚 x ${rooms}间)`;
            res.style.color = "#2b6cb0"; 
            return;
        }
    }
    res.innerText = "预计消耗: 0 Token";
    res.style.color = "#2b6cb0";
}

async function resetSystem() {
    if (!confirm("⚠️ 严重警告 ⚠️\n\n确定要清空所有数据吗？\n这将删除所有用户、库存和交易记录，且无法恢复！")) return;
    const code = prompt("请输入 'RESET' 以确认重置操作:");
    if (code !== 'RESET') return alert("操作已取消");

    toggleBtn('btn_reset', true, "正在重置...");
    log("正在重置系统...");
    try {
        const res = await fetch(`${API_URL}/admin/reset`, {
            method: 'POST', headers: {'Authorization': token}
        });
        if(handleAuthError(res)) return;
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        alert("系统已重置成功！即将退出登录。");
        logout();
    } catch(e) { 
        alert("Reset Failed: " + e.message); 
    } finally {
        toggleBtn('btn_reset', false);
    }
}

// --- AUTH ---
async function login() {
    toggleBtn('btn_login', true, "登录中...");
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        token = data.token; currentUser = data.user;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(currentUser));
        setupDashboard();
    } catch(e) { alert(e.message); }
    finally { toggleBtn('btn_login', false); }
}

function logout() { localStorage.clear(); location.reload(); }

function setupDashboard() {
    if (!currentUser) return logout();
    document.getElementById('authView').classList.add('hidden');
    document.getElementById('userInfo').classList.remove('hidden');
    document.getElementById('userEmail').innerText = currentUser.email;
    document.getElementById('userAddr').innerText = currentUser.wallet_address || "";
    
    let roleName = currentUser.role === 'hotel' ? "酒店方" : (currentUser.role === 'ta' ? "旅行社" : "平台管理方");
    document.getElementById('userRole').innerText = roleName;

    document.getElementById('hotelView').classList.add('hidden');
    document.getElementById('taView').classList.add('hidden');
    document.getElementById('adminView').classList.add('hidden');

    if(currentUser.role === 'hotel') document.getElementById('hotelView').classList.remove('hidden');
    else if (currentUser.role === 'ta') {
        document.getElementById('taView').classList.remove('hidden');
        document.getElementById('ta_book_id').oninput = calculateCost;
    }
    else if (currentUser.role === 'admin') document.getElementById('adminView').classList.remove('hidden');
    refreshState();
}

async function refreshState() {
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/api/state`, { headers: {'Authorization': token} });
        if(handleAuthError(res)) return;
        const { trades, bookings, inventory, stats } = await res.json();
        
        platformInventory = inventory || [];
        
        if (currentUser.role === 'admin') {
            renderHotelInventory(inventory || [], trades || [], bookings || [], 'adminInventoryList');
            renderTrades(trades || []);
            loadAdminUsers();
        } else if (currentUser.role === 'hotel') {
            renderHotelInventory(inventory || [], trades || [], bookings || [], 'hotelInventoryList');
            renderTrades(trades || []);
            renderBookings(bookings || []);
        } else if (currentUser.role === 'ta') {
            renderTAInventory(inventory || [], trades || [], bookings || []);
            renderTrades(trades || []);
            renderBookings(bookings || []);
        }
        renderDashboardCharts(inventory || [], trades || [], bookings || [], stats || {});
    } catch(e) { console.error(e); }
}

// --- DASHBOARD RENDERING LOGIC ---
function renderDashboardCharts(inventory, trades, bookings, stats) {
    if (currentUser.role === 'admin') {
        const totalTokens = inventory.reduce((sum, i) => sum + parseInt(i.total_supply), 0);
        const totalSold = trades.filter(t => t.status === 'RELEASED' || t.status === 'LOCKED').reduce((sum, t) => sum + parseInt(t.amount), 0);
        const totalRedeemed = bookings.filter(b => b.status === 'COMPLETED').reduce((sum, b) => sum + parseInt(b.amount || 1), 0);
        
        document.getElementById('adminStats').innerHTML = `
            <div class="stat-box blue"><div class="title">总用户数</div><div class="num">${stats.totalUsers || 0}</div></div>
            <div class="stat-box purple"><div class="title">总产品数</div><div class="num">${inventory.length}</div></div>
            <div class="stat-box orange"><div class="title">总资产(Token)</div><div class="num">${totalTokens}</div></div>
            <div class="stat-box green"><div class="title">总交易流转量</div><div class="num">${totalSold}</div></div>
            <div class="stat-box blue"><div class="title">已完成核销数</div><div class="num">${totalRedeemed}</div></div>`;
        
        drawChart('adminChart1', 'pie', ['未流转库存', '已分销(TA持有)', '已核销使用'], 
            [Math.max(0, totalTokens - totalSold), Math.max(0, totalSold - totalRedeemed), totalRedeemed], '资产分布');
        drawChart('adminChart2', 'bar', ['流转交易', '核销请求'], [trades.length, bookings.length], '业务活跃度');

    } else if (currentUser.role === 'hotel') {
        const totalTokens = inventory.reduce((sum, i) => sum + parseInt(i.total_supply), 0);
        
        const mySold = trades.filter(t => t.seller === currentUser.email && t.status === 'RELEASED').reduce((sum, t) => sum + parseInt(t.amount), 0);
        const myLocked = trades.filter(t => t.seller === currentUser.email && t.status === 'LOCKED').reduce((sum, t) => sum + parseInt(t.amount), 0);
        const myRedeemed = bookings.filter(b => b.status === 'COMPLETED').reduce((sum, b) => sum + parseInt(b.amount || 1), 0);
        
        document.getElementById('hotelStats').innerHTML = `
            <div class="stat-box blue"><div class="title">产品类型</div><div class="num">${inventory.length}</div></div>
            <div class="stat-box purple"><div class="title">发行 Token</div><div class="num">${totalTokens}</div></div>
            <div class="stat-box orange"><div class="title">待确认/托管中</div><div class="num">${myLocked}</div></div>
            <div class="stat-box green"><div class="title">已成功分销</div><div class="num">${mySold}</div></div>`;
            
        drawChart('hotelChart', 'bar', ['发行量', '托管中', '已分销', '已核销'], [totalTokens, myLocked, mySold, myRedeemed], '资产漏斗');

    } else if (currentUser.role === 'ta') {
        let myHeld = 0; 
        let mySold = 0; 
        let myIncoming = 0; 
        let myOutgoing = 0; 

        trades.forEach(t => { 
            if (t.buyer === currentUser.email) {
                if (t.status === 'RELEASED') myHeld += parseInt(t.amount);
                if (t.status === 'LOCKED') myIncoming += parseInt(t.amount);
            }
            if (t.seller === currentUser.email) {
                if (t.status === 'RELEASED') mySold += parseInt(t.amount);
                if (t.status === 'LOCKED') myOutgoing += parseInt(t.amount);
            }
        });
        
        const myRedeemed = bookings.filter(b => b.guest === currentUser.email && b.status === 'COMPLETED').reduce((sum, b) => sum + parseInt(b.amount || 1), 0);
        const myPending = bookings.filter(b => b.guest === currentUser.email && b.status === 'PENDING_CHECKIN').reduce((sum, b) => sum + parseInt(b.amount || 1), 0);
        
        const remaining = Math.max(0, myHeld - mySold - myOutgoing - myRedeemed - myPending);

        document.getElementById('taStats').innerHTML = `
            <div class="stat-box purple"><div class="title">累计买入</div><div class="num">${myHeld}</div></div>
            <div class="stat-box blue"><div class="title">可用余额</div><div class="num">${remaining}</div></div>
            <div class="stat-box orange"><div class="title">待确认/锁定中</div><div class="num">${myIncoming + myOutgoing + myPending}</div></div>
            <div class="stat-box green"><div class="title">已转售/已核销</div><div class="num">${mySold + myRedeemed}</div></div>`;
            
        drawChart('taChart', 'doughnut', ['可用', '待确认/锁定', '已转售/核销'], [remaining, myIncoming + myOutgoing + myPending, mySold + myRedeemed], '资产持仓');
    }
}

function drawChart(canvasId, type, labels, data, title) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (myCharts[canvasId]) myCharts[canvasId].destroy();
    
    const bgColors = [
        'rgba(66, 153, 225, 0.85)', // Blue
        'rgba(237, 137, 54, 0.85)', // Orange
        'rgba(72, 187, 120, 0.85)', // Green
        'rgba(159, 122, 234, 0.85)' // Purple
    ];

    myCharts[canvasId] = new Chart(canvas.getContext('2d'), {
        type: type,
        data: { 
            labels: labels, 
            datasets: [{ 
                data: data, 
                backgroundColor: bgColors,
                borderRadius: type === 'bar' ? 6 : 0, 
                maxBarThickness: 60 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                title: { display: true, text: title, font: { size: 15, family: "'Segoe UI', sans-serif" } },
                legend: { display: type !== 'bar' } 
            },
            scales: type === 'bar' ? {
                y: { beginAtZero: true, grid: { borderDash: [4, 4], color: '#e2e8f0' } },
                x: { grid: { display: false } }
            } : {}
        }
    });
}

function renderHotelInventory(inventory, trades, bookings, targetId) {
    const tbody = document.getElementById(targetId);
    if (!tbody) return;
    tbody.innerHTML = inventory.map(item => {
        const sold = trades.filter(t => t.tokenId == item.token_id && (t.status === 'RELEASED' || t.status === 'LOCKED')).reduce((s, t) => s + parseInt(t.amount), 0);
        const used = bookings.filter(b => b.tokenId == item.token_id && b.status === 'COMPLETED').reduce((s, b) => s + parseInt(b.amount || 1), 0);
        const tokenLink = `<a href="${TOKEN_CONTRACT_URL}${item.token_id}" target="_blank" style="color:#3182ce; font-weight:bold; text-decoration:none;">${item.token_id} ↗</a>`;
        return `<tr><td>${tokenLink}</td><td>${item.room_name}</td><td>${item.total_supply}</td><td>${sold}</td><td>${used}</td></tr>`;
    }).join('');
}

function renderTAInventory(inventory, trades, bookings) {
    const tbody = document.getElementById('taInventoryList');
    if (!tbody) return;
    
    const holdings = {};
    
    trades.forEach(t => {
        if (t.buyer === currentUser.email && t.status === 'RELEASED') {
            holdings[t.tokenId] = (holdings[t.tokenId] || 0) + parseInt(t.amount);
        }
        if (t.seller === currentUser.email && (t.status === 'RELEASED' || t.status === 'LOCKED')) {
            holdings[t.tokenId] = (holdings[t.tokenId] || 0) - parseInt(t.amount);
        }
    });
    
    bookings.forEach(b => {
        if (b.guest === currentUser.email && (b.status === 'COMPLETED' || b.status === 'PENDING_CHECKIN')) {
            holdings[b.tokenId] = (holdings[b.tokenId] || 0) - parseInt(b.amount || 1);
        }
    });
    
    const displayTokens = Object.keys(holdings).filter(tid => holdings[tid] > 0);
    
    if (displayTokens.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">暂无可用的资产</td></tr>';
        return;
    }
    
    tbody.innerHTML = displayTokens.map(tid => {
        const item = inventory.find(i => i.token_id == tid);
        const redeemed = bookings.filter(b => b.guest === currentUser.email && b.tokenId == tid && (b.status === 'COMPLETED' || b.status === 'PENDING_CHECKIN')).reduce((s, b) => s + parseInt(b.amount || 1), 0);
        const tokenLink = `<a href="${TOKEN_CONTRACT_URL}${tid}" target="_blank" style="color:#3182ce; font-weight:bold; text-decoration:none;">${tid} ↗</a>`;
        const availableAmount = Math.max(0, holdings[tid]); 
        
        return `<tr><td>${tokenLink}</td><td>${item ? item.room_name : tid}</td><td style="font-weight:bold; color:#2b6cb0;">${availableAmount}</td><td><span class="badge">${redeemed}</span></td></tr>`;
    }).join('');
}

function renderTrades(trades) {
    let listId = currentUser.role === 'admin' ? 'adminTradeList' : (currentUser.role === 'hotel' ? 'hotelTradeList' : 'taTradeList');
    const tbody = document.getElementById(listId);
    if (!tbody) return;
    const relevant = currentUser.role === 'admin' ? trades : trades.filter(t => t.seller === currentUser.email || t.buyer === currentUser.email);
    
    if (relevant.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999;">无数据</td></tr>'; return; }
    
    tbody.innerHTML = relevant.map(t => {
        let action = '<span style="color:green">已完成</span>';
        if(t.status === 'LOCKED' && t.seller === currentUser.email) {
            action = `<button class="btn-green" style="padding:4px 8px; font-size:12px;" onclick="confirmPayment('${t.id}', this)">确认收款 (释放)</button>`;
        } else if (t.status === 'LOCKED') {
            action = '<span style="color:orange">待卖家确认</span>';
        }
        return `<tr><td>${t.id.slice(-4)}</td><td>${t.buyer}</td><td>${t.amount}</td><td><span class="badge">${t.status}</span></td><td>${action}</td></tr>`;
    }).join('');
}

function renderBookings(bookings) {
    let listId = currentUser.role === 'hotel' ? 'hotelBookingList' : 'taBookingList';
    const tbody = document.getElementById(listId);
    if (!tbody) return;
    const relevant = currentUser.role === 'hotel' ? bookings : bookings.filter(b => b.guest === currentUser.email);
    
    if (relevant.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#999;">无数据</td></tr>'; return; }
    
    tbody.innerHTML = relevant.map(b => {
        let action = b.status;
        if (currentUser.role === 'hotel' && b.status === 'PENDING_CHECKIN') {
            action = `<button class="btn-green" style="padding:2px 6px; font-size:11px;" onclick="confirmStay('${b.id}', this)">确认入住</button> <button class="btn-red" style="padding:2px 6px; font-size:11px;" onclick="cancelStay('${b.id}', this)">取消</button>`;
        } else {
            if(b.status === 'PENDING_CHECKIN') action = '<span style="color:orange">待酒店确认</span>';
            if(b.status === 'COMPLETED') action = '<span style="color:green">核销成功</span>';
            if(b.status === 'CANCELLED') action = '<span style="color:red">已退款</span>';
        }
        
        const dateRange = (b.checkIn && b.checkOut) ? `${b.checkIn} -> ${b.checkOut}` : b.date;
        const totalAmount = b.amount || 1;

        if (currentUser.role === 'hotel') {
            return `<tr><td>${b.id.slice(-4)}</td><td>${dateRange}</td><td>${totalAmount}</td><td>${b.guestName || b.guest}</td><td>${b.status}</td><td>${action}</td></tr>`;
        } else {
            return `<tr><td>${b.id.slice(-4)}</td><td>${dateRange}</td><td>${totalAmount} Token</td><td>${b.guestName || b.guest}</td><td>${action}</td></tr>`;
        }
    }).join('');
}

// 2. Admin Logic
async function adminCreateUser() {
    toggleBtn('btn_create_user', true, "新建中...");
    
    const email = document.getElementById('admin_new_user_email').value;
    const password = document.getElementById('admin_new_user_pwd').value;
    const role = document.getElementById('admin_new_user_role').value;
    
    try {
        const res = await fetch(`${API_URL}/admin/users`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ email, password, role })
        });
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        
        alert("用户创建成功！已自动注入 Gas。");
        
        document.getElementById('admin_new_user_email').value = '';
        document.getElementById('admin_new_user_pwd').value = '';
        
        refreshState();
    } catch(e) { 
        alert(e.message); 
    } finally { 
        toggleBtn('btn_create_user', false); 
    }
}

// ADDED: Dynamic action buttons for Edit and Delete
async function loadAdminUsers() {
    const tbody = document.getElementById('adminUserList');
    if (!tbody) return;
    try {
        const res = await fetch(`${API_URL}/admin/users`, { headers: {'Authorization': token} });
        const users = await res.json();
        tbody.innerHTML = users.map(u => {
            const actionBtns = `
                <button class="btn-orange" style="padding:4px 8px; font-size:11px; width:auto; margin-right:4px;" onclick="openEditUser('${u.id}', '${u.email}', '${u.role}')">编辑</button>
                <button class="btn-red" style="padding:4px 8px; font-size:11px; width:auto;" onclick="deleteUser('${u.id}', '${u.email}')">删除</button>
            `;
            return `<tr><td>${u.id}</td><td>${u.email}</td><td>${u.role}</td><td>${u.wallet_address.slice(0,10)}...</td><td>${actionBtns}</td></tr>`;
        }).join('');
    } catch(e) { console.error(e); }
}

// ADDED: User Update Functionality
function openEditUser(id, email, role) {
    document.getElementById('edit_user_id').value = id;
    document.getElementById('edit_user_email').value = email;
    document.getElementById('edit_user_pwd').value = '';
    document.getElementById('edit_user_role').value = role;
    document.getElementById('editUserModal').classList.remove('hidden');
}

async function submitEditUser() {
    toggleBtn('btn_update_user', true, "保存中...");
    const id = document.getElementById('edit_user_id').value;
    const email = document.getElementById('edit_user_email').value;
    const password = document.getElementById('edit_user_pwd').value;
    const role = document.getElementById('edit_user_role').value;
    
    try {
        const res = await fetch(`${API_URL}/admin/users/${id}`, {
            method: 'PUT', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ email, password, role })
        });
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        
        document.getElementById('editUserModal').classList.add('hidden');
        alert("用户信息更新成功！");
        refreshState();
    } catch(e) { 
        alert(e.message); 
    } finally { 
        toggleBtn('btn_update_user', false); 
    }
}

// ADDED: User Delete Functionality with extreme warnings
async function deleteUser(id, email) {
    if (!confirm(`⚠️ 严重警告 ⚠️\n\n确定要删除用户 ${email} 吗？\n此操作将永久删除该账号，其持有的所有 Token 资产将永久丢失且无法找回！`)) return;
    const code = prompt(`请输入 'DELETE' 以确认删除操作:`);
    if (code !== 'DELETE') return alert("操作已取消");

    log(`正在删除用户 ${email}...`);
    try {
        const res = await fetch(`${API_URL}/admin/users/${id}`, {
            method: 'DELETE', headers: {'Authorization': token}
        });
        if(handleAuthError(res)) return;
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        log(`已成功删除用户 ${email}`);
        refreshState();
    } catch(e) { alert(e.message); }
}

// 3. Asset Logic
async function createInventory() {
    toggleBtn('btn_create_inv', true, "正在发行...");
    
    const dateStart = document.getElementById('h_blackout_start').value;
    const dateEnd = document.getElementById('h_blackout_end').value;
    const blackoutStr = (dateStart && dateEnd) ? `${dateStart} 至 ${dateEnd}` : "";
    
    const body = {
        hotelId: document.getElementById('h_id').value,
        roomName: document.getElementById('h_name').value,
        totalSupply: document.getElementById('h_supply').value,
        publicCap: 0, 
        dayType: document.getElementById('h_dayType').value,
        blackoutDates: blackoutStr
    };
    try {
        const res = await fetch(`${API_URL}/admin/create-inventory`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        alert(`发行成功！凭证 ID: ${data.tokenId}`);
        refreshState();
    } catch(e) { alert(e.message); }
    finally { toggleBtn('btn_create_inv', false); }
}

async function createEscrow(type) {
    const btnId = type === 'hotel' ? 'btn_escrow_hotel' : 'btn_hw_trigger';
    if (type === 'hotel') toggleBtn(btnId, true, "正在处理...");
    
    const body = { 
        tokenId: document.getElementById(type === 'hotel' ? 'dist_id' : 'ta_sell_id').value, 
        buyerEmail: document.getElementById(type === 'hotel' ? 'dist_buyer' : 'ta_sell_buyer').value, 
        amount: document.getElementById(type === 'hotel' ? 'dist_amt' : 'ta_sell_amt').value 
    };
    
    try {
        const res = await fetch(`${API_URL}/api/escrow/create`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        
        log("托管发起成功！", data.txHash);
        
        document.getElementById(type === 'hotel' ? 'dist_id' : 'ta_sell_id').value = '';
        document.getElementById(type === 'hotel' ? 'dist_buyer' : 'ta_sell_buyer').value = '';
        document.getElementById(type === 'hotel' ? 'dist_amt' : 'ta_sell_amt').value = '';
        
        refreshState();
    } catch(e) { 
        alert(e.message); 
    } finally { 
        if (type === 'hotel') toggleBtn(btnId, false); 
    }
}

async function confirmPayment(tradeId, btn) {
    if(!confirm("确认已收到线下款项？")) return;
    btn.disabled = true; btn.innerText = "处理中...";
    log("确认收款中...");
    try {
        const res = await fetch(`${API_URL}/api/escrow/release`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ tradeId })
        });
        if(handleAuthError(res)) return;
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        log("资产已释放给买家。", data.txHash);
        refreshState();
    } catch(e) { alert(e.message); btn.disabled = false; btn.innerText = "确认收款 (释放)"; }
}

async function requestBooking() {
    const tokenId = document.getElementById('ta_book_id').value;
    const checkIn = document.getElementById('ta_book_checkin').value;
    const checkOut = document.getElementById('ta_book_checkout').value;
    
    if (tokenId && platformInventory.length > 0) {
        const item = platformInventory.find(i => i.token_id == tokenId);
        if (item && item.blackout_dates) {
            const [bStart, bEnd] = item.blackout_dates.split(' 至 ');
            if (bStart && bEnd) {
                const bs = new Date(bStart);
                const be = new Date(bEnd);
                const ci = new Date(checkIn);
                const co = new Date(checkOut);
                if (ci <= be && co > bs) {
                    alert(`系统拦截: 该凭证包含不适用日期 (Blackout Dates: ${item.blackout_dates})，无法预订。`);
                    return; 
                }
            }
        }
    }

    toggleBtn('btn_book', true, "提交中...");
    
    const body = {
        tokenId: tokenId,
        checkIn: checkIn,
        checkOut: checkOut,
        roomCount: document.getElementById('ta_book_rooms').value,
        guestName: document.getElementById('ta_book_guest').value
    };
    
    try {
        const res = await fetch(`${API_URL}/api/book/request`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        
        log("预订请求已提交！", data.txHash);
        
        document.getElementById('ta_book_id').value = '';
        document.getElementById('ta_book_guest').value = '';
        document.getElementById('calcResult').innerText = "预计消耗: 0 Token";
        
        refreshState();
    } catch(e) { alert(e.message); }
    finally { toggleBtn('btn_book', false); }
}

async function confirmStay(bookingId, btn) {
    btn.disabled = true; btn.innerText = "处理中...";
    log("确认入住 (销毁凭证)...");
    try {
        const res = await fetch(`${API_URL}/api/book/confirm`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ bookingId })
        });
        if(handleAuthError(res)) return;
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        log("核销完成！", data.txHash);
        refreshState();
    } catch(e) { alert(e.message); btn.disabled = false; btn.innerText = "确认入住"; }
}

async function cancelStay(bookingId, btn) {
    if(!confirm("确认取消此预订并退还资产？")) return;
    btn.disabled = true; btn.innerText = "退款中...";
    log("正在取消并退款...");
    try {
        const res = await fetch(`${API_URL}/api/book/cancel`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify({ bookingId })
        });
        if(handleAuthError(res)) return;
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        log("已取消预订，资产已退还。", data.txHash);
        refreshState();
    } catch(e) { alert(e.message); btn.disabled = false; btn.innerText = "取消"; }
}

function triggerHwCheck() {
    document.getElementById('hwModal').classList.remove('hidden');
}

function simulateHwSign() {
    const btn = document.getElementById('hwBtn');
    const status = document.getElementById('hwStatus');
    const progress = document.getElementById('hwProgress');
    
    btn.disabled = true;
    status.innerText = "正在读取并验证硬件签名...";
    status.style.color = "#ed8936"; 
    progress.style.width = "40%";
    
    setTimeout(() => {
        progress.style.width = "80%";
        
        setTimeout(() => {
            status.innerText = "签名验证成功！";
            status.style.color = "#48bb78"; 
            progress.style.width = "100%";
            
            setTimeout(() => {
                document.getElementById('hwModal').classList.add('hidden');
                
                btn.disabled = false;
                status.innerText = "请插入硬件密钥...";
                status.style.color = "#e53e3e"; 
                progress.style.width = "0%";
                
                createEscrow('ta');
            }, 600); 
        }, 800); 
    }, 600); 
}

// 3. Kickstart
if(token && currentUser) setupDashboard(); else if(token) logout();
