// 사주·타로 운세 펫 프로토타입(결정 024). 계산은 fortune/saju.ts, 여기는 화면과 하루 한 번의 성장만.
import { L, T, lang, setLang } from './i18n';
import * as sfx from './audio';
import { petSvg, eggSvg, cardFaceSvg, cardBackSvg, svgImage, decoSvg } from './art';
import { runCatch, modsFor, type CatchResult } from './play/catch';
import decor from '../content/fortune/decor.json';
import messages from '../content/fortune/messages.json';
import tarot from '../content/fortune/tarot.json';
import {
  HANGUL, ELEMENTS, dailyFortune, dayKey, luckyElement, sajuProfile, tarotProfile, hash,
  type DailyFortune, type Element, type Profile,
} from './fortune/saju';

const app = document.getElementById('app')!;
const overlay = document.getElementById('overlay')!;
const TAROT_EL = tarot.cards.map((c) => c.el as Element);
const EL = messages.elements;
const CAT = messages.categories;
const elColor = (e: Element) => EL[e].color.hex;
const elName = (e: Element) => (lang === 'ko' ? `${EL[e].ko}(${EL[e].hanja})` : EL[e].en);

// ── 저장(생년월일은 기기 안에만, 서버로 보내지 않는다)
interface Save {
  profile: Profile | null;
  coins: number;
  streak: number;
  checkins: number;
  lastDay: string | null;
  pettedDay: string | null;
  /** 모은 기운(꾸미기에 씀)과 누적 기운(성장 단계) */
  ki: Record<Element, number>;
  kiTotal: number;
  playsDay: string | null;
  playsUsed: number;
  decor: string[];
}
const PLAYS_PER_DAY = 3;
const KEY = 'fortunePet.v1';
function loadSave(): Save {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s) return { ...fresh(), ...s };
  } catch {
    /* 깨진 저장은 새로 시작 */
  }
  return fresh();
}
function fresh(): Save {
  return {
    profile: null, coins: 0, streak: 0, checkins: 0, lastDay: null, pettedDay: null,
    ki: { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 }, kiTotal: 0, playsDay: null, playsUsed: 0, decor: [],
  };
}
function playsLeft() {
  return save.playsDay === dayKey(new Date()) ? Math.max(0, PLAYS_PER_DAY - save.playsUsed) : PLAYS_PER_DAY;
}
function stageOf(total: number) {
  let i = 0;
  decor.stages.forEach((st, k) => total >= st.need && (i = k));
  return i;
}
let save = loadSave();
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* 저장 실패 시 이번 실행에서만 유지 */
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const toast = (text: string) => {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2300);
};
const disclaimer = () => `<div class="disclaimer">${L('재미로 보는 운세예요 · 생년월일은 이 기기에만 저장돼요', 'For fun · Your birth info stays on this device')}</div>`;

// ── 화면: 처음
function welcome() {
  app.innerHTML = `
    <div class="topbar"><span></span><button class="link" id="lang">${lang === 'ko' ? 'English' : '한국어'}</button></div>
    <h1>${L('운명이 키우는 작은 친구', 'A little friend raised by fate')}</h1>
    <p class="sub">${L('당신의 기운으로 펫이 태어나고,<br>매일의 운세에 따라 자라요.', 'Your energy hatches a pet,<br>and each day’s fortune helps it grow.')}</p>
    <div class="egg">${eggSvg(130)}</div>
    <button class="btn gold" id="saju">${L('생년월일로 보기', 'Use my birth date')}<small>${L('사주팔자로 정확하게', 'Korean Saju, the four pillars')}</small></button>
    <button class="btn" id="tarot">${L('타로 카드 한 장 뽑기', 'Draw one tarot card')}<small>${L('입력 없이, 처음 뽑은 카드가 운명이 돼요', 'No input — your first card becomes your fate')}</small></button>
    ${disclaimer()}`;
  $('lang').onclick = () => setLang(lang === 'ko' ? 'en' : 'ko');
  $('saju').onclick = () => (sfx.unlockAudio(), sajuForm());
  $('tarot').onclick = () => (sfx.unlockAudio(), tarotDraw());
}

// ── 화면: 사주 입력
function sajuForm() {
  const hours = Array.from({ length: 24 }, (_, h) => `<option value="${h}">${String(h).padStart(2, '0')}:00 ~ ${String(h).padStart(2, '0')}:59</option>`).join('');
  app.innerHTML = `
    <div class="topbar"><button class="link" id="back">← ${L('뒤로', 'Back')}</button><span></span></div>
    <h1>${L('언제 태어났나요?', 'When were you born?')}</h1>
    <p class="sub">${L('양력 기준, 한국 표준시로 계산해요.', 'Solar calendar, Korea Standard Time.')}</p>
    <div class="paper">
      <label class="field">${L('생년월일', 'Birth date')}<input type="date" id="date" value="1995-06-15" min="1920-01-01" max="${dayKey(new Date())}"></label>
      <label class="field">${L('태어난 시각', 'Birth time')}
        <select id="hour"><option value="">${L('모름', 'I don’t know')}</option>${hours}</select></label>
      <div class="note">${L('시각을 모르면 시주(태어난 시의 두 글자)를 빼고 여섯 글자로 봐요.', 'Without a time we read six characters instead of eight.')}</div>
    </div>
    <button class="btn gold" id="go">${L('내 사주로 펫 깨우기', 'Hatch my pet')}</button>
    ${disclaimer()}`;
  $('back').onclick = welcome;
  $('go').onclick = () => {
    const v = ($('date') as HTMLInputElement).value;
    if (!v) return toast(L('생년월일을 골라 주세요', 'Pick your birth date'));
    const [y, m, d] = v.split('-').map(Number);
    const hv = ($('hour') as HTMLSelectElement).value;
    save.profile = sajuProfile(y, m, d, hv === '' ? null : Number(hv), 30);
    persist();
    born();
  };
}

// ── 화면: 타로 뽑기
function tarotDraw() {
  const n = 7;
  const cards = Array.from({ length: n }, (_, i) => {
    const a = (i - (n - 1) / 2) * 7;
    return `<div class="tcard" data-i="${i}" style="transform: translateX(${(i - (n - 1) / 2) * 38}px) rotate(${a}deg) translateY(${Math.abs(a) * 0.8}px)">${cardBackSvg(96)}</div>`;
  }).join('');
  app.innerHTML = `
    <div class="topbar"><button class="link" id="back">← ${L('뒤로', 'Back')}</button><span></span></div>
    <h1>${L('마음이 끌리는 카드 한 장', 'Pick the card that calls you')}</h1>
    <p class="sub">${L('처음 뽑은 카드가 당신의 운명 카드가 돼요.<br>다시 뽑을 수 없어요.', 'Your first card becomes your fate card.<br>There are no redraws.')}</p>
    <div class="spread">${cards}</div>
    ${disclaimer()}`;
  $('back').onclick = welcome;
  // 뽑은 순간의 시각으로 카드를 정한다(같은 자리를 눌러도 사람마다 다르게)
  app.querySelectorAll<HTMLElement>('.tcard').forEach((el) =>
    el.addEventListener('click', () => {
      sfx.sparkle();
      sfx.buzz(20);
      const card = hash(`${Date.now()}-${el.dataset.i}-${Math.random()}`) % tarot.cards.length;
      save.profile = tarotProfile(card, TAROT_EL[card]);
      persist();
      reveal(card);
    }),
  );
}

function cardFace(n: number) {
  const c = tarot.cards[n];
  const el = c.el as Element;
  return `<div class="face">${cardFaceSvg(n, el, lang === 'ko' ? c.ko : c.en, 210)}</div>
    <p class="sub" style="margin:4px 0 8px"><b style="color:#fff">${T(c.kw)}</b><br>${L('기운', 'Element')}: ${elName(el)}</p>`;
}

function reveal(card: number) {
  app.innerHTML = `
    <h1>${L('당신의 운명 카드', 'Your fate card')}</h1>
    ${cardFace(card)}
    <p class="sub">${L('이 카드의 기운으로 펫이 깨어나요.', 'Your pet awakens from this card’s energy.')}</p>
    <button class="btn gold" id="go">${L('펫 만나러 가기', 'Meet my pet')}</button>`;
  $('go').onclick = born;
}

// ── 화면: 펫 탄생(내 기운 보기)
function pillarsHtml(p: Profile) {
  const labels = lang === 'ko' ? ['년', '월', '일', '시'] : ['Year', 'Month', 'Day', 'Hour'];
  const GAN_EL: Record<string, Element> = { 甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth', 己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water' };
  const ZHI_EL: Record<string, Element> = { 寅: 'wood', 卯: 'wood', 巳: 'fire', 午: 'fire', 辰: 'earth', 戌: 'earth', 丑: 'earth', 未: 'earth', 申: 'metal', 酉: 'metal', 亥: 'water', 子: 'water' };
  const ch = (c: string, e: Element) => `<div class="ch" style="background:${elColor(e)}">${c}<small>${HANGUL[c]}</small></div>`;
  // 오른쪽부터 년·월·일·시로 읽는 전통 배치 대신, 처음 보는 사람도 읽기 쉽게 왼쪽부터
  return `<div class="pillars">${p.pillars!.map((x, i) => `<div class="pillar"><div class="lbl">${labels[i]}</div>${
    x ? ch(x.gan, GAN_EL[x.gan]) + ch(x.zhi, ZHI_EL[x.zhi]) : '<div class="ch none">?<small>&nbsp;</small></div><div class="ch none">?<small>&nbsp;</small></div>'
  }</div>`).join('')}</div>`;
}

function barsHtml(p: Profile) {
  const max = Math.max(...Object.values(p.counts), 1);
  return `<div class="bars">${ELEMENTS.map((e) => `<div class="bar" style="height:${(p.counts[e] / max) * 100}%;background:${elColor(e)}"><span>${lang === 'ko' ? EL[e].ko : EL[e].en} ${p.counts[e]}</span></div>`).join('')}</div>`;
}

function born() {
  const p = save.profile!;
  const pet = EL[p.self].pet;
  const lucky = luckyElement(p);
  app.innerHTML = `
    <h1>${L('펫이 태어났어요!', 'Your pet hatched!')}</h1>
    <div class="stage"><div class="glow" style="background:${elColor(p.self)}"></div><div class="pet hatch">${petSvg(p.self, 190)}</div></div>
    <div class="petname"><b>${T(pet)}</b> · ${T(pet.trait)}</div>
    <div class="paper">
      ${p.source === 'saju'
        ? `<h2>${L('나의 사주', 'My four pillars')}</h2>${pillarsHtml(p)}
           <div class="note">${L(`나를 나타내는 글자(일간)는 <b>${p.dayGan}(${HANGUL[p.dayGan!]})</b>, ${EL[p.self].ko}의 기운이에요.`, `Your self character is <b>${p.dayGan}</b>, the ${EL[p.self].en} element.`)}</div>`
        : `<h2>${L('나의 운명 카드', 'My fate card')}</h2><div class="note">${L(`<b>${tarot.cards[p.card!].ko}</b> — ${EL[p.self].ko}의 기운`, `<b>${tarot.cards[p.card!].en}</b> — ${EL[p.self].en} energy`)}</div>`}
      <h2 style="margin-top:14px">${L('다섯 기운', 'Five elements')}</h2>${barsHtml(p)}
      <div class="note" style="margin-top:24px">${L(`가장 부족한 기운은 <b>${EL[lucky].ko}</b>. 이 기운이 들어오는 날이 행운의 날이에요.`, `Your missing piece is <b>${EL[lucky].en}</b>. Days carrying it are your lucky days.`)}</div>
    </div>
    <button class="btn gold" id="go">${L('오늘의 운세 보기', 'See today’s fortune')}</button>`;
  sfx.finale();
  $('go').onclick = home;
}

// ── 화면: 홈(오늘의 운세와 펫)
let fortune: DailyFortune;
function checkIn() {
  const today = dayKey(new Date());
  if (save.lastDay === today) return false;
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  save.streak = save.lastDay === yesterday ? save.streak + 1 : 1;
  save.lastDay = today;
  save.checkins++;
  save.coins += 10 + (fortune.category === 'wealth' ? 10 : 0);
  persist();
  return true;
}

function fortuneLine(f: DailyFortune) {
  const lines = CAT[f.category].lines;
  return T(lines[f.seed % lines.length]);
}

function home() {
  const p = save.profile!;
  fortune = dailyFortune(p, new Date(), TAROT_EL);
  const first = checkIn();
  const pet = EL[p.self].pet;
  const lucky = luckyElement(p);
  const stage = stageOf(save.kiTotal);
  const st = decor.stages[stage];
  const nextSt = decor.stages[stage + 1];
  const growPct = nextSt ? ((save.kiTotal - st.need) / (nextSt.need - st.need)) * 100 : 100;
  // 펫 둘레 자리: [가로 중심 %, 바닥에서 px, 앞줄 여부]. 뒷줄은 펫 뒤, 앞줄은 펫 발치 앞에 그려 깊이감을 준다
  const SLOTS: [number, number, boolean][] = [[9, 100, false], [25, 116, false], [8, 6, true], [23, -2, true], [37, -10, true], [63, -10, true], [77, -2, true], [92, 6, true], [75, 116, false], [91, 100, false]];
  const d = new Date();
  const dateText = lang === 'ko' ? `${d.getMonth() + 1}월 ${d.getDate()}일` : d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  const todayText = p.source === 'saju'
    ? `${fortune.todayGanZhi}(${HANGUL[fortune.todayGanZhi![0]]}${HANGUL[fortune.todayGanZhi![1]]})${L('일', ' day')}`
    : `${L('오늘의 카드', 'Card')}: ${lang === 'ko' ? tarot.cards[fortune.todayCard!].ko : tarot.cards[fortune.todayCard!].en}`;
  const tag = p.source === 'saju'
    ? L(`오늘은 ${fortune.shiShen!.ko}의 날`, `${fortune.shiShen!.en} day`)
    : L(`${EL[fortune.todayElement].ko}의 기운이 오는 날`, `${EL[fortune.todayElement].en} day`);
  app.innerHTML = `
    <div class="topbar"><span>${dateText} · ${todayText}</span><span><button class="link" id="mine">${L('내 운명', 'My fate')}</button><button class="link" id="lang">${lang === 'ko' ? 'EN' : '한'}</button></span></div>
    <div class="stage" id="stage"><div class="glow" style="background:${elColor(p.self)}"></div>
      ${save.decor.map((id) => {
        const it = decor.items.find((x) => x.id === id)!;
        const big = it.cost > 20;
        const [x, y, front] = SLOTS[it.slot];
        return `<div class="deco" style="left:${x}%;bottom:${y}px;z-index:${front ? 3 : 0}">${decoSvg(id, big ? 68 : 54)}</div>`;
      }).join('')}
      <div class="pet" id="pet">${petSvg(p.self, Math.round(170 * st.scale))}</div>
      <div class="say">${T(CAT[fortune.category].pet)}</div></div>
    <div class="petname"><b>${T(pet)}</b> · ${T(st)}${nextSt ? `<div class="grow"><b style="width:${growPct}%"></b></div><small>${L(`다음 단계 ${T(nextSt)}까지 기운 ${nextSt.need - save.kiTotal}`, `${nextSt.need - save.kiTotal} energy to ${T(nextSt)}`)}</small>` : ''}</div>
    <div class="paper today">
      <div class="head"><h2 style="margin:0">${T(CAT[fortune.category].title)}</h2><span class="stars">${'★'.repeat(fortune.score)}${'☆'.repeat(5 - fortune.score)}</span></div>
      <div class="cat">${tag}</div>
      <div class="line">${esc(fortuneLine(fortune))}</div>
      <div class="lucky">
        <div><span class="swatch" style="background:${EL[lucky].color.hex}"></span>${L('행운의 색', 'Lucky color')}<br><b>${T(EL[lucky].color)}</b></div>
        <div>${L('행운의 숫자', 'Lucky numbers')}<br><b>${EL[lucky].numbers.join(' · ')}</b></div>
      </div>
    </div>
    <div class="stats"><span>🪙 <b>${save.coins}</b></span><span>🔥 <b>${save.streak}</b>${L('일 연속', '-day streak')}</span><span>📅 <b>${save.checkins}</b>${L('일', save.checkins === 1 ? ' day' : ' days')}</span></div>
    <div class="ki">${ELEMENTS.map((e) => `<span><i style="background:${elColor(e)};color:${elColor(e)}"></i>${save.ki[e]}</span>`).join('')}</div>
    <button class="btn gold" id="play" ${playsLeft() ? '' : 'disabled'}>${L('오늘의 기운 모으기', 'Gather today’s energy')}<span class="badge">${playsLeft()}/${PLAYS_PER_DAY}</span>
      <small>${T(modsFor(fortune.category).label)}</small></button>
    <div class="row2"><button class="btn" id="shop">${L('꾸미기', 'Decorate')}</button><button class="btn" id="share">${L('운세 카드 공유', 'Share card')}</button></div>
    ${disclaimer()}`;
  $('lang').onclick = () => setLang(lang === 'ko' ? 'en' : 'ko');
  $('mine').onclick = born;
  $('share').onclick = shareCard;
  $('play').onclick = startCatch;
  $('shop').onclick = shopSheet;
  $('pet').onclick = (e) => petTap(e as MouseEvent);
  if (first) setTimeout(() => toast(L(`오늘 출석! 🪙 +${fortune.category === 'wealth' ? 20 : 10}`, `Checked in! 🪙 +${fortune.category === 'wealth' ? 20 : 10}`)), 400);
}

async function startCatch() {
  if (!playsLeft()) return;
  sfx.unlockAudio();
  const p = save.profile!;
  const img = await svgImage(petSvg(p.self, 240));
  runCatch({ lucky: luckyElement(p), category: fortune.category, pet: img, L, onEnd: (r) => catchResult(r) });
}

function catchResult(r: CatchResult) {
  const today = dayKey(new Date());
  if (save.playsDay !== today) {
    save.playsDay = today;
    save.playsUsed = 0;
  }
  save.playsUsed++;
  const before = stageOf(save.kiTotal);
  let gained = 0;
  for (const e of ELEMENTS) {
    save.ki[e] += r.ki[e];
    gained += r.ki[e];
  }
  save.kiTotal += gained;
  save.coins += r.coins;
  persist();
  const grown = stageOf(save.kiTotal) > before;
  sfx.finale();
  overlay.innerHTML = `<div class="paper result" style="width:100%;max-width:420px">
    <h2>${L('기운을 모았어요!', 'Energy gathered!')}</h2>
    <div class="big">${r.score}</div>
    <div class="note">${L(`최고 콤보 ${r.bestCombo} · 금화 🪙 +${r.coins}`, `Best combo ${r.bestCombo} · Coins 🪙 +${r.coins}`)}</div>
    <div class="ki" style="color:var(--ink)">${ELEMENTS.map((e) => `<span style="background:#efe5cf"><i style="background:${elColor(e)};color:${elColor(e)}"></i>+${r.ki[e]}</span>`).join('')}</div>
    ${grown ? `<h2 style="color:#c98a12;margin-top:12px">${L(`펫이 ${T(decor.stages[stageOf(save.kiTotal)])}(으)로 자랐어요!`, `Your pet grew into a ${T(decor.stages[stageOf(save.kiTotal)])}!`)}</h2>` : ''}
  </div>
  <div class="row" style="margin-top:10px">${playsLeft() ? `<button class="btn gold" id="ov-again">${L(`한 판 더 (${playsLeft()})`, `Again (${playsLeft()})`)}</button>` : ''}<button class="btn" id="ov-home">${L('펫에게 가기', 'Back to pet')}</button></div>`;
  overlay.hidden = false;
  $('ov-home').onclick = () => ((overlay.hidden = true), home());
  if (playsLeft()) $('ov-again').onclick = () => ((overlay.hidden = true), home(), startCatch());
}

function shopSheet() {
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  const draw = () => {
    sheet.innerHTML = `<div class="head" style="display:flex;justify-content:space-between;align-items:center"><h2>${L('펫의 정원 꾸미기', 'Decorate the garden')}</h2><button class="link" id="sh-close" style="color:#8a7a62">${L('닫기', 'Close')}</button></div>
      <div class="ki" style="color:var(--ink)">${ELEMENTS.map((e) => `<span style="background:#efe5cf"><i style="background:${elColor(e)};color:${elColor(e)}"></i>${save.ki[e]}</span>`).join('')}</div>
      <div class="shop">${decor.items.map((it) => {
        const el = it.el as Element;
        const owned = save.decor.includes(it.id);
        const can = save.ki[el] >= it.cost;
        return `<div class="item">${decoSvg(it.id, 64)}<b>${T(it)}</b><br><span style="color:${elColor(el)}">●</span> ${elName(el)} ${it.cost}
          <button data-id="${it.id}" ${owned || !can ? 'disabled' : ''}>${owned ? L('놓았어요', 'Placed') : can ? L('놓기', 'Place') : L('기운 부족', 'Need more')}</button></div>`;
      }).join('')}</div>`;
    sheet.querySelector('#sh-close')!.addEventListener('click', () => (sheet.remove(), home()));
    sheet.querySelectorAll<HTMLButtonElement>('.item button').forEach((b) =>
      b.addEventListener('click', () => {
        const it = decor.items.find((x) => x.id === b.dataset.id)!;
        save.ki[it.el as Element] -= it.cost;
        save.decor.push(it.id);
        persist();
        sfx.sparkle();
        sfx.buzz(15);
        toast(L(`${it.ko}을(를) 놓았어요!`, `${it.en} placed!`));
        draw();
      }),
    );
  };
  draw();
  document.body.appendChild(sheet);
}

function petTap(e: MouseEvent) {
  sfx.unlockAudio();
  sfx.click();
  sfx.buzz(10);
  const stage = $('stage');
  const r = stage.getBoundingClientRect();
  const h = document.createElement('div');
  h.className = 'heart';
  h.textContent = ['💗', '✨', '💛', '🌟'][Math.floor(Math.random() * 4)];
  h.style.left = `${e.clientX - r.left - 10}px`;
  h.style.top = `${e.clientY - r.top - 20}px`;
  stage.appendChild(h);
  setTimeout(() => h.remove(), 1000);
  const today = dayKey(new Date());
  if (save.pettedDay !== today) {
    save.pettedDay = today;
    save.coins += 5;
    persist();
    toast(L('쓰다듬기 보너스 🪙 +5', 'Petting bonus 🪙 +5'));
    setTimeout(home, 900);
  }
}

// ── 공유 카드(인스타 스토리 비율 1080×1350)
async function shareCard() {
  const p = save.profile!;
  const pet = EL[p.self].pet;
  const lucky = luckyElement(p);
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a2550');
  g.addColorStop(1, '#1c1a33');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    c.fillStyle = `rgba(255,255,255,${0.2 + ((i * 37) % 60) / 100})`;
    c.beginPath();
    c.arc((i * 97) % W, (i * 53) % 700, 1.5 + (i % 3), 0, Math.PI * 2);
    c.fill();
  }
  const font = (w: number, s: number) => `${w} ${s}px -apple-system, "Apple SD Gothic Neo", sans-serif`;
  c.textAlign = 'center';
  c.fillStyle = '#b9b2d6';
  c.font = font(500, 40);
  c.fillText(dayKey(new Date()).replace(/-/g, '. '), W / 2, 120);
  c.fillStyle = elColor(p.self);
  c.globalAlpha = 0.35;
  c.beginPath();
  c.arc(W / 2, 380, 210, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
  c.drawImage(await svgImage(petSvg(p.self, 380)), W / 2 - 190, 190, 380, 380);
  c.fillStyle = '#fff';
  c.font = font(700, 50);
  c.fillText(T(pet), W / 2, 650);
  // 종이 카드
  c.fillStyle = '#f7f0e1';
  roundRect(c, 90, 720, W - 180, 470, 40);
  c.fill();
  c.fillStyle = '#3a2d22';
  c.font = font(800, 58);
  c.fillText(T(CAT[fortune.category].title), W / 2, 820);
  c.fillStyle = '#e3b45a';
  c.font = font(400, 54);
  c.fillText('★'.repeat(fortune.score) + '☆'.repeat(5 - fortune.score), W / 2, 895);
  c.fillStyle = '#3a2d22';
  c.font = font(500, 40);
  wrap(c, fortuneLine(fortune), W / 2, 980, W - 280, 58);
  c.fillStyle = '#7a6a55';
  c.font = font(500, 34);
  c.fillText(`${L('행운의 색', 'Lucky color')} ${T(EL[lucky].color)} · ${L('숫자', 'Numbers')} ${EL[lucky].numbers.join(', ')}`, W / 2, 1140);
  c.fillStyle = '#b9b2d6';
  c.font = font(600, 36);
  c.fillText(L('운명이 키우는 작은 친구 · Daeun.dev', 'A friend raised by fate · Daeun.dev'), W / 2, 1270);
  const url = cv.toDataURL('image/png');
  overlay.innerHTML = `<img src="${url}" alt=""><div class="hint">${L('이미지를 길게 눌러 저장하거나 공유하세요', 'Long-press the image to save or share')}</div>
    <div class="row"><button class="btn gold" id="ov-share">${L('공유', 'Share')}</button><button class="btn" id="ov-close">${L('닫기', 'Close')}</button></div>`;
  overlay.hidden = false;
  $('ov-close').onclick = () => (overlay.hidden = true);
  $('ov-share').onclick = async () => {
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], 'fortune.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else toast(L('이 기기에서는 길게 눌러 저장해 주세요', 'Long-press the image to save'));
    } catch {
      /* 공유 취소 */
    }
  };
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function wrap(c: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  // 한글은 글자 단위, 영어는 단어 단위로 줄을 나눈다
  const tokens = lang === 'ko' ? [...text] : text.split(/(?<= )/);
  let line = '';
  for (const t of tokens) {
    if (c.measureText(line + t).width > max && line) {
      c.fillText(line.trim(), x, y);
      y += lh;
      line = t;
    } else line += t;
  }
  c.fillText(line.trim(), x, y);
}

function $(id: string) {
  return document.getElementById(id)!;
}

// 시작
if (save.profile) home();
else welcome();

// 개발용 훅
Object.assign(window, {
  __demo: {
    reset: () => (localStorage.removeItem(KEY), location.reload()),
    morePlays: () => ((save.playsUsed = 0), persist(), home()),
    giveKi: (n = 50) => (ELEMENTS.forEach((e) => (save.ki[e] += n)), (save.kiTotal += n * 5), persist(), home()),
    save: () => save,
    fortuneOn: (y: number, m: number, d: number) => save.profile && dailyFortune(save.profile, new Date(y, m - 1, d), TAROT_EL),
  },
});
