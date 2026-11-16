// 오늘의 기운 모으기(결정 027): 30초 동안 쏟아지는 오행 구슬을 펫으로 받는 손맛 놀이.
// 오늘 운세(갈래·행운의 기운)가 판의 규칙을 바꿔서, 매일 같은 놀이가 조금씩 다르게 느껴지게 한다.
import type { Category, Element } from '../fortune/saju';
import { ELEMENTS } from '../fortune/saju';
import * as sfx from '../audio';

/** 갈래별 판 규칙(데이터로 두어 테스트·조정이 쉽게) */
export interface Mods {
  coinRate: number; // 금화가 섞일 확률
  cloudRate: number; // 먹구름(방해물) 확률
  rainbowRate: number; // 무지개 구슬 확률
  catchRadius: number; // 받기 범위(px)
  fallScale: number; // 낙하 속도 배율
  label: { ko: string; en: string };
}
export function modsFor(cat: Category): Mods {
  const base: Mods = { coinRate: 0.04, cloudRate: 0.07, rainbowRate: 0.02, catchRadius: 56, fallScale: 1, label: { ko: '', en: '' } };
  switch (cat) {
    case 'wealth': return { ...base, coinRate: 0.16, label: { ko: '재물운: 금화가 자주 떨어져요', en: 'Wealth: coins rain down' } };
    case 'work': return { ...base, cloudRate: 0.17, label: { ko: '일운: 먹구름을 피하세요', en: 'Duty: dodge the storm clouds' } };
    case 'express': return { ...base, rainbowRate: 0.09, label: { ko: '표현운: 무지개 구슬이 콤보를 키워요', en: 'Flair: rainbow orbs boost combos' } };
    case 'friend': return { ...base, catchRadius: 84, label: { ko: '친구운: 받는 범위가 넓어요', en: 'Allies: wider catch range' } };
    case 'learn': return { ...base, fallScale: 0.78, label: { ko: '배움운: 구슬이 천천히 떨어져요', en: 'Support: orbs fall slowly' } };
  }
}

export interface CatchResult {
  score: number;
  ki: Record<Element, number>;
  coins: number;
  bestCombo: number;
}

type Kind = Element | 'coin' | 'cloud' | 'rainbow';
interface Drop { kind: Kind; x: number; y: number; vy: number; r: number; spin: number; lucky: boolean }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }
interface Pop { x: number; y: number; text: string; life: number; color: string }

const HEX: Record<Element, string> = { wood: '#6fd16b', fire: '#ff6a3d', earth: '#f2c14e', metal: '#e6e3f5', water: '#4f8fe0' };
const DURATION = 30;

/** 구슬 그림은 시작할 때 한 번만 만들어 두고 매 프레임에는 복사만 한다(휴대폰 성능) */
function orbSprite(color: string, r: number, ring?: string) {
  const s = Math.ceil(r * 3.2);
  const cv = document.createElement('canvas');
  cv.width = cv.height = s * 2;
  const c = cv.getContext('2d')!;
  c.scale(2, 2);
  const m = s / 2;
  const glow = c.createRadialGradient(m, m, r * 0.6, m, m, r * 1.55);
  glow.addColorStop(0, color + 'aa');
  glow.addColorStop(1, color + '00');
  c.fillStyle = glow;
  c.fillRect(0, 0, s, s);
  const body = c.createRadialGradient(m - r * 0.35, m - r * 0.4, r * 0.1, m, m, r);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.25, color);
  body.addColorStop(1, shade(color, -0.45));
  c.fillStyle = body;
  c.beginPath();
  c.arc(m, m, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,.75)';
  c.beginPath();
  c.ellipse(m - r * 0.35, m - r * 0.42, r * 0.28, r * 0.17, -0.6, 0, Math.PI * 2);
  c.fill();
  if (ring) {
    c.strokeStyle = ring;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(m, m, r + 4, 0, Math.PI * 2);
    c.stroke();
  }
  return { img: cv, size: s };
}

function coinSprite(r: number) {
  const s = Math.ceil(r * 3);
  const cv = document.createElement('canvas');
  cv.width = cv.height = s * 2;
  const c = cv.getContext('2d')!;
  c.scale(2, 2);
  const m = s / 2;
  const g = c.createRadialGradient(m - r * 0.3, m - r * 0.3, 1, m, m, r);
  g.addColorStop(0, '#fff6c8');
  g.addColorStop(0.4, '#f2c14e');
  g.addColorStop(1, '#a8701a');
  c.fillStyle = g;
  c.beginPath();
  c.arc(m, m, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#8a5a12';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(m, m, r * 0.68, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = '#8a5a12';
  c.font = `bold ${r}px Georgia, serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('福', m, m + 1);
  return { img: cv, size: s };
}

function cloudSprite(w: number) {
  const h = w * 0.62;
  const cv = document.createElement('canvas');
  cv.width = w * 2;
  cv.height = h * 2;
  const c = cv.getContext('2d')!;
  c.scale(2, 2);
  c.fillStyle = '#4b4766';
  for (const [x, y, r] of [[0.3, 0.6, 0.22], [0.5, 0.45, 0.28], [0.72, 0.6, 0.2], [0.5, 0.68, 0.24]]) {
    c.beginPath();
    c.arc(w * x, h * y, w * r, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = '#ffe066';
  c.lineWidth = 3;
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(w * 0.52, h * 0.7);
  c.lineTo(w * 0.44, h * 0.95);
  c.lineTo(w * 0.56, h * 0.92);
  c.lineTo(w * 0.48, h * 1.15);
  c.stroke();
  return { img: cv, w, h };
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + (k < 0 ? v * k : (255 - v) * k))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function runCatch(opts: {
  lucky: Element;
  category: Category;
  pet: HTMLImageElement;
  L: (ko: string, en: string) => string;
  onEnd: (r: CatchResult) => void;
}) {
  const { lucky, category, pet, L } = opts;
  const mods = modsFor(category);
  const root = document.createElement('div');
  root.className = 'catch';
  const cv = document.createElement('canvas');
  root.appendChild(cv);
  document.body.appendChild(root);
  const c = cv.getContext('2d')!;
  const dpr = Math.min(devicePixelRatio, 2);
  let W = 0, H = 0;
  const resize = () => {
    W = innerWidth;
    H = innerHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
  };
  resize();
  addEventListener('resize', resize);
  // 노치 아래부터 머리 표시를 그린다(.catch의 padding-top이 안전 영역)
  const safeTop = parseFloat(getComputedStyle(root).paddingTop) || 0;

  const R = 17;
  const orbs = Object.fromEntries(ELEMENTS.map((e) => [e, orbSprite(HEX[e], R, e === lucky ? '#ffd76a' : undefined)])) as Record<Element, ReturnType<typeof orbSprite>>;
  const rainbow = orbSprite('#ff7ad9', R + 2, '#ffffff');
  const coinS = coinSprite(R);
  const cloud = cloudSprite(74);
  const stars = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7 }));

  const drops: Drop[] = [];
  const sparks: Spark[] = [];
  const pops: Pop[] = [];
  const ki = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  let coins = 0, score = 0, combo = 0, bestCombo = 0;
  let px = W / 2, tx = W / 2;
  let stun = 0, shake = 0, squash = 0, spawnT = 0.6;
  let t = 0, last = performance.now(), running = true, started = false, countdown = 3;

  const move = (e: PointerEvent) => (tx = e.clientX);
  cv.addEventListener('pointerdown', (e) => {
    sfx.unlockAudio();
    move(e);
  });
  cv.addEventListener('pointermove', move);

  function spawn() {
    const roll = Math.random();
    let kind: Kind;
    if (roll < mods.cloudRate) kind = 'cloud';
    else if (roll < mods.cloudRate + mods.coinRate) kind = 'coin';
    else if (roll < mods.cloudRate + mods.coinRate + mods.rainbowRate) kind = 'rainbow';
    else kind = Math.random() < 0.28 ? lucky : ELEMENTS[Math.floor(Math.random() * 5)];
    const speed = (230 + t * 6) * mods.fallScale * (0.85 + Math.random() * 0.35);
    drops.push({ kind, x: 30 + Math.random() * (W - 60), y: -40, vy: speed, r: kind === 'cloud' ? 34 : R, spin: Math.random() * 6, lucky: kind === lucky });
  }

  function burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 260;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 0.6 + Math.random() * 0.4, color, size: 2 + Math.random() * 3 });
    }
  }

  function catchDrop(d: Drop) {
    if (d.kind === 'cloud') {
      combo = 0;
      stun = 0.7;
      shake = 0.35;
      sfx.thud();
      sfx.buzz(40);
      burst(d.x, d.y, '#8a85a8', 14);
      pops.push({ x: d.x, y: d.y - 20, text: L('으앗!', 'Ouch!'), life: 0.8, color: '#c9c3ff' });
      return;
    }
    combo++;
    bestCombo = Math.max(bestCombo, combo);
    const mult = Math.min(3, 1 + Math.floor(combo / 5) * 0.5);
    squash = 0.18;
    if (d.kind === 'coin') {
      coins += 3;
      score += Math.round(15 * mult);
      sfx.coin();
      burst(d.x, d.y, '#f2c14e', 16);
      pops.push({ x: d.x, y: d.y - 18, text: '🪙+3', life: 0.8, color: '#ffe08a' });
    } else if (d.kind === 'rainbow') {
      combo += 4;
      for (const e of ELEMENTS) ki[e] += 1;
      score += Math.round(30 * mult);
      sfx.sparkle();
      for (const e of ELEMENTS) burst(d.x, d.y, HEX[e], 6);
      pops.push({ x: d.x, y: d.y - 18, text: L('콤보 +5!', 'Combo +5!'), life: 0.9, color: '#ffb3ec' });
    } else {
      const gain = d.lucky ? 2 : 1;
      ki[d.kind] += gain;
      const pts = Math.round(10 * gain * mult);
      score += pts;
      sfx.pling(Math.floor(combo / 2) % 11, d.lucky);
      burst(d.x, d.y, HEX[d.kind], d.lucky ? 18 : 10);
      pops.push({ x: d.x, y: d.y - 18, text: `+${pts}${d.lucky ? ' ★' : ''}`, life: 0.7, color: d.lucky ? '#ffd76a' : '#fff' });
    }
    sfx.buzz(8);
  }

  function step(now: number) {
    if (!running) return;
    requestAnimationFrame(step);
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    if (!started) {
      countdown -= dt;
      if (countdown <= 0) started = true;
    } else t += dt;
    const left = DURATION - t;

    // 펫: 손가락을 부드럽게 따라온다(기절 중에는 느리게)
    px += (tx - px) * Math.min(1, dt * (stun > 0 ? 3 : 16));
    stun = Math.max(0, stun - dt);
    shake = Math.max(0, shake - dt);
    squash = Math.max(0, squash - dt);
    const py = H - 130;

    if (started && left > 0) {
      spawnT -= dt;
      if (spawnT <= 0) {
        spawn();
        spawnT = Math.max(0.24, 0.5 - t * 0.008);
      }
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += d.vy * dt;
      d.spin += dt * 3;
      const dx = d.x - px, dy = d.y - (py + 10);
      if (Math.hypot(dx, dy) < mods.catchRadius && stun <= 0) {
        catchDrop(d);
        drops.splice(i, 1);
      } else if (d.y > H + 40) {
        if (d.kind !== 'cloud' && d.kind !== 'coin') combo = 0; // 놓치면 콤보만 끊긴다(벌점 없음)
        drops.splice(i, 1);
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.vy += 600 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0) sparks.splice(i, 1);
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      pops[i].y -= 50 * dt;
      pops[i].life -= dt;
      if (pops[i].life <= 0) pops.splice(i, 1);
    }

    // 그리기
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = shake > 0 ? (Math.random() - 0.5) * 14 * shake * 3 : 0;
    c.translate(sx, 0);
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#16142b');
    bg.addColorStop(0.7, '#2a2550');
    bg.addColorStop(1, '#4a3a6a');
    c.fillStyle = bg;
    c.fillRect(-20, 0, W + 40, H);
    for (const s of stars) {
      c.fillStyle = `rgba(255,255,255,${0.25 + s.z * 0.5})`;
      const y = (s.y * H + t * 20 * s.z) % H;
      c.fillRect(s.x * W, y, s.z * 2, s.z * 2);
    }
    // 바닥 빛
    const gl = c.createRadialGradient(px, H - 60, 10, px, H - 60, 160);
    gl.addColorStop(0, 'rgba(227,180,90,.35)');
    gl.addColorStop(1, 'rgba(227,180,90,0)');
    c.fillStyle = gl;
    c.fillRect(0, H - 220, W, 220);

    for (const d of drops) {
      if (d.kind === 'cloud') c.drawImage(cloud.img, d.x - cloud.w / 2, d.y - cloud.h / 2, cloud.w, cloud.h);
      else {
        const sp = d.kind === 'coin' ? coinS : d.kind === 'rainbow' ? rainbow : orbs[d.kind];
        const bob = d.kind === 'coin' ? Math.abs(Math.cos(d.spin)) : 1;
        c.drawImage(sp.img, d.x - (sp.size * bob) / 2, d.y - sp.size / 2, sp.size * bob, sp.size);
      }
    }
    // 펫(받을 때 찌그러졌다 펴지고, 기절하면 흔들린다)
    const sq = squash > 0 ? Math.sin((squash / 0.18) * Math.PI) * 0.18 : 0;
    const ps = 120;
    c.save();
    c.translate(px, py + ps / 2);
    if (stun > 0) c.rotate(Math.sin(stun * 30) * 0.15);
    c.scale(1 + sq, 1 - sq);
    c.drawImage(pet, -ps / 2, -ps, ps, ps);
    c.restore();
    if (mods.catchRadius > 60) {
      c.strokeStyle = 'rgba(255,255,255,.18)';
      c.setLineDash([4, 6]);
      c.beginPath();
      c.arc(px, py + 10, mods.catchRadius, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }
    for (const s of sparks) {
      c.globalAlpha = Math.max(0, s.life);
      c.fillStyle = s.color;
      c.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
    }
    c.globalAlpha = 1;
    c.textAlign = 'center';
    for (const p of pops) {
      c.globalAlpha = Math.min(1, p.life * 2);
      c.fillStyle = p.color;
      c.font = 'bold 20px -apple-system, sans-serif';
      c.fillText(p.text, p.x, p.y);
    }
    c.globalAlpha = 1;

    // 머리 표시: 남은 시간 막대·점수·콤보·오늘의 규칙
    const top = safeTop + 14;
    c.fillStyle = 'rgba(255,255,255,.15)';
    c.fillRect(20, top, W - 40, 8);
    c.fillStyle = left < 6 ? '#ff6a3d' : '#e3b45a';
    c.fillRect(20, top, (W - 40) * Math.max(0, left / DURATION), 8);
    c.fillStyle = '#fff';
    c.font = 'bold 30px -apple-system, sans-serif';
    c.fillText(String(score), W / 2, top + 48);
    if (combo >= 3) {
      c.font = 'bold 16px -apple-system, sans-serif';
      c.fillStyle = '#ffd76a';
      c.fillText(`${combo} ${L('콤보', 'combo')} ×${Math.min(3, 1 + Math.floor(combo / 5) * 0.5)}`, W / 2, top + 72);
    }
    c.font = '13px -apple-system, sans-serif';
    c.fillStyle = '#b9b2d6';
    c.fillText(L(mods.label.ko, mods.label.en), W / 2, top + 96);
    if (!started) {
      c.fillStyle = '#fff';
      c.font = 'bold 72px -apple-system, sans-serif';
      c.fillText(String(Math.ceil(countdown)), W / 2, H / 2);
      c.font = '15px -apple-system, sans-serif';
      c.fillText(L('펫을 좌우로 끌어 구슬을 받아요', 'Drag your pet to catch the orbs'), W / 2, H / 2 + 40);
      c.fillStyle = '#ffd76a';
      c.fillText(L('★ 금테 구슬이 오늘의 행운 기운(두 배)', '★ Gold-ringed orbs are your lucky element (×2)'), W / 2, H / 2 + 66);
    }
    if (started && left <= 0 && drops.length === 0) finish();
  }

  function finish() {
    running = false;
    removeEventListener('resize', resize);
    root.remove();
    opts.onEnd({ score, ki, coins, bestCombo });
  }

  requestAnimationFrame(step);
}
