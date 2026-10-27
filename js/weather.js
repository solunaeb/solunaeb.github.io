// 날씨 (Open-Meteo — API 키 불필요). 30분마다 갱신, 마지막 값은 저장해 오프라인에서도 사용
import { WEATHER } from './config.js';

const KEY = 'neuru.weather';
let current = (() => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } })()
  || { kind: 'clear', temp: null, at: 0 };
let override = null; // 테스트 모드용

const LABEL = { clear: '맑음', cloudy: '흐림', rain: '비', snow: '눈', storm: '뇌우', fog: '안개' };

function classify(code) {
  if (code <= 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'rain';
}

export async function refreshWeather() {
  if (Date.now() - current.at < 25 * 60 * 1000 && current.at) return current;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER.lat}&longitude=${WEATHER.lon}&current=weather_code,temperature_2m&timezone=Asia%2FSeoul`;
    const res = await fetch(url, { cache: 'no-store' });
    const j = await res.json();
    current = { kind: classify(j.current.weather_code), temp: Math.round(j.current.temperature_2m), at: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch { /* 오프라인: 마지막 값 유지 */ }
  return current;
}

export function weather() { return override || current.kind; }
export function weatherText() {
  const k = weather();
  return `${WEATHER.label}, ${LABEL[k]}${current.temp !== null && !override ? ` ${current.temp}°C` : ''}`;
}
export function setWeatherOverride(k) { override = k || null; }
export const WEATHER_KINDS = Object.keys(LABEL);
export { LABEL as WEATHER_LABEL };
