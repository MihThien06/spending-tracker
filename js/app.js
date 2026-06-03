// app.js — Logic chính, viết lại hoàn chỉnh

// ── CẤU HÌNH ──
const CATS = {
  food:          { label: 'Ăn uống',   icon: '🍜' },
  transport:     { label: 'Di chuyển', icon: '🛵' },
  shopping:      { label: 'Mua sắm',   icon: '🛍' },
  entertainment: { label: 'Giải trí',  icon: '🎮' },
  other:         { label: 'Khác',      icon: '📦' },
};

// Nhân 1000: người dùng nhập 35 → lưu 35000
const MULTIPLIER = 1000;

// ── HELPERS ──
function vnd(n) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}
function timeStr(iso) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
function dateKey(iso) { return iso.slice(0, 10); }
function isToday(iso)   { return dateKey(iso) === dateKey(new Date().toISOString()); }
function isWeek(iso) {
  const now = new Date(), d = new Date(iso);
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay()+6)%7)); mon.setHours(0,0,0,0);
  return d >= mon;
}
function isMonth(iso) {
  const n = new Date(), d = new Date(iso);
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth();
}
function isYear(iso) { return new Date(iso).getFullYear()===new Date().getFullYear(); }

// Chống XSS: escape HTML trước khi render
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ── STATE ──
let currentMode   = null;  // 'personal' | 'group'
let currentGroup  = null;  // { id, name, desc } hoặc null
let editingId     = null;
let selectedCat   = 'food';

// ── SCREENS ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── HOME: CHỌN MODE ──
document.getElementById('btn-personal').addEventListener('click', () => {
  currentMode  = 'personal';
  currentGroup = null;
  document.getElementById('main-title').textContent = 'Chi tiêu cá nhân';
  document.getElementById('group-total-card').style.display = 'none';
  showScreen('screen-main');
  switchTab('today');
});

document.getElementById('btn-group').addEventListener('click', () => {
  currentMode = 'group';
  showScreen('screen-groups');
  renderGroupList();
});

// ── BACK BUTTONS ──
document.getElementById('back-from-groups').addEventListener('click', () => showScreen('screen-home'));
document.getElementById('back-from-main').addEventListener('click', () => {
  if (currentMode === 'group') {
    showScreen('screen-groups');
    renderGroupList();
  } else {
    showScreen('screen-home');
  }
});

// ── GROUPS ──
async function renderGroupList() {
  const groups = await getAllGroups();
  const wrap   = document.getElementById('groups-list');
  if (!groups.length) {
    wrap.innerHTML = '<p class="empty-state">Chưa có nhóm nào<br><small>Nhấn "+ Tạo" để bắt đầu</small></p>';
    return;
  }
  // Tính tổng từng nhóm
  const all = await getAllExpenses();
  wrap.innerHTML = '';
  groups.forEach(g => {
    const total = all.filter(e => e.groupId === g.id).reduce((s,e) => s+e.amount, 0);
    const item  = document.createElement('button');
    item.className = 'group-item';
    item.innerHTML = `
      <span class="group-emoji">📁</span>
      <div class="group-info">
        <div class="group-name">${esc(g.name)}</div>
        ${g.desc ? `<div class="group-desc">${esc(g.desc)}</div>` : ''}
      </div>
      <span class="group-total-lbl">${vnd(total)}</span>
      <button class="btn-del-group" data-gid="${g.id}" title="Xoá nhóm">🗑</button>`;
    // Vào nhóm
    item.addEventListener('click', (e) => {
      if (e.target.closest('.btn-del-group')) return;
      enterGroup(g);
    });
    // Xoá nhóm
    item.querySelector('.btn-del-group').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Xoá nhóm "${g.name}"?\nTất cả chi tiêu trong nhóm cũng bị xoá.`)) {
        await deleteGroup(g.id);
        renderGroupList();
      }
    });
    wrap.appendChild(item);
  });
}

function enterGroup(g) {
  currentGroup = g;
  document.getElementById('main-title').textContent = g.name;
  document.getElementById('group-total-card').style.display = 'block';
  document.getElementById('group-total-lbl').textContent    = 'Tổng ' + g.name;
  showScreen('screen-main');
  switchTab('today');
}

// Modal tạo nhóm
document.getElementById('btn-new-group').addEventListener('click', () => {
  document.getElementById('inp-group-name').value = '';
  document.getElementById('inp-group-desc').value = '';
  document.getElementById('modal-group-bg').classList.remove('hidden');
  document.getElementById('inp-group-name').focus();
});
document.getElementById('modal-group-close').addEventListener('click', () => {
  document.getElementById('modal-group-bg').classList.add('hidden');
});
document.getElementById('btn-save-group').addEventListener('click', async () => {
  const name = document.getElementById('inp-group-name').value.trim();
  if (!name) { alert('Vui lòng nhập tên nhóm!'); return; }
  await addGroup({ name, desc: document.getElementById('inp-group-desc').value.trim() });
  document.getElementById('modal-group-bg').classList.add('hidden');
  renderGroupList();
});

// ── TABS ──
function switchTab(tabId) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===tabId));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id==='tab-'+tabId));
  if (tabId==='today')   loadToday();
  if (tabId==='summary') loadSummary();
  if (tabId==='history') loadHistory();
}
document.querySelectorAll('.nav-btn').forEach(b => {
  b.addEventListener('click', () => switchTab(b.dataset.tab));
});

// ── HÔM NAY ──
async function loadToday() {
  document.getElementById('today-date').textContent = new Date().toLocaleDateString('vi-VN',{
    weekday:'long', day:'2-digit', month:'2-digit'
  });
  const all  = await getAllExpenses();
  const data = filter(all).filter(e => isToday(e.date)).sort((a,b)=>new Date(b.date)-new Date(a.date));
  document.getElementById('today-total').textContent = vnd(data.reduce((s,e)=>s+e.amount,0));
  const list = document.getElementById('today-list');
  list.innerHTML = data.length ? data.map(renderItem).join('') : '<p class="empty-state">Chưa có khoản chi nào 👆</p>';
  bindItemEvents(list);
}

// ── TỔNG KẾT ──
async function loadSummary() {
  const all  = await getAllExpenses();
  const data = filter(all);
  const sum  = arr => arr.reduce((s,e)=>s+e.amount,0);
  document.getElementById('week-total').textContent  = vnd(sum(data.filter(e=>isWeek(e.date))));
  document.getElementById('month-total').textContent = vnd(sum(data.filter(e=>isMonth(e.date))));
  document.getElementById('year-total').textContent  = vnd(sum(data.filter(e=>isYear(e.date))));
  if (currentGroup) {
    document.getElementById('group-total').textContent = vnd(sum(data));
  }
}

// ── LỊCH SỬ ──
async function loadHistory() {
  const all  = await getAllExpenses();
  const data = filter(all).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const list = document.getElementById('history-list');
  if (!data.length) {
    list.innerHTML = '<p class="empty-state">Chưa có dữ liệu</p>';
    return;
  }
  // Nhóm theo ngày
  const groups = {};
  data.forEach(e => { const k=dateKey(e.date); (groups[k]=groups[k]||[]).push(e); });
  list.innerHTML = Object.keys(groups).sort((a,b)=>b.localeCompare(a)).map(k => {
    const items   = groups[k];
    const daySum  = items.reduce((s,e)=>s+e.amount,0);
    const lbl     = new Date(k).toLocaleDateString('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});
    return `<div class="day-group">
      <div class="day-header"><span>${lbl}</span><span>${vnd(daySum)}</span></div>
      ${items.map(renderItem).join('')}
    </div>`;
  }).join('');
  bindItemEvents(list);
}

// Lọc theo mode: personal = không có groupId, group = đúng groupId
function filter(all) {
  if (currentMode === 'group' && currentGroup)
    return all.filter(e => e.groupId === currentGroup.id);
  return all.filter(e => !e.groupId);
}

// ── RENDER ITEM ──
function renderItem(e) {
  const c = CATS[e.category] || CATS.other;
  return `<div class="expense-item" data-id="${e.id}">
    <span class="exp-icon">${c.icon}</span>
    <div class="exp-info">
      <div class="exp-note">${esc(e.note || c.label)}</div>
      <div class="exp-meta">${c.label} · ${timeStr(e.date)}</div>
    </div>
    <span class="exp-amt">${vnd(e.amount)}</span>
    <div class="exp-actions">
      <button class="btn-ico edit-btn"  data-id="${e.id}">✏️</button>
      <button class="btn-ico del-btn"   data-id="${e.id}">🗑</button>
    </div>
  </div>`;
}

function bindItemEvents(container) {
  container.querySelectorAll('.del-btn').forEach(b => {
    b.addEventListener('click', async ev => {
      ev.stopPropagation();
      if (confirm('Xoá khoản chi này?')) {
        await deleteExpense(Number(b.dataset.id));
        refreshTab();
      }
    });
  });
  container.querySelectorAll('.edit-btn').forEach(b => {
    b.addEventListener('click', ev => { ev.stopPropagation(); openEdit(Number(b.dataset.id)); });
  });
}

// ── MODAL THÊM/SỬA ──
document.getElementById('fab-add').addEventListener('click', () => openAdd());
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-bg').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-bg')) closeModal();
});

// Live preview: nhập 35 → hiện "= 35.000 ₫"
document.getElementById('inp-amount').addEventListener('input', updatePreview);
function updatePreview() {
  const v = parseFloat(document.getElementById('inp-amount').value);
  document.getElementById('amount-preview').textContent =
    isNaN(v) || v <= 0 ? '= 0 ₫' : '= ' + vnd(v * MULTIPLIER);
}

document.querySelectorAll('.cat-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); selectedCat = b.dataset.cat;
  });
});

function openAdd() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Thêm chi tiêu';
  document.getElementById('inp-amount').value = '';
  document.getElementById('inp-note').value   = '';
  document.getElementById('amount-preview').textContent = '= 0 ₫';
  selectedCat = 'food';
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat==='food'));
  document.getElementById('modal-bg').classList.remove('hidden');
  document.getElementById('inp-amount').focus();
}

async function openEdit(id) {
  const all  = await getAllExpenses();
  const item = all.find(e => e.id === id);
  if (!item) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'Sửa chi tiêu';
  // Hiển thị lại dạng đã chia 1000 để người dùng sửa tự nhiên
  document.getElementById('inp-amount').value = item.amount / MULTIPLIER;
  document.getElementById('inp-note').value   = item.note || '';
  selectedCat = item.category;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat===item.category));
  updatePreview();
  document.getElementById('modal-bg').classList.remove('hidden');
}

function closeModal() { document.getElementById('modal-bg').classList.add('hidden'); editingId = null; }

document.getElementById('btn-save').addEventListener('click', async () => {
  const raw = parseInt(document.getElementById('inp-amount').value);
  if (isNaN(raw) || raw <= 0) { alert('Vui lòng nhập số tiền hợp lệ!'); return; }
  if (raw > 1_000_000) { alert('Số tiền quá lớn (tối đa 1.000.000 × 1000 = 1 tỷ)'); return; }

  // Nhân 1000 trước khi lưu
  const amount = raw * MULTIPLIER;
  const note   = document.getElementById('inp-note').value.trim();

  if (editingId !== null) {
    const all  = await getAllExpenses();
    const item = all.find(e => e.id === editingId);
    await updateExpense({ ...item, amount, category: selectedCat, note });
  } else {
    const expense = { amount, category: selectedCat, note };
    // Gắn groupId nếu đang ở mode nhóm
    if (currentMode === 'group' && currentGroup) expense.groupId = currentGroup.id;
    await addExpense(expense);
  }
  closeModal();
  refreshTab();
});

// Refresh tab đang hiện
function refreshTab() {
  const active = document.querySelector('.nav-btn.active')?.dataset.tab;
  if (active === 'today')   loadToday();
  if (active === 'summary') loadSummary();
  if (active === 'history') loadHistory();
}

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}