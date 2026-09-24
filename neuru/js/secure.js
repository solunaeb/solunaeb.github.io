// 키 암호화 보관
// - 이 기기 안에서만 쓰이는 암호 열쇠(AES-256)를 만들어 IndexedDB 에 "꺼낼 수 없는(non-extractable)" 상태로 둠
// - API 키는 그 열쇠로 잠근 뒤에만 localStorage 에 저장 → 저장 공간을 통째로 복사해 가도 키가 보이지 않음
// - 브라우저 데이터를 지우면 열쇠도 사라져서, 그때는 키를 다시 넣어야 함
const DB = 'neuru-secure', STORE = 'keys', ID = 'wrap-v1';

function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idb(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { d.close(); res(req?.result); };
    tx.onerror = () => { d.close(); rej(tx.error); };
  });
}

async function wrapKey(create) {
  let k = await idb('readonly', s => s.get(ID));
  if (!k && create) {
    k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await idb('readwrite', s => s.put(k, ID));
  }
  return k || null;
}

const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function sealSecret(plain) {
  const k = await wrapKey(true);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(plain)));
  return { iv: b64(iv), ct: b64(ct) };
}

export async function openSecret(sealed) {
  if (!sealed?.iv) return null;
  const k = await wrapKey(false);
  if (!k) return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, k, unb64(sealed.ct));
    return new TextDecoder().decode(pt);
  } catch { return null; }
}

export async function forgetWrapKey() {
  try { await idb('readwrite', s => s.delete(ID)); } catch {}
}
