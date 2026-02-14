const API_URL = window.location.origin;
const EXPLORER_URL = "https://amoy.polygonscan.com/tx/";
let token = localStorage.getItem('token');
let currentUser = null;

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
    box.classList.remove('hidden');
    const div = document.createElement('div');
    let html = "> " + msg;
    if (txHash) html += ` <a href="${EXPLORER_URL}${txHash}" target="_blank" style="color:#68d391;">[查看交易]</a>`;
    div.innerHTML = html;
    box.prepend(div);
}

// --- BOOKING CALCULATION ---
function calculateCost() {
    const inDate = document.getElementById('ta_book_checkin').value;
    const outDate = document.getElementById('ta_book_checkout').value;
    const rooms = document.getElementById('ta_book_rooms').value;
    const res = document.getElementById('calcResult');
    
    if(inDate && outDate && rooms) {
        const start = new Date(inDate);
        const end = new Date(outDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        if(diffDays > 0) {
            const total = diffDays * rooms;
            res.innerText = `预计消耗: ${total} Token (${diffDays}晚 x ${rooms}间)`;
            return;
        }
    }
    res.innerText = "预计消耗: 0 Token";
}

// --- SYSTEM RESET ---
async function resetSystem() {
    if (!confirm("⚠️ 严重警告 ⚠️\n\n确定要清空所有数据吗？\n这将删除所有用户、库存和交易记录，且无法恢复！")) return;
    
    // Double check to be safe
    const code = prompt("请输入 'RESET' 以确认重置操作:");
    if (code !== 'RESET') return alert("操作已取消");

    log("正在重置系统...");
    try {
        const res = await fetch(`${API_URL}/admin/reset`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token}
        });
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        
        alert("系统已重置成功！即将退出登录。");
        logout();
    } catch(e) { alert("Reset Failed: " + e.message); }
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

async function register() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password, role })
        });
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        alert("注册成功！请直接登录。");
    } catch(e) { alert(e.message); }
}

function logout() { localStorage.clear(); location.reload(); }

function setupDashboard() {
    if (!currentUser) return logout();
    document.getElementById('authView').classList.add('hidden');
    document.getElementById('userInfo').classList.remove('hidden');
    document.getElementById('userEmail').innerText = currentUser.email;
    
    let roleName = "未知";
    if (currentUser.role === 'hotel') roleName = "酒店方";
    if (currentUser.role === 'ta') roleName = "旅行社";
    if (currentUser.role === 'admin') roleName = "平台管理方";
    document.getElementById('userRole').innerText = roleName;

    document.getElementById('userAddr').innerText = currentUser.wallet_address || "Loading...";
    
    // Hide all first
    document.getElementById('hotelView').classList.add('hidden');
    document.getElementById('taView').classList.add('hidden');
    document.getElementById('adminView').classList.add('hidden');

    // Show specific
    if(currentUser.role === 'hotel') {
        document.getElementById('hotelView').classList.remove('hidden');
    } else if (currentUser.role === 'ta') {
        document.getElementById('taView').classList.remove('hidden');
    } else if (currentUser.role === 'admin') {
        document.getElementById('adminView').classList.remove('hidden');
    }
    refreshState();
}

async function refreshState() {
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/api/state`, { headers: {'Authorization': token} });
        if(handleAuthError(res)) return;
        
        const { trades, bookings, inventory } = await res.json();
        
        if (currentUser.role === 'hotel') {
            renderHotelInventory(inventory || [], trades || [], bookings || []);
            renderTrades(trades || []);
            renderBookings(bookings || []);
        } else if (currentUser.role === 'ta') {
            renderTAInventory(inventory || [], trades || [], bookings || []);
            renderTrades(trades || []);
            renderBookings(bookings || []);
        } else if (currentUser.role === 'admin') {
            renderHotelInventory(inventory || [], trades || [], bookings || [], 'adminInventoryList');
            renderTrades(trades || []);
        }
    } catch(e) { console.error(e); }
}

function renderHotelInventory(inventory, trades, bookings, targetId = 'hotelInventoryList') {
    const tbody = document.getElementById(targetId);
    if (!tbody) return;
    tbody.innerHTML = '';
    
    inventory.forEach(item => {
        const soldCount = trades
            .filter(t => t.tokenId == item.token_id && t.status === 'RELEASED')
            .reduce((sum, t) => sum + parseInt(t.amount), 0);
            
        const redeemedCount = bookings
            .filter(b => b.tokenId == item.token_id && b.status === 'COMPLETED')
            .reduce((sum, b) => sum + parseInt(b.amount || 1), 0); // Sum amount not just count
            
        tbody.innerHTML += `
            <tr>
                <td>${item.token_id}</td>
                <td>${item.room_name}</td>
                <td>${item.total_supply}</td>
                <td><span class="badge" style="background:#e6fffa; color:#2c7a7b;">${soldCount}</span></td>
                <td><span class="badge" style="background:#fff5f5; color:#c53030;">${redeemedCount}</span></td>
            </tr>
        `;
    });
}

function renderTAInventory(inventory, trades, bookings) {
    const tbody = document.getElementById('taInventoryList');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const myHoldings = {};
    
    trades.forEach(t => {
        if (t.buyer === currentUser.email && t.status === 'RELEASED') {
            myHoldings[t.tokenId] = (myHoldings[t.tokenId] || 0) + parseInt(t.amount);
        }
    });

    if (Object.keys(myHoldings).length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">暂无资产</td></tr>';
        return;
    }

    Object.keys(myHoldings).forEach(tokenId => {
        const amountOwned = myHoldings[tokenId];
        
        // Count my redemptions (Sum of amounts, not just count of rows)
        const myRedeemed = bookings
            .filter(b => b.guest === currentUser.email && b.tokenId == tokenId && (b.status === 'COMPLETED' || b.status === 'PENDING_CHECKIN'))
            .reduce((sum, b) => sum + parseInt(b.amount || 1), 0);

        const item = inventory.find(i => i.token_id == tokenId);
        const name = item ? item.room_name : `Unknown (ID: ${tokenId})`;

        tbody.innerHTML += `
            <tr>
                <td>${tokenId}</td>
                <td>${name}</td>
                <td style="font-weight:bold; color:#2b6cb0;">${amountOwned}</td>
                <td><span class="badge">${myRedeemed}</span></td>
            </tr>
        `;
    });
}

function renderTrades(trades) {
    let listId = 'taTradeList';
    if (currentUser.role === 'hotel') listId = 'hotelTradeList';
    if (currentUser.role === 'admin') listId = 'adminTradeList';

    const tbody = document.getElementById(listId);
    if (!tbody) return;
    tbody.innerHTML = '';

    let relevantTrades = trades;
    if (currentUser.role !== 'admin') {
        relevantTrades = trades.filter(t => t.seller === currentUser.email || t.buyer === currentUser.email);
    }

    if (relevantTrades.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999;">无数据</td></tr>'; return; }
    
    relevantTrades.forEach(t => {
        let action = '<span style="color:green">已完成</span>';
        if(t.status === 'LOCKED' && t.seller === currentUser.email) {
            action = `<button class="btn-green" style="padding:4px 8px; font-size:12px;" onclick="confirmPayment('${t.id}', this)">确认收款 (释放)</button>`;
        } else if (t.status === 'LOCKED') {
            action = '<span style="color:orange">待卖家确认</span>';
        }
        tbody.innerHTML += `<tr><td>${t.id.slice(-4)}</td><td>${t.buyer}</td><td>${t.amount}</td><td><span class="badge">${t.status}</span></td><td>${action}</td></tr>`;
    });
}

function renderBookings(bookings) {
    const listId = currentUser.role === 'hotel' ? 'hotelBookingList' : 'taBookingList';
    const tbody = document.getElementById(listId);
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const relevantBookings = currentUser.role === 'hotel' ? bookings : bookings.filter(b => b.guest === currentUser.email);
    if (relevantBookings.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#999;">无数据</td></tr>'; return; }
    
    relevantBookings.forEach(b => {
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

        if (currentUser.role === 'hotel') tbody.innerHTML += `<tr><td>${b.id.slice(-4)}</td><td>${b.guestName}</td><td>${dateRange}</td><td>${b.status}</td><td>${action}</td></tr>`;
        else tbody.innerHTML += `<tr><td>${b.id.slice(-4)}</td><td>${dateRange}</td><td>${totalAmount} Token</td><td>${b.guestName}</td><td>${action}</td></tr>`;
    });
}

async function createInventory() {
    toggleBtn('btn_create_inv', true, "正在上链 (Minting)...");
    
    const h_id = document.getElementById('h_id').value;
    const h_name = document.getElementById('h_name').value;
    const h_supply = document.getElementById('h_supply').value;
    const dateStart = document.getElementById('h_blackout_start').value;
    const dateEnd = document.getElementById('h_blackout_end').value;
    const blackoutStr = (dateStart && dateEnd) ? `${dateStart} 至 ${dateEnd}` : "";

    if(!h_id || !h_name || !h_supply) { toggleBtn('btn_create_inv', false); return alert("请填写完整信息"); }

    const body = {
        hotelId: h_id, roomName: h_name, totalSupply: h_supply,
        publicCap: document.getElementById('h_cap').value,
        blackoutDates: blackoutStr, dayType: document.getElementById('h_dayType').value
    };
    log("正在发行黑盒资产...");
    try {
        const res = await fetch(`${API_URL}/admin/create-inventory`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify(body)
        });
        if(handleAuthError(res)) return;
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        
        log(`资产凭证发行成功! ID: ${data.tokenId}`);
        alert(`发行成功！凭证 ID: ${data.tokenId}`);
        refreshState(); 
    } catch(e) { alert(e.message); }
    finally { toggleBtn('btn_create_inv', false); }
}

async function createEscrow(type) {
    const btnId = type === 'hotel' ? 'btn_escrow_hotel' : 'btn_hw_trigger';
    if(type === 'hotel') toggleBtn(btnId, true, "正在发起...");

    const idElem = type==='hotel' ? 'dist_id' : 'ta_sell_id';
    const buyerElem = type==='hotel' ? 'dist_buyer' : 'ta_sell_buyer';
    const amtElem = type==='hotel' ? 'dist_amt' : 'ta_sell_amt';
    const tokenId = document.getElementById(idElem).value;
    const buyerEmail = document.getElementById(buyerElem).value;
    const amount = document.getElementById(amtElem).value;

    if(!tokenId || !buyerEmail || !amount) {
        if(type==='hotel') toggleBtn(btnId, false);
        return alert("请填写完整信息");
    }

    const body = { tokenId, buyerEmail, amount, buyerAddress: buyerEmail };
    log("正在发起托管...");
    try {
        const res = await fetch(`${API_URL}/api/escrow/create`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify(body)
        });
        if(handleAuthError(res)) return;
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        log("托管建立成功！资产已锁定。", data.txHash);
        refreshState();
    } catch(e) { alert(e.message); }
    finally { if(type==='hotel') toggleBtn(btnId, false); }
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

function triggerHwCheck() {
    const tokenId = document.getElementById('ta_sell_id').value;
    if(!tokenId) return alert("请填写凭证 ID");
    document.getElementById('hwModal').classList.remove('hidden');
    document.getElementById('hwStatus').innerText = "请插入硬件密钥...";
    document.getElementById('hwStatus').style.color = "#e53e3e";
    document.getElementById('hwProgress').style.width = "0%";
    document.getElementById('hwBtn').disabled = false;
}

function simulateHwSign() {
    document.getElementById('hwBtn').disabled = true;
    document.getElementById('hwStatus').innerText = "正在验证指纹...";
    document.getElementById('hwProgress').style.width = "50%";
    setTimeout(() => {
        document.getElementById('hwStatus').innerText = "签名成功！";
        document.getElementById('hwStatus').style.color = "green";
        document.getElementById('hwProgress').style.width = "100%";
        setTimeout(() => {
            document.getElementById('hwModal').classList.add('hidden');
            createEscrow('ta');
        }, 1000);
    }, 1500);
}

async function requestBooking() {
    toggleBtn('btn_book', true, "提交中...");
    const body = {
        tokenId: document.getElementById('ta_book_id').value,
        checkIn: document.getElementById('ta_book_checkin').value,
        checkOut: document.getElementById('ta_book_checkout').value,
        roomCount: document.getElementById('ta_book_rooms').value,
        guestName: document.getElementById('ta_book_guest').value
    };
    log("正在提交预订...");
    try {
        const res = await fetch(`${API_URL}/api/book/request`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': token},
            body: JSON.stringify(body)
        });
        if(handleAuthError(res)) return;
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        log("预订请求已上链 (待酒店确认)", data.txHash);
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

function updateLang() { alert("演示版 v3.2 默认使用中文界面"); }
if(token && currentUser) setupDashboard(); else if(token) logout();
