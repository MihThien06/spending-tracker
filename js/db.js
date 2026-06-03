// ── GROUPS STORE ──
// Quản lý nhóm/sự kiện chi tiêu

const GROUP_STORE = 'groups';

// Cần upgrade DB version để thêm store mới
// Sửa dòng: const DB_VERSION = 1;  →  const DB_VERSION = 2;
// Và thêm vào onupgradeneeded:

// QUAN TRỌNG: Tìm hàm openDB() trong db.js và thay toàn bộ bằng:
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2); // <-- version 2

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath:'id', autoIncrement:true });
        store.createIndex('date', 'date', { unique: false });
      }
      // Store mới cho nhóm
      if (!db.objectStoreNames.contains(GROUP_STORE)) {
        db.createObjectStore(GROUP_STORE, { keyPath:'id', autoIncrement:true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });
}

async function getAllGroups() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GROUP_STORE, 'readonly');
    const req = tx.objectStore(GROUP_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function addGroup(group) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(GROUP_STORE, 'readwrite');
    const req = tx.objectStore(GROUP_STORE).add(group);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function deleteGroup(id) {
  const db  = await openDB();
  const all = await getAllExpenses();
  // Xoá tất cả expense thuộc nhóm trước
  const toDelete = all.filter(e => e.groupId === id);
  for (const e of toDelete) await deleteExpense(e.id);
  // Xoá nhóm
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(GROUP_STORE, 'readwrite');
    const req = tx.objectStore(GROUP_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}