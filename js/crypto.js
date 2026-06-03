// crypto.js — Mã hóa AES-GCM dữ liệu trước khi lưu IndexedDB
// Web Crypto API là chuẩn của trình duyệt, không cần thư viện ngoài
// AES-GCM (Galois/Counter Mode): vừa mã hóa vừa xác thực tính toàn vẹn

const CRYPTO_KEY_NAME = 'spending-tracker-key';

// Lấy hoặc tạo mới khóa AES-256 — lưu trong localStorage (chỉ lưu key, không lưu data)
async function getOrCreateKey() {
  const stored = localStorage.getItem(CRYPTO_KEY_NAME);
  if (stored) {
    // Import lại key từ localStorage
    const raw = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
    return await crypto.subtle.importKey(
      'raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
    );
  }
  // Tạo key mới AES-256
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  );
  // Lưu key vào localStorage để dùng lại
  const exported = await crypto.subtle.exportKey('raw', key);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  localStorage.setItem(CRYPTO_KEY_NAME, b64);
  return key;
}

// Mã hóa chuỗi → base64 string
async function encryptText(plaintext) {
  const key = await getOrCreateKey();
  const iv  = crypto.getRandomValues(new Uint8Array(12)); // IV ngẫu nhiên 96-bit
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, enc.encode(plaintext)
  );
  // Ghép IV + ciphertext rồi encode base64
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

// Giải mã base64 string → chuỗi gốc
async function decryptText(b64) {
  try {
    const key      = await getOrCreateKey();
    const combined = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const iv         = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const plaintext  = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, key, ciphertext
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return b64; // Nếu decrypt lỗi (data cũ chưa mã hóa) → trả về nguyên bản
  }
}

// Mã hóa object expense trước khi lưu
async function encryptExpense(expense) {
  return {
    ...expense,
    note: expense.note ? await encryptText(expense.note) : '',
    _encrypted: true
  };
}

// Giải mã expense khi đọc ra
async function decryptExpense(expense) {
  if (!expense._encrypted) return expense; // Data cũ chưa mã hóa
  return {
    ...expense,
    note: expense.note ? await decryptText(expense.note) : ''
  };
}

// Mã hóa group
async function encryptGroup(group) {
  return {
    ...group,
    name: await encryptText(group.name),
    desc: group.desc ? await encryptText(group.desc) : '',
    _encrypted: true
  };
}

// Giải mã group
async function decryptGroup(group) {
  if (!group._encrypted) return group;
  return {
    ...group,
    name: await decryptText(group.name),
    desc: group.desc ? await decryptText(group.desc) : ''
  };
}