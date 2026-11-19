// Google Play 스토어 이미지 만들기: ① 개발 서버 __demo 훅으로 게임 장면을 찍고(store/raw) ② 문구를 얹어 합성(store/play)
// 준비: npm run dev (포트 5317)
// 실행: npm exec --yes --package=playwright@1.65.0 -- node scripts/capture-store.mjs [raw|compose] [장면 이름...]
//   인자 없음 = 찍기 + 합성(한·영 모두). compose = 찍지 않고 raw로 합성만(문구만 바꿀 때)
//   장면 이름을 주면 그 장면만 다시 찍는다(예: raw 1-strike)
// 결과: store/raw/{kr,en}/*.png(405×720 화면 3배 = 1215×2160), store/play/{kr,en}/*.png(1080×1920),
//       store/play/{kr,en}/feature-graphic-1024x500-{kr,en}.png (파일 이름 끝에 언어: 콘솔이 같은 이름을 같은 파일로 여겨 덮어씀), store/play/icon-512.png
// 브라우저는 이 맥의 Google Chrome을 쓴다(scripts/demo.mjs와 같음).
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
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

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const URL_BASE = process.env.DEMO_URL ?? 'http://localhost:5317/';
const [mode, ...only] = process.argv.slice(2);
const doRaw = mode !== 'compose', doCompose = mode !== 'raw';

// ───── 문구(PD·기획이 docs/STORE_LISTING.md에 맞춰 고칠 곳). 경쟁 게임 이름·플레이 시간 숫자 금지 ─────
// 순서·제목은 docs/STORE_LISTING.md 6장 표(8장). 1~3번은 망치(상징 무기), 다른 무기는 4·5번
const SLIDES = {
  kr: [
    ['1-strike', '망치로 쾅! 섬 밖으로 날려라', '둘러싼 적을 한 방에 우르르'],
    ['2-crumble', '섬이 무너진다, 버텨라!', '가장자리가 무너지면 그 위의 적도 함께 떨어져요'],
    ['3-boss', '왕좀비를 떨어뜨리면 보너스 코인', '때릴수록 % 가 올라 더 멀리 날아갑니다'],
    ['4-weapons', '새 무기를 열고, 손맛을 바꿔라', '대형 해머·스펀지 쌍검·야구방망이·큰 부채'],
    ['5-pick', '섬마다 어울리는 무기로', '추천 무기를 알아서 쥐여 줘요'],
    ['6-isles', '장 10개, 스테이지 150개', '풀밭·해적 해변·눈 마을·과자 섬·달 기지'],
    ['7-shop', '강화하고, 새 캐릭터를 뽑아라', '모험가·오크·묘지기·흡혈귀·유령'],
    ['8-daily', '판마다 다른 베스트 컷, 바로 공유', '표정·자세·앵글이 매번 달라요'],
  ],
  en: [
    ['1-strike', 'Bonk them off the island!', 'Send the whole crowd flying'],
    ['2-crumble', 'The island is crumbling. Hold on!', 'Foes on the edge go down with it'],
    ['3-boss', 'Knock off the King Zombie for bonus coins', 'Every hit raises his % and sends him farther'],
    ['4-weapons', 'Unlock new weapons, each with its own feel', 'Sledgehammer, Foam Twins, Bat, Giant Fan'],
    ['5-pick', 'The right weapon for every island', 'The recommended weapon is equipped for you'],
    ['6-isles', '10 chapters, 150 stages', 'Meadows, pirate beaches, snow, candy and the moon'],
    ['7-shop', 'Upgrade and unlock new heroes', 'Adventurer, Orc, Keeper, Vampire, Ghost'],
    ['8-daily', 'A new Best Shot every run. Share it!', 'New faces, poses and angles every time'],
  ],
};
// 4번 칸 아래 무기 이름(게임 안 이름과 같게)
const WEAPON_CELLS = [['sledge', '대형 해머', 'Sledgehammer'], ['twin', '스펀지 쌍검', 'Foam Twins'], ['bat', '야구방망이', 'Bat'], ['fan', '큰 부채', 'Giant Fan']];
const BANNER = { kr: ['망치섬', '쳐서 날려라! 하늘섬 망치 서바이벌'], en: ['Tumble Isle', 'Bonk the horde off your tiny island'] };

const browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 브라우저 안 도우미: 체력을 채우고 카드는 자동으로 골라 가며 시간을 흘린다(장면 연출용, 실제 난이도와 무관)
const HELPERS = () => {
  const d = window.__demo;
  // 고른 뒤에도 카드가 숨은 #overlay 안에 남아 있으므로 보이는지까지 본다
  window.__picking = () => !document.getElementById('overlay').hidden && document.querySelector('#overlay .card');
  window.__pick = () => { const c = window.__picking(); if (c) c.click(); };
  window.__run = (sec, stopAtPick = false) => {
    const end = d.g.t + sec;
    for (let t = 0, guard = 0; d.g.t < end - 0.01 && guard < sec * 8 + 20; guard++, t += 0.5) {
      d.g.hp = d.g.maxHp;
      if (window.__picking()) { if (stopAtPick) return true; window.__pick(); }
      if (document.querySelector('[data-act="bonusGo"]')) document.querySelector('[data-act="bonusGo"]').click();
      const a = t * 0.8, tx = Math.cos(a) * 2.5 - d.g.px, tz = Math.sin(a) * 2.5 - d.g.pz, n = Math.hypot(tx, tz) || 1;
      d.step(0.5, tx / n, tz / n); // 섬 가운데 근처를 작게 돌며 망치질(카메라가 따라오게 멀리 가지 않는다)
    }
    d.g.hp = d.g.maxHp;
    return false;
  };
  // 연출 도중 레벨 업 시트가 뜨지 않게 잠시 막는다(찍기 직전에 되돌림)
  window.__noLevel = () => { window.__need ??= d.g.need; d.g.need = 1e9; };
  // 적을 주인공 둘레로 모은다(쾅! 한 방에 많이 맞게)
  window.__crowd = (n, r0 = 1.4, r1 = 3.6) => {
    d.stress(n);
    const live = d.g.enemies.filter((e) => !e.out && e.kind !== 'boss').slice(0, n);
    live.forEach((e, i) => { const a = i * 2.4, r = r0 + ((i * 0.37) % 1) * (r1 - r0); e.x = d.g.px + Math.cos(a) * r; e.z = d.g.pz + Math.sin(a) * r; e.kx = e.kz = 0; e.hp = 1e9; }); // 죽어서 부서지지 않고 날아가게
  };
};

async function scene(lang, name, meta, setup, viewport = { width: 405, height: 720 }) {
  if (only.length && !only.includes(name)) return;
  const out = path.join(ROOT, 'store/raw', lang);
  mkdirSync(out, { recursive: true });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width > 500 ? 2 : 3, isMobile: true, hasTouch: true, locale: lang === 'kr' ? 'ko-KR' : 'en-US' });
  // 장면마다 같은 난수(소품 배치 등이 매번 같게). 실제 시간으로 그리는 부분이 있어 완전히 같지는 않다
  await ctx.addInitScript((seed) => { let a = seed; Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, [...name].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) | 0);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${URL_BASE}?lang=${lang === 'kr' ? 'ko' : 'en'}`);
  await page.evaluate((m) => { localStorage.setItem('meta', JSON.stringify(m)); localStorage.setItem('bonusSeen', '9'); }, meta);
  await page.reload();
  await page.waitForFunction(() => window.__demo);
  await sleep(800); // 첫 장 모델 굽기
  await page.evaluate(HELPERS);
  await setup(page);
  // 레벨 업은 막아 둔 채 경험치 막대만 반쯤 찬 것으로
  // 떠 있는 알림 글씨(STRIKE! 등)는 서서히 사라지므로 가장 진한 순간(40%)에 멈춰 찍는다
  await page.evaluate(() => { window.__beforeShot?.(); const g = window.__demo.g; if (window.__need) g.xp = g.need * 0.55; for (const e of g.enemies) e.flash = 0; /* 맞은 순간 하얗게 번쩍임은 빼고 */ window.__demo.renderOnce(); if (window.__noToast) document.getElementById('toast').className = ''; else document.getAnimations().forEach((a) => { if (a.effect?.target?.id === 'toast') { a.pause(); a.currentTime = 360; } }); });
  await page.screenshot({ path: path.join(out, `${name}-${lang}.png`) });
  if (errors.length) console.warn(name, '페이지 오류:', errors);
  console.log('찍음:', `store/raw/${lang}/${name}.png`);
  await ctx.close();
}

// 판을 시작하고 sec초 진행. stage 번호는 0~149
const start = async (page, stage, sec) => {
  await page.evaluate((n) => window.__demo.goStage(n), stage);
  await sleep(600);
  await page.click('[data-act="start"]');
  await sleep(300);
  await page.evaluate((s) => { window.__run(s); while (window.__picking()) window.__pick(); window.__noLevel(); }, sec);
  await sleep(700); // 카메라가 주인공에게 따라붙을 시간(실제 시간으로 그린다). 그동안 레벨 업 시트는 막아 둔다
  await page.evaluate(() => { window.__demo.g.hp = window.__demo.g.maxHp; });
};
const ALL = { cleared: 150, coins: 3860, perks: { vigor: 4, shove: 6, charge: 3, cards: 2, revive: 1, purse: 2 }, chars: ['human', 'orc', 'keeper', 'vampire', 'ghost'], hero: 'human', missions: [], missionsDone: 0, bossDowns: 0 };

/** 무기 장면: 적을 둘러 세우고 휘두를 때까지 흘린 뒤 그 순간에 멈춘다. how: windup(준비 끝무렵) | hit(맞힌 직후, 잔상 swingT) */
const weaponScene = (w, stage, how, lv = 1) => async (page) => {
  await page.evaluate((id) => window.__demo.setWeapon(id), w);
  await start(page, stage, 4);
  await page.evaluate(([how, lv]) => {
    const d = window.__demo, g = d.g;
    g.lv.hammer = lv;
    g.px = 0.6; g.pz = 0.4; // 섬 가운데 근처에서(카메라가 주인공을 가운데에 두게)
    window.__noLevel(); window.__crowd(12, 1.5, 3.2); g.hammerCd = 0; g.wPhase = 'idle';
    if (how === 'windup') for (let i = 0; i < 600 && !(g.wPhase === 'windup' && g.wT < 0.05); i++) { g.hp = g.maxHp; d.step(1 / 60); }
    else { const n0 = g.swings; for (let i = 0; i < 600 && g.swings === n0; i++) { g.hp = g.maxHp; d.step(1 / 60); } d.step(0.06); }
    d.freeze();
    for (let i = 0; i < 50; i++) d.renderOnce(); // 멈춘 채 카메라만 주인공에게 따라붙게
    window.__noToast = true;
    window.__beforeShot = () => { if (how !== 'windup') { g.swingT = 0.28; g.vis.shockT = g.vis.crackT = 0.2; g.vis.windT = 0.3; for (const s of g.vis.slashes) s.t = 0.2; } };
  }, [how, lv]);
};
async function captureRaw(lang) {
  // 1. 쾅! 둘러싼 적을 한 번에 쳐서 날리는 순간(STRIKE), 망치
  await scene(lang, '1-strike', ALL, async (page) => {
    await start(page, 0, 20);
    await page.evaluate(() => { const g = window.__demo.g; g.px = -3.5; g.pz = -g.isl * 0.55; }); // 섬 가장자리(화면 위쪽)로 옮겨 하늘이 보이게
    await sleep(900);
    // 실제 시간으로 기다리면 매번 결과가 달라서, 판 시간을 직접 흘려 STRIKE가 뜬 직후에 멈춘다
    const ok = await page.evaluate(() => {
      const d = window.__demo;
      window.__noLevel(); window.__crowd(26); d.charge(); d.sweep();
      for (let i = 0; i < 120 && !d.g.strikes; i++) d.step(1 / 60);
      d.step(0.12);
      return d.g.strikes > 0;
    });
    if (!ok) console.warn('STRIKE가 안 나옴');
  });
  // 2. 무너지는 섬: 빨간 경고 띠가 뜬 때, 가장자리 적
  await scene(lang, '2-crumble', ALL, async (page) => {
    await start(page, 33, 2);
    await page.evaluate(() => {
      const d = window.__demo, g = d.g, warn = document.getElementById('warn');
      for (let i = 0; i < 400 && warn.hidden; i++) { g.hp = g.maxHp; d.step(0.25); d.renderOnce(); }
      if (warn.hidden) console.warn('무너짐 경고 없음');
      window.__noLevel();
      g.px = 0; g.pz = -g.isl * 0.45; // 섬 위쪽 가장자리 쪽(하늘과 무너지는 테두리가 보이게)
      window.__crowd(14, 2, 4.5);
      d.step(0.3);
      window.__noToast = true;
    });
    await sleep(600);
  });
  // 3. 왕좀비: % 게이지가 높이 오른 왕좀비
  await scene(lang, '3-boss', ALL, async (page) => {
    await start(page, 45, 94); // 왕좀비는 95초에 나온다. 그 전에 멈춰야 망치질에 미리 떨어지지 않는다
    await page.evaluate(() => {
      const d = window.__demo, g = d.g;
      for (let i = 0; i < 120 && !g.bossSpawned; i++) { g.hp = g.maxHp; d.step(1 / 30); }
      const b = g.enemies.find((e) => e.kind === 'boss' && !e.out);
      if (!b) return console.warn('왕좀비 없음');
      g.enemies = [b, ...g.enemies.filter((e) => e !== b && !e.out).slice(0, 14)]; // 왕좀비가 묻히지 않게 졸개를 줄인다
      b.pct = 87; b.age = 3; b.x = g.px + 2.6; b.z = g.pz + 1.4; b.kx = b.kz = 0; // 주인공 오른쪽 아래(화면 가운데쯤)
      d.step(0.2);
      window.__noToast = true; // 왕좀비 % 글씨를 가리지 않게
    });
  });
  // 4. 무기 넷(합성에서 2×2로 묶는다): 대형 해머 쿵, 쌍검 다다닥, 방망이 젖힘, 부채 바람
  await scene(lang, '4-w-sledge', ALL, weaponScene('sledge', 50, 'hit'));
  await scene(lang, '4-w-twin', ALL, weaponScene('twin', 62, 'hit', 3));
  await scene(lang, '4-w-bat', ALL, weaponScene('bat', 15, 'windup', 4));
  await scene(lang, '4-w-fan', ALL, weaponScene('fan', 3, 'hit'));
  // 5. 시작 화면 → 무기 시트(추천 배지·박자 막대·잠김 그림자가 보이게 부채만 잠긴 진행)
  await scene(lang, '5-pick', { ...ALL, cleared: 100, mastery: { hammer: 2400, squeaky: 900, sledge: 3000, twin: 500, pan: 300, bat: 120, pole: 30, fan: 0 } }, async (page) => {
    await page.evaluate(() => window.__demo.goStage(96));
    await sleep(700);
    await page.click('[data-act="weapons"]');
    await sleep(600);
  });
  // 6. 장마다 다른 섬(합성에서 4칸으로 묶는다)
  for (const [n, s] of [['6-isle-pirate', 50], ['6-isle-snow', 62], ['6-isle-sweets', 112], ['6-isle-moon', 122]])
    await scene(lang, n, ALL, async (page) => { await start(page, s, 14); await page.evaluate(() => { window.__noLevel(); window.__crowd(8, 2, 5); }); await sleep(300); });
  // 7. 상점: 캐릭터와 강화
  await scene(lang, '7-shop', ALL, async (page) => {
    await page.click('[data-act="shop"]');
    await sleep(700);
  });
  // 8. 오늘의 섬 결과: 베스트 컷 섬네일 + 「오늘의 섬」 배지
  await scene(lang, '8-daily', ALL, async (page) => {
    await page.click('[data-act="daily"]');
    await sleep(900);
    await page.evaluate(() => { window.__run(20); window.__noLevel(); const g = window.__demo.g; g.bonusDone = true; g.px = -3.5; g.pz = -g.isl * 0.55; }); // 가장자리에서(이어 떨어뜨려 베스트 컷이 찍히게)
    await sleep(900);
    await page.evaluate(() => { const d = window.__demo; window.__crowd(26); d.charge(); d.sweep(); for (let i = 0; i < 120 && !d.g.strikes; i++) d.step(1 / 60); d.step(0.12); });
    await sleep(500); // 베스트 컷은 실제 프레임에서 찍힌다
    await page.evaluate(() => { const d = window.__demo; d.g.hp = d.g.maxHp; d.g.bonusDone = true; d.g.t = 119.95; d.step(0.3); });
    await sleep(1600); // 결과 화면 등장 애니메이션
  });
  // 그래픽 이미지 배경: 가로 화면, 글씨(HUD) 없이(촬영 모드). 망치 대신 대형 해머가 쿵 내려찍는 순간(다른 무기가 보이게)
  await scene(lang, 'banner', ALL, async (page) => {
    await weaponScene('sledge', 0, 'hit', 4)(page);
    await page.evaluate(() => { document.body.dataset.mode = 'shot'; });
  }, { width: 1024, height: 500 });
}

// ───── 합성: 하늘색 배경 위에 큰 문구 + 둥근 게임 화면 카드 ─────
const dataUrl = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
const CSS = `*{box-sizing:border-box;margin:0}body{width:100vw;height:100vh;overflow:hidden;font-family:ui-rounded,"SF Pro Rounded",-apple-system,"Apple SD Gothic Neo",sans-serif;
  background:linear-gradient(#8fd3f0,#cfeefb 55%,#f3fbff);display:flex;flex-direction:column;align-items:center}
h1{font-weight:900;color:#fff;letter-spacing:-1px;text-align:center;text-shadow:0 3px 0 #2c6e8f,0 6px 0 #1d4c64,0 10px 18px #0005;line-height:1.05}
p{font-weight:800;color:#1d4c64;text-align:center}
.card{border:5px solid #fffaf0;border-radius:26px;overflow:hidden;box-shadow:0 6px 0 #e8dcc4,0 14px 30px #1d4c6455;background:#fff}
.card img{display:block;width:100%;height:100%;object-fit:cover}
.cloud{position:absolute;background:#fff;border-radius:50%;opacity:.8;z-index:0}h1,p,.card,body>div{position:relative;z-index:1}`;

async function render(html, w, h, dpr, file, type = 'png') {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${CSS}</style><body>${html}</body>`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const el of document.querySelectorAll('[data-fit]')) // 한 줄에 안 들어가면 글자를 줄인다
      for (let px = parseFloat(getComputedStyle(el).fontSize); el.scrollWidth > el.clientWidth && px > 10; ) el.style.fontSize = `${--px}px`;
  });
  await page.screenshot({ path: file, type });
  await page.close();
  console.log('만듦:', path.relative(ROOT, file));
}

async function compose(lang) {
  const raw = (n) => dataUrl(path.join(ROOT, 'store/raw', lang, `${n}.png`));
  const out = path.join(ROOT, 'store/play', lang);
  mkdirSync(out, { recursive: true });
  const clouds = `<div class="cloud" style="left:-30px;top:96px;width:120px;height:40px"></div><div class="cloud" style="right:-20px;top:30px;width:110px;height:36px"></div>`;
  for (const [name, title, sub] of SLIDES[lang]) {
    // 휴대폰 1080×1920 = 360×640 × 3. 카드는 405×720 화면을 비율 그대로 줄인 것
    const grid = (cells) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:322px">${cells.join('')}</div>`;
    const body = name === '8-daily' // 베스트 컷 카드 4장(결정 094: 판마다 앵글·자세·표정이 다름). 원본은 8-card-0~3(촬영: 개발 서버에서 판을 돌려 __demo.card())
      ? `<div style="margin-top:26px">${grid([0, 1, 2, 3].map((k) => `<div class="card" style="aspect-ratio:4/5;border-radius:20px;transform:rotate(${[-2, 1.5, 1, -1.5][k]}deg)"><img src="${raw(`8-card-${k}`)}"></div>`))}</div>`
      : name === '6-isles'
      ? grid(['pirate', 'snow', 'sweets', 'moon'].map((k) => `<div class="card" style="height:245px;border-radius:20px"><img src="${raw(`6-isle-${k}`)}" style="object-position:50% 45%"></div>`))
      : name === '4-weapons' // 무기가 잘 보이게 주인공 둘레를 크게 잘라 보여 주고 아래에 이름
        ? grid(WEAPON_CELLS.map(([id, ko, en]) => `<div class="card" style="position:relative;height:245px;border-radius:20px"><img src="${raw(`4-w-${id}`)}" style="transform:scale(1.9);transform-origin:50% 54%">` +
          `<b style="position:absolute;left:50%;bottom:8px;transform:translateX(-50%);white-space:nowrap;padding:3px 10px;border-radius:99px;background:#fffaf0;color:#1d4c64;font-size:13px;font-weight:900;box-shadow:0 2px 0 #e8dcc4">${lang === 'kr' ? ko : en}</b></div>`))
        : `<div class="card" style="width:282px;height:501px"><img src="${raw(name)}"></div>`;
    await render(`${clouds}<div style="height:22px"></div><h1 data-fit style="font-size:36px;width:340px;white-space:nowrap;padding:0 4px 12px">${title}</h1>
      <p data-fit style="font-size:16px;width:330px;white-space:nowrap;margin:-2px 0 16px">${sub}</p>${body}`, 360, 640, 3, path.join(out, `${name}-${lang}.png`));
  }
  // 그래픽 이미지 1024×500: 배경은 섬 장면, 글씨는 가운데 안전 영역(가운데 약 700×300)에 크게
  const bg = raw('banner');
  // 장면을 1.5배로 키워 주인공(대형 해머 쿵)을 오른쪽에, 글씨는 왼쪽에(가운데 안전 영역 안)
  await render(`<div style="position:absolute;inset:0;background:url(${bg}) no-repeat;background-size:150% auto;background-position:-40px -100px"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 72% 55%,#0000 25%,#1d4c6466 100%)"></div>
    <div style="position:absolute;left:110px;top:50%;width:540px;transform:translateY(-50%);text-align:center">
      <h1 style="font-size:${lang === 'kr' ? 120 : 104}px;letter-spacing:-3px;text-shadow:0 5px 0 #2c6e8f,0 10px 0 #1d4c64,0 18px 30px #0007">${BANNER[lang][0]}</h1>
      <p data-fit style="display:inline-block;max-width:540px;white-space:nowrap;margin-top:22px;font-size:28px;color:#1d4c64;background:#fffaf0;border-radius:40px;padding:10px 28px;box-shadow:0 5px 0 #e8dcc4">${BANNER[lang][1]}</p></div>`,
    1024, 500, 1, path.join(out, `feature-graphic-1024x500-${lang}.png`));
}

try {
  for (const lang of ['kr', 'en']) {
    if (doRaw) await captureRaw(lang);
    if (doCompose) await compose(lang);
  }
  if (doCompose) { // 앱 아이콘 512×512: docs/art/icon.png를 줄여서 알파 없이
    const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
    await page.setContent(`<body style="margin:0;background:#7cb94f"><img src="${dataUrl(path.join(ROOT, 'docs/art/icon.png'))}" style="display:block;width:512px;height:512px">`);
    await page.screenshot({ path: path.join(ROOT, 'store/play/icon-512.png') });
    await page.close();
    console.log('만듦: store/play/icon-512.png');
  }
} finally {
  await browser.close();
}
