// app.js — Logic chính: điều hướng, hiển thị, xử lý sự kiện

// ===== CẤU HÌNH DANH MỤC =====
const CATEGORIES = {
  food:          { label: 'Ăn uống',   icon: '🍜' },
  transport:     { label: 'Di chuyển', icon: '🛵' },
  shopping:      { label: 'Mua sắm',   icon: '🛍️' },
  entertainment: { label: 'Giải trí',  icon: '🎮' },
  other:         { label: 'Khác',      icon: '📦' },
};

// ===== ĐỊNH DẠNG TIỀN VNĐ =====
// VD: 35000 → "35.000 ₫"
function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND'
  }).format(amount);
}

// ===== ĐỊNH DẠNG NGÀY =====
function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('vi-VN', {
    weekday: 'short', day: '2-digit', month: '2-digit'
  });
}

function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// Lấy chuỗi ngày dạng YYYY-MM-DD để so sánh
function toDateKey(isoString) {
  return isoString.slice(0, 10);
}

// ===== KIỂM TRA TRONG TUẦN/THÁNG/NĂM =====
function isThisWeek(isoString) {
  const now  = new Date();
  const d    = new Date(isoString);
  // Tính ngày đầu tuần (thứ 2)
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);
  return d >= startOfWeek;
}

function isThisMonth(isoString) {
  const now = new Date(); const d = new Date(isoString);
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth()    === now.getMonth();
}

function isThisYear(isoString) {
  return new Date(isoString).getFullYear() === new Date().getFullYear();
}

function isToday(isoString) {
  return toDateKey(isoString) === toDateKey(new Date().toISOString());
}

// ===== LOCK SCREEN & XÁC THỰC =====
document.getElementById('unlock-btn').addEventListener('click', async () => {
  // Web Authentication API — dùng Face ID / Touch ID nếu thiết bị hỗ trợ
  // Nếu không hỗ trợ, mở thẳng (app cá nhân, chấp nhận được)
  if (window.PublicKeyCredential) {
    try {
      // Thử xác thực sinh trắc học (biometrics)
      const available = await PublicKeyCredential
        .isUserVerifyingPlatformAuthenticatorAvailable();
      if (available) {
        // Thiết bị hỗ trợ Face ID / Touch ID — có thể mở rộng sau
        // Hiện tại: mở thẳng vì WebAuthn cần backend để lưu credential
        // TODO: Implement full WebAuthn flow nếu cần bảo mật cao hơn
      }
    } catch (e) { /* Bỏ qua lỗi */ }
  }
  unlockApp();
});

function unlockApp() {
  document.getElementById('lock-screen').classList.remove('active');
  document.getElementById('main-screen').classList.add('active');
  loadTodayTab();
}

// Ẩn nội dung nhạy cảm khi app vào background (chống nhìn trộm)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    document.getElementById('main-screen').classList.remove('active');
    document.getElementById('lock-screen').classList.add('active');
  }
});

// ===== ĐIỀU HƯỚNG TAB =====
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    // Bỏ active tất cả
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    // Active tab được chọn
    btn.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
    // Load dữ liệu tab tương ứng
    if (tab === 'today')   loadTodayTab();
    if (tab === 'summary') loadSummaryTab();
    if (tab === 'history') loadHistoryTab();
  });
});

// ===== TAB HÔM NAY =====
async function loadTodayTab() {
  // Hiện ngày hôm nay
  document.getElementById('today-date').textContent =
    new Date().toLocaleDateString('vi-VN', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
    });

  const all     = await getAllExpenses();
  const todayEx = all.filter(e => isToday(e.date));

  // Tính tổng hôm nay
  const total = todayEx.reduce((sum, e) => sum + e.amount, 0);
  document.getElementById('today-total').textContent = formatVND(total);

  // Render danh sách
  const list = document.getElementById('today-list');
  if (todayEx.length === 0) {
    list.innerHTML = '<p class="empty-state">Chưa có khoản chi nào 👆</p>';
    return;
  }
  // Sắp xếp mới nhất lên đầu
  todayEx.sort((a, b) => new Date(b.date) - new Date(a.date));
  list.innerHTML = todayEx.map(e => renderExpenseItem(e)).join('');
  attachItemEvents(list);
}

// ===== TAB TỔNG KẾT =====
async function loadSummaryTab() {
  const all = await getAllExpenses();
  const sum = (arr) => arr.reduce((s, e) => s + e.amount, 0);

  document.getElementById('week-total').textContent  =
    formatVND(sum(all.filter(e => isThisWeek(e.date))));
  document.getElementById('month-total').textContent =
    formatVND(sum(all.filter(e => isThisMonth(e.date))));
  document.getElementById('year-total').textContent  =
    formatVND(sum(all.filter(e => isThisYear(e.date))));
}

// ===== TAB LỊCH SỬ =====
async function loadHistoryTab() {
  const all = await getAllExpenses();
  const list = document.getElementById('history-list');

  if (all.length === 0) {
    list.innerHTML = '<p class="empty-state">Chưa có dữ liệu</p>';
    return;
  }

  // Nhóm theo ngày
  const groups = {};
  all.forEach(e => {
    const key = toDateKey(e.date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  // Sắp xếp ngày mới nhất lên đầu
  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  list.innerHTML = sortedKeys.map(key => {
    const items    = groups[key].sort((a,b) => new Date(b.date)-new Date(a.date));
    const dayTotal = items.reduce((s, e) => s + e.amount, 0);
    const dateLabel = new Date(key).toLocaleDateString('vi-VN', {
      weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric'
    });
    return `
      <div class="history-day-group">
        <div class="history-day-header">
          <span>${dateLabel}</span>
          <span>${formatVND(dayTotal)}</span>
        </div>
        ${items.map(e => renderExpenseItem(e)).join('')}
      </div>`;
  }).join('');

  attachItemEvents(list);
}

// ===== RENDER MỘT KHOẢN CHI =====
function renderExpenseItem(e) {
  const cat  = CATEGORIES[e.category] || CATEGORIES.other;
  // Dùng data-id để xác định record khi sửa/xóa
  // KHÔNG dùng innerHTML với dữ liệu user chưa sanitize — dùng textContent khi cần
  return `
    <div class="expense-item" data-id="${e.id}">
      <span class="expense-icon">${cat.icon}</span>
      <div class="expense-info">
        <div class="expense-note">${sanitize(e.note || cat.label)}</div>
        <div class="expense-meta">${cat.label} · ${formatTime(e.date)}</div>
      </div>
      <span class="expense-amount">${formatVND(e.amount)}</span>
      <div class="expense-actions">
        <button class="btn-icon edit-btn" data-id="${e.id}" title="Sửa">✏️</button>
        <button class="btn-icon delete-btn" data-id="${e.id}" title="Xóa">🗑️</button>
      </div>
    </div>`;
}

// SECURITY: Sanitize input để chống XSS (Cross-Site Scripting)
// XSS là lỗi kẻ tấn công chèn code JS vào dữ liệu
function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str; // textContent tự escape HTML
  return div.innerHTML;
}

// Gắn sự kiện sửa/xóa cho các nút trong list
function attachItemEvents(container) {
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Xóa khoản chi này?')) {
        await deleteExpense(Number(btn.dataset.id));
        refreshCurrentTab();
      }
    });
  });
  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(Number(btn.dataset.id));
    });
  });
}

// ===== MODAL THÊM/SỬA =====
let editingId    = null; // null = đang thêm mới, số = đang sửa
let selectedCat  = 'food';

document.getElementById('add-btn').addEventListener('click', () => openAddModal());

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// Chọn danh mục
document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedCat = btn.dataset.cat;
  });
});

function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Thêm khoản chi';
  document.getElementById('input-amount').value = '';
  document.getElementById('input-note').value   = '';
  selectedCat = 'food';
  document.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === 'food');
  });
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('input-amount').focus();
}

async function openEditModal(id) {
  const all  = await getAllExpenses();
  const item = all.find(e => e.id === id);
  if (!item) return;

  editingId = id;
  document.getElementById('modal-title').textContent  = 'Sửa khoản chi';
  document.getElementById('input-amount').value = item.amount;
  document.getElementById('input-note').value   = item.note || '';
  selectedCat = item.category;
  document.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === item.category);
  });
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingId = null;
}

// LƯU khoản chi
document.getElementById('save-btn').addEventListener('click', async () => {
  const amountRaw = document.getElementById('input-amount').value.trim();
  const note      = document.getElementById('input-note').value.trim();

  // Validation — kiểm tra dữ liệu đầu vào
  const amount = parseFloat(amountRaw);
  if (!amountRaw || isNaN(amount) || amount <= 0) {
    alert('Vui lòng nhập số tiền hợp lệ!');
    return;
  }
  if (amount > 1_000_000_000) { // Giới hạn 1 tỷ/khoản
    alert('Số tiền quá lớn, vui lòng kiểm tra lại!');
    return;
  }

  if (editingId !== null) {
    // Sửa khoản chi cũ — giữ nguyên date gốc
    const all  = await getAllExpenses();
    const item = all.find(e => e.id === editingId);
    await updateExpense({ ...item, amount, category: selectedCat, note });
  } else {
    // Thêm mới
    await addExpense({ amount, category: selectedCat, note });
  }

  closeModal();
  refreshCurrentTab();
});

// Refresh tab đang hiển thị sau khi thêm/sửa/xóa
function refreshCurrentTab() {
  const activeTab = document.querySelector('.nav-btn.active')?.dataset.tab;
  if (activeTab === 'today')   loadTodayTab();
  if (activeTab === 'summary') loadSummaryTab();
  if (activeTab === 'history') loadHistoryTab();
}

// Đăng ký Service Worker cho PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .catch(err => console.error('SW error:', err));
  });
}