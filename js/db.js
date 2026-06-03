// db.js — Quản lý lưu trữ dữ liệu bằng IndexedDB
// Lý do dùng IndexedDB thay localStorage:
//   - Lưu được nhiều dữ liệu hơn (localStorage giới hạn ~5MB)
//   - Hỗ trợ query theo ngày, không cần load hết
//   - Bất đồng bộ, không làm đơ giao diện

const DB_NAME    = 'SpendingTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'expenses';

// Mở kết nối database — chạy 1 lần khi load app
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Chạy khi tạo database lần đầu hoặc nâng version
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Tạo bảng 'expenses', mỗi record có id tự tăng
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true
        });
        // Tạo index để query nhanh theo ngày
        store.createIndex('date', 'date', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });
}

// THÊM khoản chi mới
async function addExpense(expense) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // Lưu timestamp dạng ISO string để dễ so sánh
    expense.date = new Date().toISOString();
    const req = store.add(expense);
    req.onsuccess = () => resolve(req.result); // trả về id mới
    req.onerror   = () => reject(req.error);
  });
}

// LẤY TẤT CẢ khoản chi (dùng cho lịch sử và tổng kết)
async function getAllExpenses() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// XÓA khoản chi theo id
async function deleteExpense(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// CẬP NHẬT khoản chi đã có
async function updateExpense(expense) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // Giữ nguyên date gốc, chỉ cập nhật amount/category/note
    const req = store.put(expense);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}