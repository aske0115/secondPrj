// 쇼츠·릴스용 세로 홍보 영상(1080×1920, 30fps) 만들기: 게임 장면을 한 프레임씩 찍고(가상 시계) 자막을 얹은 뒤,
// Kenney CC0 효과음(public/sfx)과 게임 배경음(src/audio.ts 마림바 합성을 그대로 옮김)을 섞어 mp4로 굽는다.
// 준비: npm run dev (포트 5317)
// 실행: npm exec --yes --package=playwright@1.65.0 -- node marketing/shorts/make-short.mjs [ko|en ...]
//   인자 없음 = 한국어·영어 두 벌. 결과: marketing/shorts/tumble-isle-short-{ko,en}.mp4
// 문구 원칙: 경쟁 게임 이름·플레이 시간 숫자 금지, 출시 전이라 「곧 출시」(AGENTS.md 마케팅 원칙)
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let playwright;
try {
  playwright = await import('playwright');
} catch {
  const bin = process.env.PATH.split(path.delimiter).find((d) => existsSync(path.resolve(d, '../playwright/index.mjs')));
  if (!bin) throw new Error('맨 위 주석의 npm exec 명령으로 실행해 주세요.');
  playwright = await import(pathToFileURL(path.resolve(bin, '../playwright/index.mjs')).href);
}

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../..');
const URL_BASE = process.env.DEMO_URL ?? 'http://localhost:5317/';
const FPS = 30;
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ['ko', 'en'];

// ───── 장면 순서·자막(첫 장면부터 손맛, 로고는 맨 끝) ─────
// cap: [작은 윗줄, 큰 줄]. stage는 0~149, warm은 촬영 전에 흘려 둘 판 시간(초)
const SCENES = [
  { id: 'strike', stage: 0, weapon: 'hammer', lv: 3, warm: 20, sec: 3.2, cap: { ko: ['', '쾅! 한 방에 우르르'], en: ['', 'BONK! Off they go!'] } },
  { id: 'sledge', stage: 50, weapon: 'sledge', lv: 3, warm: 4, sec: 2.8, cap: { ko: ['무기마다 손맛이 달라요', '대형 해머 — 쿵!'], en: ['Every weapon feels different', 'Sledgehammer — THUD!'] } },
  { id: 'bat', stage: 15, weapon: 'bat', lv: 3, warm: 4, sec: 2.8, cap: { ko: ['무기마다 손맛이 달라요', '야구방망이 — 딱!'], en: ['Every weapon feels different', 'Bat — CRACK!'] } },
  { id: 'twin', stage: 62, weapon: 'twin', lv: 3, warm: 4, sec: 2.4, cap: { ko: ['무기마다 손맛이 달라요', '스펀지 쌍검 — 다다닥!'], en: ['Every weapon feels different', 'Foam Twins — whap-whap!'] } },
  { id: 'fan', stage: 3, weapon: 'fan', lv: 3, warm: 4, sec: 2.4, cap: { ko: ['무기마다 손맛이 달라요', '큰 부채 — 휘이잉~'], en: ['Every weapon feels different', 'Giant Fan — WHOOSH!'] } },
  { id: 'boss', stage: 45, weapon: 'hammer', lv: 3, warm: 94, sec: 6, cap: { ko: ['', '왕좀비도 섬 밖으로!'], en: ['', 'Even the King Zombie flies!'] } },
  { id: 'card', sec: 3.2, cap: { ko: ['제일 멀리 날린 순간을', '카드로 공유!'], en: ['Your best knock-off', 'Share it as a card!'] } },
  { id: 'end', sec: 3.2 },
];
const END = {
  ko: { title: '망치섬', sub: '쳐서 날려라! 하늘섬 망치 서바이벌', store: 'Google Play 곧 출시' },
  en: { title: 'Tumble Isle', sub: 'Bonk the horde off your tiny island', store: 'Coming soon on Google Play' },
};
// 보여 줄 게임 안 알림(나머지 — 버티기 시간·미션·코인 알림 등 — 은 숨김: 시간 숫자 문구 금지)
const TOAST_OK = 'STRIKE|홈런|Home run|떨어뜨렸다|King zombie down|낙하|Drop ×|공중 콤보|Air combo';
const META = { cleared: 150, coins: 3860, perks: { vigor: 4, shove: 6, charge: 3, cards: 2, revive: 1, purse: 2 }, chars: ['human', 'orc', 'keeper', 'vampire', 'ghost'], hero: 'human', missions: [], missionsDone: 0, bossDowns: 0 };

const browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const icon = `data:image/png;base64,${readFileSync(path.join(ROOT, 'docs/art/icon.png')).toString('base64')}`;

// 브라우저 안 도우미(초기 스크립트): 같은 난수, 가상 시계(performance.now를 프레임마다 1/30초씩)
const INIT = (seed) => {
  let a = seed;
  Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const real = performance.now.bind(performance);
  window.__vt = null;
  performance.now = () => window.__vt ?? real();
};

// 페이지 안 도우미: 장면 배치·프레임 한 칸·자막
const HELPERS = ([toastOk, iconUrl, end]) => {
  const d = window.__demo;
  window.__picking = () => !document.getElementById('overlay').hidden && document.querySelector('#overlay .card');
  window.__run = (sec) => { // capture-store.mjs와 같은 흘리기(체력 채움·카드 자동 고름)
    const stop = d.g.t + sec;
    for (let t = 0, guard = 0; d.g.t < stop - 0.01 && guard < sec * 8 + 20; guard++, t += 0.5) {
      d.g.hp = d.g.maxHp;
      if (window.__picking()) window.__picking().click();
      document.querySelector('[data-act="bonusGo"]')?.click();
      const ang = t * 0.8, tx = Math.cos(ang) * 2.5 - d.g.px, tz = Math.sin(ang) * 2.5 - d.g.pz, n = Math.hypot(tx, tz) || 1;
      d.step(0.5, tx / n, tz / n);
    }
    while (window.__picking()) window.__picking().click();
  };
  // 화면 글씨(HUD·버튼·조이스틱·시트)는 숨기고 알림·왕좀비 %만 남긴다
  const st = document.createElement('style');
  st.textContent = `#hud,#sweep,#pause,#stick,#hint,#warn,#overlay{display:none!important}
  #cap{position:fixed;left:0;right:0;top:112px;z-index:60;text-align:center;pointer-events:none;font-family:ui-rounded,"SF Pro Rounded",-apple-system,"Apple SD Gothic Neo",sans-serif}
  #cap .tag{display:inline-block;margin-bottom:8px;padding:5px 16px;border-radius:99px;background:#fffaf0;color:#1d4c64;font-size:22px;font-weight:900;box-shadow:0 3px 0 #e8dcc4}
  #cap .big{display:inline-block;font-size:46px;font-weight:900;color:#fff;letter-spacing:-1px;white-space:nowrap;text-shadow:0 3px 0 #2c6e8f,0 6px 0 #1d4c64,0 10px 18px #0007,-2px 0 0 #1d4c64,2px 0 0 #1d4c64}
  #fx{position:fixed;inset:0;z-index:55;pointer-events:none;display:flex;flex-direction:column;align-items:center;font-family:ui-rounded,"SF Pro Rounded",-apple-system,"Apple SD Gothic Neo",sans-serif}
  #fx .card{margin-top:236px;width:320px;border:6px solid #fffaf0;border-radius:18px;box-shadow:0 8px 0 #e8dcc4,0 18px 40px #0008;display:block}
  #fx h1{font-size:96px;font-weight:900;color:#fff;letter-spacing:-3px;margin:0;line-height:1.05;text-shadow:0 5px 0 #2c6e8f,0 10px 0 #1d4c64,0 18px 30px #0007}
  #fx .sub{width:max-content;max-width:500px;margin-top:14px;font-size:22px;font-weight:900;color:#1d4c64;background:#fffaf0;border-radius:40px;padding:8px 22px;box-shadow:0 4px 0 #e8dcc4;white-space:nowrap}
  #fx .store{margin-top:26px;font-size:26px;font-weight:900;color:#fff;background:#1d4c64;border-radius:16px;padding:12px 26px;box-shadow:0 5px 0 #0d2a38}
  #fx .icon{margin-top:150px;width:170px;height:170px;border-radius:38px;box-shadow:0 8px 0 #0003,0 14px 30px #0005;margin-bottom:22px}`;
  document.head.append(st);
  const cap = document.createElement('div'), fx = document.createElement('div');
  cap.id = 'cap'; fx.id = 'fx';
  document.body.append(cap, fx);
  window.__cap = (tag, big, k) => { // k: 장면 안 프레임 번호(처음 6프레임 동안 튀어나옴)
    cap.innerHTML = big ? `${tag ? `<div class="tag">${tag}</div><br>` : ''}<div class="big">${big}</div>` : '';
    const s = k < 6 ? 0.6 + 0.4 * Math.sin((k / 6) * Math.PI * 0.5) * 1.08 : 1;
    cap.style.transform = `scale(${s})`;
    cap.style.opacity = String(Math.min(1, k / 3 + 0.34));
    const big2 = cap.querySelector('.big'); // 한 줄에 안 들어가면 줄인다
    for (let px = 46; big2 && big2.scrollWidth > innerWidth - 24 && px > 20; ) big2.style.fontSize = `${--px}px`;
  };
  // 공유 카드: 게임 화면을 흐리게 깔고 카드가 튀어 들어온다
  window.__showCard = (url) => { fx.innerHTML = `<img class="card" src="${url}">`; document.querySelector('canvas').style.filter = 'blur(5px) brightness(.75)'; };
  window.__showEnd = () => {
    fx.style.background = 'linear-gradient(#8fd3f0cc,#cfeefbcc 55%,#f3fbffcc)';
    fx.innerHTML = `<img class="icon" src="${iconUrl}"><h1>${end.title}</h1><div class="sub">${end.sub}</div><div class="store">${end.store}</div>`;
  };
  window.__fxAnim = (k, kind) => {
    const el = kind === 'card' ? fx.querySelector('.card') : fx;
    const p = Math.min(1, k / 8), s = kind === 'card' ? 0.5 + 0.5 * p + Math.sin(p * Math.PI) * 0.12 : 1;
    el.style.transform = kind === 'card' ? `scale(${s}) rotate(${-4 + 2 * p}deg)` : '';
    el.style.opacity = String(Math.min(1, k / 4));
    if (kind === 'end') for (const [i, c] of [...fx.children].entries()) { const q = Math.max(0, Math.min(1, (k - i * 3) / 7)); c.style.transform = `translateY(${(1 - q) * 40}px) scale(${0.8 + 0.2 * q})`; c.style.opacity = String(q); }
  };
  // 한 프레임: 판 1/30초 진행 → 두 번 그림(그리기 시간도 1/30초) → CSS 애니메이션을 가상 시계에 맞춤
  window.__frame = (k, act, live = true) => {
    const g = d.g, c0 = [g.swings, g.misses, g.falls, g.strikes, g.bossDown];
    window.__vt += 1000 / 30;
    if (live) {
      window.__acts?.[act]?.(k);
      g.hp = g.maxHp;
      d.step(1 / 30);
      d.renderOnce(); d.renderOnce();
    }
    for (const an of document.getAnimations()) { if (an.__s === undefined) { an.__s = window.__vt; an.pause(); } an.currentTime = window.__vt - an.__s; }
    const t = document.getElementById('toast');
    t.style.visibility = new RegExp(toastOk).test(t.textContent) ? '' : 'hidden';
    return { hit: g.swings - c0[0] - (g.misses - c0[1]), miss: g.misses - c0[1], fall: g.falls - c0[2], strike: g.strikes - c0[3], boss: !c0[4] && g.bossDown };
  };
  // 장면별 배치: 주인공을 섬 가장자리 쪽에, 적은 주인공과 가장자리 사이에 몰아 둔다(맞으면 하늘로 떨어지게)
  const toEdge = (r = 0.5) => { const g = d.g; g.px = -0.25 * g.isl * r; g.pz = -g.isl * r; };
  const crowdOut = (n, r0, r1, spread) => {
    const g = d.g, base = Math.atan2(g.pz, g.px);
    d.stress(n + g.enemies.length);
    const live = g.enemies.filter((e) => !e.out && e.kind !== 'boss').slice(-n);
    live.forEach((e, i) => { const ang = base + (((i * 0.618) % 1) - 0.5) * spread, r = r0 + ((i * 0.37) % 1) * (r1 - r0); e.x = g.px + Math.cos(ang) * r; e.z = g.pz + Math.sin(ang) * r; e.kx = e.kz = 0; e.hp = 1e9; e.age = 1; });
  };
  const settle = () => { d.freeze(); for (let i = 0; i < 50; i++) d.renderOnce(); };
  window.__setup = (id, lv) => {
    const g = d.g;
    g.need = 1e9; // 레벨 업 시트가 뜨지 않게
    g.lv.hammer = lv;
    if (id === 'strike') {
      toEdge(0.5);
      g.enemies = g.enemies.filter((e) => !e.out).slice(0, 4);
      // 주인공 둘레로 빽빽이(capture-store 1번 장면처럼)
      d.stress(30);
      g.enemies.filter((e) => !e.out).forEach((e, i) => { const ang = i * 2.4, r = 1.4 + ((i * 0.37) % 1) * 2.4; e.x = g.px + Math.cos(ang) * r; e.z = g.pz + Math.sin(ang) * r; e.kx = e.kz = 0; e.hp = 1e9; e.age = 1; });
      settle();
      window.__acts = { strike: (k) => { if (k === 2) { d.charge(); d.sweep(); } if (k === 50) crowdOut(10, 1.3, 3, 1.6); } };
    } else if (id === 'boss') {
      for (let i = 0; i < 200 && !g.bossSpawned; i++) { g.hp = g.maxHp; d.step(1 / 30); }
      const b = g.enemies.find((e) => e.kind === 'boss' && !e.out);
      toEdge(0.4);
      g.enemies = [b, ...g.enemies.filter((e) => e !== b && !e.out && Math.hypot(e.x - g.px, e.z - g.pz) > 5).slice(0, 10)];
      b.pct = 140; b.age = 3; const ba = Math.atan2(g.pz, g.px) + 0.35; b.x = g.px + Math.cos(ba) * 2.1; b.z = g.pz + Math.sin(ba) * 2.1; b.kx = b.kz = 0; // 가장자리 쪽 비스듬히(바로 위로 날면 자막에 가림)
      settle();
      const bx = b.x, bz = b.z;
      // 처음 1.3초는 제자리에서 맞으며 %만 오르고(게이지가 보이게), 그 뒤 날린다
      window.__acts = { boss: (k) => { if (k < 40) { b.x = bx; b.z = bz; b.kx = b.kz = 0; b.out = false; b.pct = 40 + k * 2.5; } if (k === 40) b.pct = 170; /* 망치 한 방으로 날아간다(쾅!을 쓰면 졸개 STRIKE가 베스트 컷을 가져감) */ } };
    } else {
      toEdge(0.62);
      g.enemies = g.enemies.filter((e) => !e.out && Math.hypot(e.x - g.px, e.z - g.pz) > 5).slice(0, 6);
      crowdOut(12, 1.2, 3, 1.8);
      g.hammerCd = 0;
      settle();
      window.__acts = { [id]: (k) => { if (k === 36) crowdOut(8, 1.3, 3, 1.6); } };
    }
    window.__vt = performance.now();
    return { isl: g.isl, weapon: g.weapon, n: g.enemies.length };
  };
};

async function shoot(lang, work) {
  const events = []; // [초, 이름]
  let frame = 0;
  const save = (page) => page.screenshot({ path: path.join(work, `${String(frame++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
  const push = (t, ev) => {
    if (ev.hit) events.push([t, 'whack']);
    if (ev.miss) events.push([t, 'swish2']);
    if (ev.fall) events.push([t, 'fall']);
    if (ev.strike) events.push([t, 'fanfare']);
    if (ev.boss) events.push([t, 'fanfare'], [t, 'rumble']);
  };
  const game = SCENES.filter((s) => s.stage !== undefined);
  let page, ctx;
  for (const sc of game) {
    ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang === 'ko' ? 'ko-KR' : 'en-US' });
    await ctx.addInitScript(INIT, [...sc.id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) | 0);
    page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${URL_BASE}?lang=${lang}`);
    await page.evaluate((m) => { localStorage.setItem('meta', JSON.stringify(m)); localStorage.setItem('bonusSeen', '9'); }, META);
    await page.reload();
    await page.waitForFunction(() => window.__demo);
    await sleep(800);
    await page.evaluate(HELPERS, [TOAST_OK, icon, END[lang]]);
    await page.evaluate((w) => window.__demo.setWeapon(w), sc.weapon);
    await page.evaluate((n) => window.__demo.goStage(n), sc.stage);
    await sleep(700);
    await page.evaluate(() => document.querySelector('[data-act="start"]').click()); // 시트는 CSS로 숨겨 두었으므로 DOM으로 누른다
    await sleep(300);
    await page.evaluate((s) => window.__run(s), sc.warm);
    const info = await page.evaluate(([id, lv]) => window.__setup(id, lv), [sc.id, sc.lv]);
    console.log(lang, sc.id, JSON.stringify(info));
    let n = Math.round(sc.sec * FPS);
    for (let k = 0; k < n; k++) {
      const ev = await page.evaluate(([k, id, tag, big]) => { const r = window.__frame(k, id); window.__cap(tag, big, k); return r; }, [k, sc.id, ...sc.cap[lang]]);
      push(frame / FPS, ev);
      if (ev.boss) { n = k + 45; console.log(lang, '왕좀비 떨어짐', (k / FPS).toFixed(1), '초'); } // 떨어진 뒤 1.5초 보여 주고 끝(sec는 최대)
      await save(page);
    }
    if (errors.length) console.warn(sc.id, '페이지 오류:', errors);
    if (sc.id !== 'boss') await ctx.close();
  }
  // 공유 카드: 왕좀비 판이 끝나야 카드가 생긴다(왕좀비가 떨어지고 약 2초 뒤)
  await page.evaluate(() => { const d = window.__demo; for (let i = 0; i < 300 && !d.card(); i++) { d.g.hp = d.g.maxHp; d.step(1 / 30); d.renderOnce(); } d.renderOnce(); });
  const url = await page.evaluate(() => window.__demo.card());
  if (!url) throw new Error('공유 카드가 만들어지지 않음(왕좀비를 못 떨어뜨림)');
  for (const kind of ['card', 'end']) {
    const sc = SCENES.find((s) => s.id === kind);
    await page.evaluate(([kind, url]) => (kind === 'card' ? window.__showCard(url) : window.__showEnd()), [kind, url]);
    await page.evaluate(() => new Promise((r) => { const im = [...document.querySelectorAll('#fx img')]; Promise.all(im.map((i) => i.decode())).then(r, r); }));
    events.push([frame / FPS, kind === 'card' ? 'chime' : 'fanfare']);
    const n = Math.round(sc.sec * FPS);
    for (let k = 0; k < n; k++) {
      await page.evaluate(([k, kind, cap]) => { window.__frame(k, kind, false); window.__cap(cap?.[0] ?? '', cap?.[1] ?? '', k); window.__fxAnim(k, kind); }, [k, kind, sc.cap?.[lang]]);
      await save(page);
    }
  }
  await ctx.close();
  return { frames: frame, events };
}

// ───── 소리: 효과음(Kenney CC0, public/sfx)과 배경음(src/audio.ts 마림바, 보너스 판 빠르기 1.3) ─────
const SR = 48000;
function decode(name) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', path.join(ROOT, 'public/sfx', `${name}.m4a`), '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-'], { maxBuffer: 1 << 26 });
  if (r.status) throw new Error(`효과음 읽기 실패: ${name}`);
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
}
function mixAudio(seconds, events) {
  const out = new Float32Array(Math.ceil(seconds * SR)), cache = {}, last = {};
  const add = (name, t, vol, rate = 1, gap = 0.05) => {
    if (t - (last[name] ?? -9) < gap) return; // 같은 소리가 뭉개지지 않게(게임과 같은 규칙)
    last[name] = t;
    const buf = (cache[name] ??= decode(name)), i0 = Math.round(t * SR);
    for (let i = 0; i0 + i < out.length; i++) { const p = i * rate, j = Math.floor(p); if (j + 1 >= buf.length) break; out[i0 + i] += vol * (buf[j] + (buf[j + 1] - buf[j]) * (p - j)); }
  };
  const tone = (f0, f1, t, dur, vol, wave = 'sine') => { // 음 높이가 바뀌는 짧은 음(지수 감쇠)
    const i0 = Math.round(t * SR), n = Math.round(dur * SR);
    let ph = 0;
    for (let i = 0; i < n && i0 + i < out.length; i++) {
      const x = i / n, f = f0 * (f1 / f0) ** x;
      ph += f / SR;
      const s = wave === 'sine' ? Math.sin(2 * Math.PI * ph) : 4 * Math.abs((ph % 1) - 0.5) - 1;
      out[i0 + i] += vol * Math.min(1, i / (0.004 * SR)) * 0.0001 ** x * s;
    }
  };
  // 배경음: C 장조 I–vi–IV–V 아르페지오(audio.ts와 같은 음)
  const CHORDS = [[0, 4, 7, 12], [-3, 0, 4, 9], [-7, -3, 0, 5], [-5, -1, 2, 7]], BASS = [-12, -15, -19, -17], ARP = [0, 2, 1, 3, 2, 1, 3, 2];
  const hz = (s) => 261.63 * 2 ** (s / 12), eighth = 60 / (100 * 1.3) / 2, MUSIC = 0.28;
  const marimba = (f, t, v) => { tone(f, f, t, 0.45, v * MUSIC); tone(f * 4, f * 4, t, 0.12, v * 0.25 * MUSIC); };
  for (let s = 0, t = 0.05; t < seconds - 0.6; s++, t += eighth) {
    const bar = Math.floor(s / 8) % 4, k = s % 8, ch = CHORDS[bar];
    marimba(hz(ch[ARP[k]] + 12), t, k % 2 ? 0.35 : 0.5);
    if (k === 0 || k === 4) marimba(hz(BASS[bar]), t, 0.55);
    if (s % 32 === 28) marimba(hz(ch[3] + 24), t, 0.2);
  }
  for (const [t, name] of events) {
    if (name === 'whack') add('whack', t, 0.9, 1, 0.06);
    else if (name === 'swish2') add('swish2', t, 0.45, 1.15, 0.1);
    else if (name === 'fall') { add('pop', t + 0.4, 0.5, 0.8, 0.08); if (t - (last.whistle ?? -9) > 0.07) { last.whistle = t; tone(1100, 160, t, 0.55, 0.05, 'tri'); } }
    else if (name === 'rumble') { add('creak1', t, 0.9, 0.7, 0.3); tone(55, 55, t, 0.8, 0.25); }
    else add(name, t, name === 'chime' ? 0.8 : 0.85, 1, 0.2);
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const gain = 0.89 / Math.max(peak, 0.89), pcm = Buffer.alloc(out.length * 2);
  const fade = Math.round(0.4 * SR);
  for (let i = 0; i < out.length; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i] * gain * Math.min(1, (out.length - i) / fade))) * 32767), i * 2);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVEfmt ', 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

try {
  for (const lang of LANGS) {
    const work = mkdtempSync(path.join(os.tmpdir(), `short-${lang}-`));
    const { frames, events } = await shoot(lang, work);
    const seconds = frames / FPS;
    writeFileSync(path.join(work, 'audio.wav'), mixAudio(seconds, events));
    const out = path.join(HERE, `tumble-isle-short-${lang}.mp4`);
    mkdirSync(HERE, { recursive: true });
    const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(work, '%05d.jpg'), '-i', path.join(work, 'audio.wav'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
    if (r.status) throw new Error('ffmpeg 실패');
    console.log('만듦:', path.relative(ROOT, out), `${frames}프레임 ${seconds.toFixed(1)}초, 소리 ${events.length}개`);
    rmSync(work, { recursive: true, force: true });
  }
} finally {
  await browser.close();
}
