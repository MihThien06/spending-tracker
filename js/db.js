const DB_NAME    = 'SpendingTrackerDB';
const DB_VERSION = 2;
const STORE_NAME = 'expenses';
const GROUP_STORE = 'groups';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath:'id', autoIncrement:true });
        store.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains(GROUP_STORE)) {
        db.createObjectStore(GROUP_STORE, { keyPath:'id', autoIncrement:true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });
}

async function addExpense(expense) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    expense.date = new Date().toISOString();
    const req = store.add(expense);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function getAllExpenses() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function deleteExpense(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function updateExpense(expense) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(expense);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function getAllGroups() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(GROUP_STORE, 'readonly');
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
  const toDelete = all.filter(e => e.groupId === id);
  for (const e of toDelete) await deleteExpense(e.id);
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(GROUP_STORE, 'readwrite');
    const req = tx.objectStore(GROUP_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}