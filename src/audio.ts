// 소리: 타격·물건 소리는 Kenney CC0 녹음(public/sfx, 결정 046), 음 높이가 있는 신호음과 배경음악은 합성.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
let ctx: AudioContext | null = null;
let master: GainNode, musicGain: GainNode;
let noise: AudioBuffer;

const SAMPLES = ['whack', 'bonk1', 'bonk2', 'bonk3', 'pop', 'creak1', 'creak2', 'squish', 'clang', 'swish1', 'swish2', 'coins', 'chime', 'fanfare', 'tap'] as const;
type Sample = (typeof SAMPLES)[number];
const buffers = new Map<Sample, AudioBuffer>();
const lastPlay = new Map<Sample, number>();

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.16;
  musicGain.connect(master);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const c = ctx;
  for (const name of SAMPLES)
    fetch(`${import.meta.env.BASE_URL}sfx/${name}.m4a`)
      .then((r) => r.arrayBuffer())
      .then((b) => c.decodeAudioData(b))
      .then((buf) => buffers.set(name, buf))
      .catch(() => { /* 못 읽은 소리는 조용히 건너뛴다 */ });
  if (musicOn) startMusic();
}
// 앱이 뒤로 가면 소리를 멈추고, 돌아오면 다시 튼다
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  void (document.hidden ? ctx.suspend() : ctx.resume());
});

/** 녹음 효과음. 같은 소리는 gap초 안에 다시 울리지 않고(한꺼번에 맞을 때 뭉개짐 방지), 음 높이를 조금씩 흔든다 */
function play(name: Sample, vol = 1, gap = 0.05, delay = 0, rate = 1) {
  const buf = buffers.get(name);
  if (!ctx || !buf) return;
  const t = ctx.currentTime + delay;
  if (t - (lastPlay.get(name) ?? -1) < gap) return;
  lastPlay.set(name, t);
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf;
  src.playbackRate.value = rate * (0.93 + Math.random() * 0.14);
  g.gain.value = vol;
  src.connect(g).connect(master);
  src.start(t);
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, out?: AudioNode) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out ?? master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// ───── 장면별 소리 ─────
let bonkIdx = 0;
/** 망치가 적을 때림 */
export const whack = () => play('whack', 0.9, 0.06);
/** 통나무·호박·충격파·돌진에 맞음 */
export const bonk = () => play((['bonk1', 'bonk2', 'bonk3'] as const)[bonkIdx++ % 3], 0.55, 0.07);
/** 헛스윙·쾅!·돌진 */
export const swish = (big = false) => play(big ? 'swish1' : 'swish2', big ? 0.9 : 0.45, 0.1, 0, big ? 0.8 : 1.15);
/** 섬 밖으로 떨어짐: 휘파람 뒤에 멀리서 퐁 */
export function fall() {
  play('pop', 0.5, 0.08, 0.4, 0.8);
  if (!ctx) return;
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(1100, t);
  o.frequency.exponentialRampToValueAtTime(160, t + 0.5);
  g.gain.setValueAtTime(0.05, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.6);
}
/** 호박 폭탄 터짐·상자 착지 */
export const squish = (vol = 1) => play('squish', vol, 0.08);
/** 통나무가 굴러 나옴 */
export const creak = () => play('creak2', 0.7, 0.3);
/** 다침 */
export const clang = () => play('clang', 0.6, 0.2);
/** 상자 열기·강화 구매 */
export const coins = () => play('coins', 0.7, 0.15);
export const chime = () => play('chime', 0.8, 0.1);
/** 레벨업·보너스 시작 */
export const fanfare = () => play('fanfare', 0.8, 0.2);
/** 버튼 */
export const tap = () => play('tap', 0.8, 0.03);

/** 땅이 무너짐: 낮은 우르르 + 나무 삐걱 */
export function rumble() {
  play('creak1', 0.9, 0.3, 0, 0.7);
  if (!ctx) return;
  const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noise;
  src.loop = true;
  f.type = 'lowpass';
  f.frequency.value = 320;
  g.gain.setValueAtTime(0.45, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + 1.2);
  tone(55, 0.8, 'sine', 0.25);
}

/** 처치: 이어 잡을수록 음이 한 칸씩 올라간다(펜타토닉이라 어떤 순서로 이어져도 듣기 좋다) */
const PENTA = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093];
export function pling(step: number) {
  const f = PENTA[Math.min(step, PENTA.length - 1)];
  tone(f, 0.16, 'sine', 0.06);
  tone(f * 2, 0.1, 'triangle', 0.02, 0.01);
}
export function fail() {
  [392, 330, 262].forEach((f, i) => tone(f, 0.4, 'triangle', 0.08, i * 0.16));
}
export function finale() {
  play('fanfare', 0.9, 0.2);
  [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 1.2, 'sine', 0.06, 0.2 + i * 0.12));
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

// ───── 배경음악: 마림바·오르골 느낌의 밝은 반복(합성) ─────
let musicOn = (() => {
  try { return localStorage.getItem('music') !== 'off'; } catch { return true; }
})();
let musicTimer = 0, nextNote = 0, stepIdx = 0, tempo = 1;
// C 장조 I–vi–IV–V. 화음 음(반음 단위, C4=0)과 베이스
const CHORDS = [[0, 4, 7, 12], [-3, 0, 4, 9], [-7, -3, 0, 5], [-5, -1, 2, 7]];
const BASS = [-12, -15, -19, -17];
const ARP = [0, 2, 1, 3, 2, 1, 3, 2]; // 8분음표 8개 동안 화음 음을 고르는 순서
const hz = (semi: number) => 261.63 * 2 ** (semi / 12);
function marimba(f: number, t: number, vol: number) {
  if (!ctx) return;
  for (const [mul, v, dur] of [[1, vol, 0.45], [4, vol * 0.25, 0.12]] as const) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f * mul;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(musicGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}
function schedule() {
  if (!ctx) return;
  const eighth = 60 / (100 * tempo) / 2;
  while (nextNote < ctx.currentTime + 0.25) {
    const bar = Math.floor(stepIdx / 8) % 4, k = stepIdx % 8, chord = CHORDS[bar];
    marimba(hz(chord[ARP[k]] + 12), nextNote, k % 2 ? 0.35 : 0.5);
    if (k === 0 || k === 4) marimba(hz(BASS[bar]), nextNote, 0.55);
    if (stepIdx % 32 === 28) marimba(hz(chord[3] + 24), nextNote, 0.2); // 네 마디마다 반짝이는 높은 음
    nextNote += eighth;
    stepIdx++;
  }
}
function startMusic() {
  if (!ctx || musicTimer) return;
  nextNote = ctx.currentTime + 0.1;
  musicTimer = window.setInterval(schedule, 100);
}
function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = 0;
}
/** 보너스 판에서는 빠르게 */
export function setMusicFast(fast: boolean) {
  tempo = fast ? 1.3 : 1;
}
export const isMusicOn = () => musicOn;
export function toggleMusic() {
  musicOn = !musicOn;
  try { localStorage.setItem('music', musicOn ? 'on' : 'off'); } catch { /* 이번 실행에서만 */ }
  musicOn ? startMusic() : stopMusic();
  return musicOn;
}
