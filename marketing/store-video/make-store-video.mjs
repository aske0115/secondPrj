// Play 스토어 등록정보용 가로 게임 영상(1920×1080, 30fps, 약 28초) 만들기.
// 세로 게임 화면(608×1080)을 가운데 iframe으로 두고, 왼쪽에 짧은 자막·오른쪽에 아이콘과 이름을 둔 한 장면을 프레임마다 찍는다.
// 게임 장면 배치·가상 시계·효과음·배경음은 marketing/shorts/make-short.mjs의 것을 그대로 가져다 쓴다.
// 준비: npm run dev (포트 5317)
// 실행: npm exec --yes --package=playwright@1.65.0 -- node marketing/store-video/make-store-video.mjs [ko|en ...]
//   인자 없음 = 한국어·영어 두 벌. 결과: marketing/store-video/tumble-isle-store-{ko,en}.mp4
// 문구 원칙: 경쟁 게임 이름·플레이 시간 숫자 금지, 왕좀비는 「보너스」(결정 094 — 승리 조건 아님), 끝은 이름·로고만(「프로필 링크」 없음)
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { FPS, URL_BASE, TOAST_OK, META, INIT, HELPERS, icon, sleep, playwright, pushSounds, mixAudio } from '../shorts/make-short.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../..');
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ['ko', 'en'];
const W = 1920, H = 1080, GW = 608; // 가운데 게임 화면 폭(9:16)

// ───── 장면 순서·자막(첫 3초에 쾅!, 로고는 맨 끝) ─────
// cap: [작은 윗줄, 큰 줄]. 큰 줄이 null이면 그 스테이지의 장 이름. card: 이 장면 판을 끝내 공유 카드를 받는다
const WEAPON = { ko: '무기마다 손맛이 달라요', en: 'Every weapon feels different' };
const ISLES = { ko: '장마다 다른 섬', en: 'A new isle every chapter' };
const SCENES = [
  { id: 'strike', stage: 0, weapon: 'hammer', lv: 3, warm: 20, sec: 3.2, card: true, cap: { ko: ['', '쾅! 한 방에 우르르'], en: ['', 'BONK! Off they go!'] } },
  { id: 'sledge', stage: 50, weapon: 'sledge', lv: 3, warm: 4, sec: 2.2, cap: { ko: [WEAPON.ko, '대형 해머 — 쿵!'], en: [WEAPON.en, 'Sledgehammer — THUD!'] } },
  { id: 'bat', stage: 15, weapon: 'bat', lv: 3, warm: 4, sec: 2.2, card: true, cap: { ko: [WEAPON.ko, '야구방망이 — 딱!'], en: [WEAPON.en, 'Bat — CRACK!'] } },
  { id: 'twin', stage: 62, weapon: 'twin', lv: 3, warm: 4, sec: 2.0, cap: { ko: [WEAPON.ko, '스펀지 쌍검 — 다다닥!'], en: [WEAPON.en, 'Foam Twins — whap-whap!'] } },
  { id: 'fan', stage: 3, weapon: 'fan', lv: 3, warm: 4, sec: 2.0, cap: { ko: [WEAPON.ko, '큰 부채 — 휘이잉~'], en: [WEAPON.en, 'Giant Fan — WHOOSH!'] } },
  { id: 'crumble', stage: 33, weapon: 'hammer', lv: 3, sec: 3.0, cap: { ko: ['버틸수록', '섬이 무너져요!'], en: ['Hold on tight —', 'the island crumbles!'] } },
  { id: 'isle1', stage: 80, weapon: 'hammer', lv: 3, warm: 6, sec: 1.0, cap: { ko: [ISLES.ko, null], en: [ISLES.en, null] } },
  { id: 'isle2', stage: 108, weapon: 'bat', lv: 3, warm: 6, sec: 1.0, cap: { ko: [ISLES.ko, null], en: [ISLES.en, null] } },
  { id: 'isle3', stage: 122, weapon: 'sledge', lv: 3, warm: 6, sec: 1.0, cap: { ko: [ISLES.ko, null], en: [ISLES.en, null] } },
  { id: 'isle4', stage: 140, weapon: 'hammer', lv: 3, warm: 6, sec: 1.0, cap: { ko: [ISLES.ko, null], en: [ISLES.en, null] } },
  { id: 'boss', stage: 45, weapon: 'hammer', lv: 3, warm: 66, sec: 5, card: true, cap: { ko: ['마지막엔 왕좀비 등장', '날려 보내면 보너스!'], en: ['Then the King Zombie shows up', 'Knock him off for a bonus!'] } },
  { id: 'cards', sec: 3.6, cap: { ko: ['판마다 다른 베스트 컷', '카드로 공유!'], en: ['A new best shot every run', 'Share it as a card!'] } },
  { id: 'end', sec: 3.0 },
];
const END = {
  ko: { title: '망치섬', sub: '쳐서 날려라! 하늘섬 망치 서바이벌' },
  en: { title: 'Tumble Isle', sub: 'Bonk the horde off your tiny island' },
};

// 바깥 화면(1920×1080): 하늘 배경·가운데 게임 iframe·왼쪽 자막·오른쪽 이름. 공유 카드·끝 장면은 #full이 덮는다
const PAGE = (lang) => `<!doctype html><meta charset="utf-8"><style>
body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:linear-gradient(#8fd3f0,#cfeefb 60%,#f3fbff);font-family:ui-rounded,"SF Pro Rounded",-apple-system,"Apple SD Gothic Neo",sans-serif}
.cloud{position:absolute;background:#fff;border-radius:99px;opacity:.75}
#game{position:absolute;left:${(W - GW) / 2}px;top:0;width:${GW}px;height:${H}px;border:0;box-shadow:0 0 0 8px #fffaf0,0 0 60px #1d4c6466}
.side{position:absolute;top:0;height:${H}px;width:${(W - GW) / 2}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
#left{left:0} #right{right:0}
.tag{display:inline-block;margin-bottom:22px;padding:10px 28px;border-radius:99px;background:#fffaf0;color:#1d4c64;font-size:34px;font-weight:900;box-shadow:0 5px 0 #e8dcc4}
.big{max-width:580px;font-size:72px;font-weight:900;color:#fff;letter-spacing:-1px;line-height:1.12;word-break:keep-all;text-shadow:0 4px 0 #2c6e8f,0 8px 0 #1d4c64,0 14px 24px #0006,-3px 0 0 #1d4c64,3px 0 0 #1d4c64}
#right img{width:150px;height:150px;border-radius:34px;box-shadow:0 8px 0 #0002,0 14px 30px #0004}
#right .name{margin-top:18px;font-size:60px;font-weight:900;color:#fff;letter-spacing:-2px;text-shadow:0 4px 0 #2c6e8f,0 8px 0 #1d4c64,0 14px 24px #0006}
#full{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(#8fd3f0,#cfeefb 60%,#f3fbff)}
#full .row{display:flex;gap:56px;align-items:center;margin-top:34px}
#full .card{height:700px;max-width:560px;border:8px solid #fffaf0;border-radius:22px;box-shadow:0 10px 0 #e8dcc4,0 22px 50px #0007}
#full .icon{width:220px;height:220px;border-radius:50px;box-shadow:0 10px 0 #0003,0 18px 36px #0005;margin-bottom:28px}
#full h1{font-size:150px;font-weight:900;color:#fff;letter-spacing:-4px;margin:0;line-height:1.05;text-shadow:0 6px 0 #2c6e8f,0 12px 0 #1d4c64,0 22px 36px #0007}
#full .sub{margin-top:26px;font-size:40px;font-weight:900;color:#1d4c64;background:#fffaf0;border-radius:60px;padding:12px 36px;box-shadow:0 6px 0 #e8dcc4}
</style>
<div class="cloud" style="left:70px;top:120px;width:260px;height:70px"></div><div class="cloud" style="left:380px;top:860px;width:200px;height:56px"></div>
<div class="cloud" style="right:90px;top:90px;width:220px;height:60px"></div><div class="cloud" style="right:330px;top:900px;width:280px;height:74px"></div>
<iframe id="game" src="${URL_BASE}?lang=${lang}"></iframe>
<div id="left" class="side"></div>
<div id="right" class="side"><img src="${icon}"><div class="name">${END[lang].title}</div></div>
<div id="full"></div>`;

// 바깥 화면 도우미: 자막 튀어나옴(처음 6프레임), 공유 카드 줄·끝 장면
const SIDE = () => {
  const left = document.getElementById('left'), full = document.getElementById('full');
  let last = '';
  window.__side = (tag, big, k) => {
    const html = big ? `${tag ? `<div class="tag">${tag}</div>` : ''}<div class="big">${big}</div>` : '';
    if (html !== last) { left.innerHTML = html; last = html; }
    const s = k < 6 ? 0.6 + 0.4 * Math.sin((k / 6) * Math.PI * 0.5) * 1.08 : 1;
    const b = left.querySelector('.big');
    if (b) { b.style.transform = `scale(${s})`; b.style.opacity = String(Math.min(1, k / 3 + 0.34)); }
  };
  window.__showCards = (urls) => { full.style.display = 'flex'; full.innerHTML = `<div class="row">${urls.map((u) => `<img class="card" src="${u}">`).join('')}</div>`; };
  window.__showEnd = (e, iconUrl) => { full.style.display = 'flex'; full.innerHTML = `<img class="icon" src="${iconUrl}"><h1>${e.title}</h1><div class="sub">${e.sub}</div>`; };
  window.__fullAnim = (k, kind) => { // 카드는 차례로 기울어 튀어 들어오고, 끝 장면은 아래에서 올라온다
    for (const [i, c] of [...full.querySelectorAll(kind === 'cards' ? '.card' : ':scope > *')].entries()) {
      const q = Math.max(0, Math.min(1, (k - i * 4) / 8));
      c.style.opacity = String(q);
      c.style.transform = kind === 'cards' ? `scale(${0.5 + 0.5 * q + Math.sin(q * Math.PI) * 0.1}) rotate(${(i - 1) * 4 * q}deg)` : `translateY(${(1 - q) * 50}px) scale(${0.8 + 0.2 * q})`;
    }
  };
};

// 그 스테이지의 무너짐 시각(main.ts defOf와 같은 씨앗)과 장 이름
const STAGE_INFO = async ([no, lang]) => {
  const CH = await import('/src/game/chapters.ts'), R = await import('/src/game/rules.ts');
  return { crumbles: CH.stageDef(no, R.seeded(no * 9973 + 17)).crumbles, chapter: CH.CHAPTERS[Math.floor(no / CH.STAGES_PER_CHAPTER)].name[lang === 'ko' ? 0 : 1] };
};
// 무너짐 장면 배치: 주인공은 새 가장자리 안쪽에, 적은 무너질 띠(새 반지름~지금 반지름)에 몰아 둔다
const SETUP_CRUMBLE = (rNew) => {
  const d = window.__demo, g = d.g;
  g.need = 1e9;
  g.lv.hammer = 3;
  const base = 0.9, pr = rNew - 3.2;
  g.px = Math.cos(base) * pr; g.pz = Math.sin(base) * pr;
  d.stress(26);
  g.enemies = g.enemies.filter((e) => !e.out && e.kind !== 'boss').slice(-26);
  g.enemies.forEach((e, i) => { const a = base + (((i * 0.618) % 1) - 0.5) * 1.1, r = rNew + 0.4 + ((i * 0.37) % 1) * (g.isl - rNew - 0.6); e.x = Math.cos(a) * r; e.z = Math.sin(a) * r; e.kx = e.kz = 0; e.hp = 1e9; e.age = 1; });
  d.freeze(); for (let i = 0; i < 50; i++) d.renderOnce();
  window.__acts = {};
  window.__vt = performance.now();
  return { isl: g.isl, rNew, n: g.enemies.length };
};

async function shoot(browser, lang, work) {
  const events = [], cards = [];
  let frame = 0, page, ctx, fr;
  const save = () => page.screenshot({ path: path.join(work, `${String(frame++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
  for (const sc of SCENES.filter((s) => s.stage !== undefined)) {
    ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, locale: lang === 'ko' ? 'ko-KR' : 'en-US' });
    await ctx.addInitScript(INIT, [...sc.id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) | 0);
    await ctx.addInitScript((m) => { if (location.protocol.startsWith('http')) { localStorage.setItem('meta', JSON.stringify(m)); localStorage.setItem('bonusSeen', '9'); } }, META);
    page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // 바깥 화면도 게임과 같은 주소에서 띄운다(about:blank 아래 iframe은 localStorage가 막혀 진행 상태가 안 들어감)
    const outer = `${URL_BASE}__store-video.html`;
    await page.route(outer, (r) => r.fulfill({ contentType: 'text/html', body: PAGE(lang) }));
    await page.goto(outer);
    await page.evaluate(SIDE);
    fr = await (await page.$('#game')).contentFrame();
    await fr.waitForFunction(() => window.__demo);
    await sleep(800);
    await fr.evaluate(HELPERS, [TOAST_OK, icon, { title: '', sub: '', store: '' }]);
    await fr.evaluate((w) => window.__demo.setWeapon(w), sc.weapon);
    await fr.evaluate((n) => window.__demo.goStage(n), sc.stage);
    await sleep(700);
    await fr.evaluate(() => document.querySelector('[data-act="start"]').click());
    await sleep(300);
    const st = await fr.evaluate(STAGE_INFO, [sc.stage, lang]);
    let info;
    if (sc.id === 'crumble') {
      const c = st.crumbles.find((x) => x.at >= 12 && x.at < 36); // 날씨·보너스 전에 오는 무너짐
      if (!c) throw new Error(`스테이지 ${sc.stage}에 쓸 만한 무너짐이 없음: ${JSON.stringify(st.crumbles)}`);
      await fr.evaluate((s) => window.__run(s), c.at - 1.2);
      info = await fr.evaluate(SETUP_CRUMBLE, c.r);
    } else {
      await fr.evaluate((s) => window.__run(s), sc.warm);
      info = await fr.evaluate(([id, lv]) => window.__setup(id, lv), [sc.id, sc.lv]);
    }
    console.log(lang, sc.id, st.chapter, JSON.stringify(info));
    const [tag, big] = sc.cap[lang];
    let n = Math.round(sc.sec * FPS);
    for (let k = 0; k < n; k++) {
      const ev = await fr.evaluate(([k, id]) => window.__frame(k, id), [k, sc.id]);
      await page.evaluate(([tag, big, k]) => window.__side(tag, big, k), [tag, big ?? st.chapter, k]);
      pushSounds(events, frame / FPS, ev);
      if (ev.fall && sc.id === 'crumble' && !events.some((e) => e[1] === 'rumble')) events.push([frame / FPS, 'rumble']);
      if (ev.boss) { n = k + 45; console.log(lang, '왕좀비 떨어짐', (k / FPS).toFixed(1), '초'); }
      await save();
    }
    if (sc.id === 'boss' && !(await fr.evaluate(() => window.__demo.g.bossDown))) throw new Error('왕좀비를 못 떨어뜨림');
    if (sc.card) { // 판을 여기서 끝내 그 순간까지의 베스트 컷 카드를 받는다
      const r = await fr.evaluate(() => { const d = window.__demo; d.end(true); return { url: d.card(), look: d.shotLook() }; });
      if (!r.url) throw new Error(`${sc.id} 장면의 공유 카드가 없음`);
      console.log(lang, sc.id, '카드', JSON.stringify(r.look));
      cards.push(r.url);
    }
    if (errors.length) console.warn(sc.id, '페이지 오류:', errors);
    if (sc.id !== 'boss') await ctx.close();
  }
  // 공유 카드 세 장 → 끝 장면(마지막 컨텍스트의 바깥 화면을 그대로 쓴다)
  for (const kind of ['cards', 'end']) {
    const sc = SCENES.find((s) => s.id === kind);
    await page.evaluate(([kind, cards, e, ic]) => (kind === 'cards' ? window.__showCards(cards) : window.__showEnd(e, ic)), [kind, cards, END[lang], icon]);
    await page.evaluate(() => Promise.all([...document.querySelectorAll('#full img')].map((i) => i.decode().catch(() => {}))));
    await page.evaluate(() => { document.getElementById('left').style.display = 'none'; document.getElementById('right').style.display = 'none'; });
    events.push([frame / FPS, kind === 'cards' ? 'chime' : 'fanfare']);
    const n = Math.round(sc.sec * FPS);
    for (let k = 0; k < n; k++) {
      await page.evaluate(([k, kind, cap]) => {
        window.__fullAnim(k, kind);
        const full = document.getElementById('full');
        if (cap && k === 0) full.insertAdjacentHTML('afterbegin', `<div><div class="tag">${cap[0]}</div></div><div class="big" style="max-width:none">${cap[1]}</div>`);
      }, [k, kind, sc.cap?.[lang]]);
      await save();
    }
  }
  await ctx.close();
  return { frames: frame, events };
}

const browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const lang of LANGS) {
    const work = mkdtempSync(path.join(os.tmpdir(), `store-${lang}-`));
    const { frames, events } = await shoot(browser, lang, work);
    const seconds = frames / FPS;
    writeFileSync(path.join(work, 'audio.wav'), mixAudio(seconds, events));
    const out = path.join(HERE, `tumble-isle-store-${lang}.mp4`);
    const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(work, '%05d.jpg'), '-i', path.join(work, 'audio.wav'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
    if (r.status) throw new Error('ffmpeg 실패');
    console.log('만듦:', path.relative(ROOT, out), `${frames}프레임 ${seconds.toFixed(1)}초, 소리 ${events.length}개`);
    rmSync(work, { recursive: true, force: true });
  }
} finally {
  await browser.close();
}
