// 편지·음원 불러오기 (AES-GCM 간단 암호화 해제)
import { CONTENT_SECRET } from './config.js';

let manifest = null;
const letterCache = new Map();
const audioCache = new Map();

const enc = new TextEncoder();
const b64ToBytes = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function keyFor(tag) {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(CONTENT_SECRET + ':' + tag));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
}

async function decrypt(tag, iv, data) {
  const key = await keyFor(tag);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
}

export async function loadContent() {
  const res = await fetch('./data/content.json');
  manifest = await res.json();
  return manifest;
}

export function hasAudio(day) {
  return !!manifest?.days?.[day - 1]?.audio;
}

export async function getLetter(day) {
  if (letterCache.has(day)) return letterCache.get(day);
  const entry = manifest.days[day - 1];
  const plain = await decrypt('day:' + day, b64ToBytes(entry.iv), b64ToBytes(entry.data));
  const letter = JSON.parse(new TextDecoder().decode(plain));
  letterCache.set(day, letter);
  return letter;
}

export async function getFinale() {
  const f = manifest.finale;
  const plain = await decrypt('finale', b64ToBytes(f.iv), b64ToBytes(f.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

// 복호화한 mp3 를 blob URL 로 돌려준다 (없으면 null → 대체 멜로디 사용)
export async function getAudioUrl(day) {
  if (audioCache.has(day)) return audioCache.get(day);
  const entry = manifest.days[day - 1];
  if (!entry.audio) return null;
  const buf = new Uint8Array(await (await fetch(entry.audio)).arrayBuffer());
  const plain = await decrypt('audio:' + day, buf.slice(0, 12), buf.slice(12));
  const url = URL.createObjectURL(new Blob([plain], { type: 'audio/mpeg' }));
  audioCache.set(day, url);
  return url;
}

// ── 사진 (서랍 / 액자) ──
const photoCache = new Map();
export function photos(group) {
  const p = manifest?.photos;
  if (!p) return group === 'frame' ? null : [];
  return p[group] ?? (group === 'frame' ? null : []);
}
export async function getPhotoUrl(entry) {
  if (!entry) return null;
  if (photoCache.has(entry.src)) return photoCache.get(entry.src);
  const buf = new Uint8Array(await (await fetch(entry.src)).arrayBuffer());
  const plain = await decrypt('photo:' + entry.src, buf.slice(0, 12), buf.slice(12));
  const url = URL.createObjectURL(new Blob([plain], { type: entry.type || 'image/jpeg' }));
  photoCache.set(entry.src, url);
  return url;
}
