const translations = {
  zh: {
    app_title: "酒店房晚 B2B 平台",
    connect_wallet: "连接钱包",
    wallet_connected: "已连接",
    wallet_label: "钱包地址:",
    auth_title: "登录 / 注册",
    login: "登录",
    register: "注册",
    role_hotel: "酒店方",
    role_ta: "旅行社",

    ph_email: "电子邮箱",
    ph_password: "密码",
    ph_hotel_code: "酒店代码 (例如: GRAND)",
    ph_room_name: "房型名称 (例如: 豪华套房)",
    ph_token_id: "房晚 ID (例如: 1)",
    ph_quantity: "数量",
    ph_wallet_addr_label: "接收方钱包地址 (当前连接钱包)",
    ph_buyer_addr: "买家钱包地址 (0x...)",
    ph_guest_name: "客人姓名 / 详情",

    hotel_panel: "酒店管理后台",
    front_desk_title: "前台 (入住管理)",
    refresh_bookings: "刷新预订",
    create_room_title: "1. 定义新房型",
    create_room_btn: "创建房型 (上链)",
    mint_title: "2. 铸造库存",
    mint: "铸造房晚",
    
    trade_title: "3. B2B 交易 (托管)",
    create_sale_title: "创建新交易 (存入托管)",
    create_sale_btn: "创建托管交易",
    my_trades_title: "我的交易 / 托管",
    refresh_trades: "刷新",
    btn_confirm_pay: "确认收款 (释放)",
    btn_cancel: "取消",
    btn_view_tx: "查看交易",
    status_pending: "待付款",
    status_released: "已完成",
    status_cancelled: "已取消",
    sale_created: "交易已创建! 房晚已锁定。",

    inventory_title: "4. 现有库存 (链上数据)",
    check_inventory_btn: "刷新库存",
    view_contract_btn: "查看合约 (Polygonscan)",
    no_data: "暂无数据",
    loading: "加载中...",

    ta_panel: "预订房间",
    my_reservations_title: "我的预订",
    redeem: "预订房间 (存入托管)",
    avail: "日期可用",
    unavail: "日期不可用",
    error: "错误",
    
    creating: "正在创建...",
    minting: "正在铸造...",
    success_create: "成功! 新房型已创建。",
    success_mint: "成功! 房晚已铸造。",
    view_on_chain: "查看链上记录",
    tx_sent: "交易已发送",
    redeem_success: "预订成功! 等待入住。",
    
    btn_check_in: "确认入住 (核销)",
    btn_cancel_booking: "取消预订 (退款)",
    status_active: "已预订 (待入住)",
    status_completed: "已入住 (核销)",
    status_booking_cancelled: "已取消"
  },
  en: {
    app_title: "NightToken B2B",
    connect_wallet: "Connect Wallet",
    wallet_connected: "Connected",
    wallet_label: "Wallet Address:",
    auth_title: "Login / Register",
    login: "Login",
    register: "Register",
    role_hotel: "Hotel",
    role_ta: "Travel Agent",

    ph_email: "Email",
    ph_password: "Password",
    ph_hotel_code: "Hotel Code (e.g. GRAND)",
    ph_room_name: "Room Name (e.g. Deluxe Suite)",
    ph_token_id: "Token ID (e.g., 1)",
    ph_quantity: "Qty",
    ph_wallet_addr_label: "To Wallet Address (Current Wallet)",
    ph_buyer_addr: "Buyer Wallet Address (0x...)",
    ph_guest_name: "Guest Name / Details",

    hotel_panel: "Hotel Admin",
    front_desk_title: "Front Desk (Check-in)",
    refresh_bookings: "Refresh Bookings",
    create_room_title: "1. Define New Room Type",
    create_room_btn: "Create Room Type",
    mint_title: "2. Mint Inventory",
    mint: "Mint Tokens",
    
    trade_title: "3. B2B Trading (Escrow)",
    create_sale_title: "Create New Sale (Escrow)",
    create_sale_btn: "Create Escrow Sale",
    my_trades_title: "My Trades / Escrows",
    refresh_trades: "Refresh",
    btn_confirm_pay: "Confirm Pay (Release)",
    btn_cancel: "Cancel",
    btn_view_tx: "View Tx",
    status_pending: "Pending Payment",
    status_released: "Released",
    status_cancelled: "Cancelled",
    sale_created: "Sale Created! Tokens locked.",

    inventory_title: "4. Existing Inventory (On-Chain)",
    check_inventory_btn: "Refresh Inventory",
    view_contract_btn: "View Contract (Polygonscan)",
    no_data: "No data loaded",
    loading: "Loading...",

    ta_panel: "Book Room",
    my_reservations_title: "My Reservations",
    redeem: "Book Room (Escrow)",
    avail: "Available",
    unavail: "Unavailable",
    error: "Error",

    creating: "Creating...",
    minting: "Minting...",
    success_create: "Success! New Token ID Created.",
    success_mint: "Success! Tokens Minted.",
    view_on_chain: "View on Blockchain",
    tx_sent: "Tx Sent",
    redeem_success: "Booked! Status: Active",
    
    btn_check_in: "Check In (Burn)",
    btn_cancel_booking: "Cancel (Refund)",
    status_active: "Booked (Active)",
    status_completed: "Checked In (Burned)",
    status_booking_cancelled: "Cancelled"
  }
};

function _(key) {
  const lang = document.documentElement.lang || 'en';
  return translations[lang][key] || key;
}

function updateLanguage(lang) {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerText = _(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.setAttribute('placeholder', _(key));
    });
}

const switcher = document.getElementById('langSwitcher');
if(switcher) {
    switcher.onchange = (e) => updateLanguage(e.target.value);
}
