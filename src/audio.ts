// 합성음(쓸어킬처럼 음원 파일 없이 만들어 저작권 걱정이 없다).
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
let ctx: AudioContext | null = null;
let master: GainNode;
let wipeGain: GainNode | null = null;
let wipeFilter: BiquadFilterNode | null = null;

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);
}

function noiseBuffer(c: AudioContext) {
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** 문지르는 소리: 문지르는 속도가 빠를수록 크고 높아진다 */
export function wipe(speed: number) {
  if (!ctx) return;
  if (!wipeGain) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    wipeFilter = ctx.createBiquadFilter();
    wipeFilter.type = 'bandpass';
    wipeFilter.Q.value = 1.2;
    wipeGain = ctx.createGain();
    wipeGain.gain.value = 0;
    src.connect(wipeFilter).connect(wipeGain).connect(master);
    src.start();
  }
  const t = ctx.currentTime;
  const s = Math.min(1, speed);
  wipeGain.gain.setTargetAtTime(0.05 + s * 0.22, t, 0.03);
  wipeFilter!.frequency.setTargetAtTime(900 + s * 2600, t, 0.03);
}

export function wipeStop() {
  if (ctx && wipeGain) wipeGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** 제자리에 딸깍 */
export function click() {
  tone(1800, 0.05, 'square', 0.08);
  tone(900, 0.08, 'triangle', 0.12, 0.012);
}

/** 다 닦였을 때 반짝 */
export function sparkle() {
  [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, 0.35, 'sine', 0.07, i * 0.06));
}

/** 시계 초침(작업을 끝내면 방에 돌아오는 소리) */
export function tick(high: boolean) {
  tone(high ? 2400 : 2000, 0.03, 'square', 0.025);
}

/** 창밖 새소리 */
export function chirp() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  const base = 2600 + Math.random() * 900;
  for (let i = 0; i < 3; i++) {
    o.frequency.setValueAtTime(base, t + i * 0.09);
    o.frequency.exponentialRampToValueAtTime(base * 1.5, t + i * 0.09 + 0.06);
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.03, t + 0.01);
  g.gain.setTargetAtTime(0, t + 0.25, 0.05);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.5);
}

/** 부딪힘: 낮은 둔탁음 */
export function thud() {
  tone(110, 0.16, 'sine', 0.22);
  tone(70, 0.2, 'triangle', 0.15, 0.01);
}

/** 늑대 물기 */
export function snap() {
  tone(520, 0.05, 'sawtooth', 0.08);
  tone(260, 0.09, 'square', 0.06, 0.04);
}

/** 강에 떠내려감 */
export function splash() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(2400, t);
  f.frequency.exponentialRampToValueAtTime(300, t + 0.5);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.6);
}

/** 실패 */
export function fail() {
  [392, 330, 262].forEach((f, i) => tone(f, 0.4, 'triangle', 0.08, i * 0.16));
}

/** 복원 완료 */
export function finale() {
  [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 1.2, 'sine', 0.08, i * 0.12));
}

/** 짧은 진동. iPhone 웹뷰는 navigator.vibrate를 무시하므로 앱에서는 네이티브 햅틱을 쓴다 */
export function buzz(ms = 12) {
  if (Capacitor.isNativePlatform()) {
    void Haptics.impact({ style: ms >= 20 ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {});
    return;
  }
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 진동이 없는 기기 */
  }
}
