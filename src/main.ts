// 전술 퍼즐 프로토타입 화면(결정 019). 규칙은 game/rules.ts, 여기는 그리기·입력·연출만.
import { L, T, lang, setLang } from './i18n';
import * as sfx from './audio';
import { Tutorial } from './ui/tutorial';
import {
  biteTarget, endTurn, fromStage, move, push, pushTargets, reachable, sheepLeft, stars, clone,
  DX, DY, type Event, type State, type StageData, type Unit,
} from './game/rules';

const STAGES = Object.entries(import.meta.glob('../content/stages/*.json', { eager: true, import: 'default' }) as Record<string, StageData>)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, v]) => v);

const $ = (id: string) => document.getElementById(id)!;
const boardEl = $('board');
const hintEl = $('hint');
const tipEl = $('tip');
const resultEl = $('result');
const undoBtn = $('undo') as HTMLButtonElement;
const restartBtn = $('restart') as HTMLButtonElement;
const endBtn = $('end') as HTMLButtonElement;
const prevBtn = $('prev') as HTMLButtonElement;
const nextBtn = $('next') as HTMLButtonElement;
const langBtn = $('lang') as HTMLButtonElement;

undoBtn.textContent = L('↶ 되돌리기', '↶ Undo');
restartBtn.textContent = L('⟲ 처음부터', '⟲ Restart');
endBtn.textContent = L('턴 끝내기', 'End turn');
langBtn.textContent = lang === 'ko' ? 'English' : '한국어';
langBtn.onclick = () => setLang(lang === 'ko' ? 'en' : 'ko');
const helpBtn = $('help') as HTMLButtonElement;
helpBtn.textContent = L('규칙 보기', 'How to play');

const FACE = { dog: '🐕', wolf: '🐺', sheep: '🐑' } as const;
const ARROW = ['▲', '▶', '▼', '◀'];

// ── 진행 저장(스테이지별 최고 별)
const best: Record<string, number> = (() => {
  try {
    return JSON.parse(localStorage.getItem('best') ?? '{}');
  } catch {
    return {};
  }
})();
function saveBest(id: string, n: number) {
  if ((best[id] ?? 0) >= n) return;
  best[id] = n;
  try {
    localStorage.setItem('best', JSON.stringify(best));
  } catch {
    /* 저장 실패는 무시 */
  }
}

// ── 상태
let index = Math.min(Number(new URLSearchParams(location.search).get('stage') ?? 1) - 1, STAGES.length - 1) || 0;
let state: State;
let history: State[] = [];
let selected: number | null = null;
let busy = false;
let cell = 64;
const unitEls = new Map<number, HTMLDivElement>();

function load(i: number) {
  index = i;
  state = fromStage(STAGES[i]);
  history = [];
  selected = null;
  busy = false;
  resultEl.hidden = true;
  boardEl.innerHTML = '';
  unitEls.clear();
  const st = STAGES[i];
  $('stage-name').textContent = `${i + 1}. ${T(st.name)}`;
  tipEl.hidden = !st.tip;
  if (st.tip) tipEl.textContent = '💡 ' + T(st.tip);
  prevBtn.disabled = i === 0;
  nextBtn.disabled = i === STAGES.length - 1;
  layout();
  autoSelect();
  render();
}

function layout() {
  const wrap = $('board-wrap').getBoundingClientRect();
  cell = Math.floor(Math.min((wrap.width - 4) / state.w, (wrap.height - 4) / state.h, 86));
  document.documentElement.style.setProperty('--cell', `${cell}px`);
  boardEl.style.width = `${cell * state.w}px`;
  boardEl.style.height = `${cell * state.h}px`;
  boardEl.querySelectorAll('.tile').forEach((t) => t.remove());
  for (let y = 0; y < state.h; y++)
    for (let x = 0; x < state.w; x++) {
      const t = document.createElement('div');
      const k = state.tiles[y * state.w + x];
      t.className = 'tile ' + (k === '~' ? 'river' : (x + y) % 2 ? 'g2' : 'g1');
      t.textContent = k === '#' ? '🪨' : k === 'T' ? '🌲' : '';
      place(t, x, y, false);
      boardEl.prepend(t);
    }
}

function place(el: HTMLElement, x: number, y: number, viaTransform = true) {
  if (viaTransform) el.style.transform = `translate(${x * cell}px, ${y * cell}px)`;
  else {
    el.style.left = `${x * cell}px`;
    el.style.top = `${y * cell}px`;
  }
}

// ── 그리기
function render(s: State = state, showMarks = true) {
  boardEl.querySelectorAll('.mark').forEach((m) => m.remove());
  const alive = new Set(s.units.map((u) => u.id));
  for (const [id, el] of unitEls)
    if (!alive.has(id) && !el.classList.contains('gone')) {
      el.classList.add('gone');
      setTimeout(() => el.remove(), 400);
    }
  for (const u of s.units) renderUnit(u);

  if (!showMarks || s.over) return updateUi(s);
  // 늑대가 물 칸
  for (const w of s.units.filter((u) => u.kind === 'wolf')) {
    const t = biteTarget(w);
    if (t.x < 0 || t.y < 0 || t.x >= s.w || t.y >= s.h) continue;
    mark('bite', t.x, t.y);
  }
  // 다음에 나타날 늑대
  for (const sp of s.spawns.filter((p) => p.turn === s.turn)) mark('paw', sp.x, sp.y, '🐾');
  // 고른 개가 갈 수 있는 칸과 밀 수 있는 방향
  const dog = s.units.find((u) => u.id === selected);
  if (dog && !busy) {
    for (const p of reachable(s, dog)) mark('reach', p.x, p.y);
    for (const p of pushTargets(s, dog)) mark('push', p.unit.x, p.unit.y, ARROW[p.dir]);
  }
  updateUi(s);
}

function renderUnit(u: Unit) {
  let el = unitEls.get(u.id);
  if (!el) {
    el = document.createElement('div');
    el.className = `unit ${u.kind}`;
    el.innerHTML = `<span class="face">${FACE[u.kind]}</span><span class="hp"></span>${u.kind === 'wolf' ? '<span class="arrow"></span>' : ''}`;
    boardEl.appendChild(el);
    unitEls.set(u.id, el);
    el.style.transition = 'none';
    place(el, u.x, u.y);
    void el.offsetWidth;
    el.style.transition = '';
  }
  place(el, u.x, u.y);
  el.classList.toggle('sel', u.id === selected);
  el.classList.toggle('done', u.kind === 'dog' && u.done);
  const max = { dog: 3, wolf: 2, sheep: 2 }[u.kind];
  el.querySelector('.hp')!.innerHTML = Array.from({ length: max }, (_, i) => `<i class="${i < u.hp ? '' : 'off'}"></i>`).join('');
  const arrow = el.querySelector<HTMLElement>('.arrow');
  if (arrow) {
    arrow.textContent = ARROW[u.dir];
    const off = cell * 0.44; // 칸 가장자리에 붙여 체력 점과 겹치지 않게
    arrow.style.transform = `translate(${DX[u.dir] * off}px, ${DY[u.dir] * off}px)`;
  }
}

function mark(kind: string, x: number, y: number, text = '') {
  const m = document.createElement('div');
  m.className = `mark ${kind}`;
  m.textContent = text;
  place(m, x, y, false);
  boardEl.appendChild(m);
  return m;
}

function updateUi(s: State) {
  const shown = Math.min(s.turn, s.turns);
  $('status').textContent = `${L('턴', 'Turn')} ${shown}/${s.turns} · 🐑 ${sheepLeft(s)}/${s.sheepTotal}` + (best[STAGES[index].id] ? ` · ${'★'.repeat(best[STAGES[index].id])}` : '');
  undoBtn.disabled = busy || history.length === 0;
  endBtn.disabled = busy || !!s.over;
  restartBtn.disabled = busy;
  if (busy) hintEl.textContent = L('늑대 차례…', 'Wolves are moving…');
  else if (s.over) hintEl.textContent = '';
  else if (selected) {
    const dog = s.units.find((u) => u.id === selected)!;
    hintEl.textContent = dog.moved
      ? L('화살표가 뜬 이웃을 누르면 그쪽으로 밀어요', 'Tap a neighbor with an arrow to push it')
      : L('흰 점으로 이동하거나, 화살표가 뜬 이웃을 밀어요', 'Move to a white dot, or push a neighbor with an arrow');
  } else hintEl.textContent = L('개를 눌러 고르거나 턴을 끝내세요', 'Tap a dog, or end your turn');
}

function autoSelect() {
  const next = state.units.find((u) => u.kind === 'dog' && !u.done);
  selected = next?.id ?? null;
}

// ── 입력
boardEl.addEventListener('pointerdown', (e) => {
  sfx.unlockAudio();
  if (busy || state.over) return;
  const r = boardEl.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / cell), y = Math.floor((e.clientY - r.top) / cell);
  const u = state.units.find((v) => v.x === x && v.y === y);
  const dog = state.units.find((v) => v.id === selected);
  if (tutorial.blocks({ tile: [x, y] })) return;

  if (u?.kind === 'dog') {
    selected = selected === u.id ? null : u.done ? null : u.id;
    if (u.done) toast(L('이 개는 이번 턴에 할 일을 마쳤어요', 'This dog is done for the turn'));
    return render();
  }
  if (dog && !u && reachable(state, dog).some((p) => p.x === x && p.y === y)) {
    history.push(clone(state));
    move(state, dog.id, x, y);
    sfx.click();
    render();
    return tutorial.notify({ tile: [x, y] });
  }
  if (dog && u && pushTargets(state, dog).some((p) => p.unit.id === u.id)) {
    history.push(clone(state));
    const events: Event[] = [];
    push(state, dog.id, u.id, events);
    playEvents(events);
    sfx.buzz(18);
    autoSelect();
    render();
    tutorial.notify({ tile: [x, y] });
    if (state.over) setTimeout(showResult, 500);
    return;
  }
  selected = null;
  render();
});

function playEvents(events: Event[]) {
  for (const ev of events) {
    const el = unitEls.get(ev.id);
    if (ev.type === 'bump') {
      sfx.thud();
      el?.classList.add('hit');
      setTimeout(() => el?.classList.remove('hit'), 320);
      if (ev.other !== undefined) {
        const o = unitEls.get(ev.other);
        o?.classList.add('hit');
        setTimeout(() => o?.classList.remove('hit'), 320);
      }
    }
    if (ev.type === 'swept') sfx.splash();
    if (ev.type === 'push') sfx.click();
    if (ev.type === 'bite') {
      sfx.snap();
      const m = mark('flash', ev.x, ev.y);
      setTimeout(() => m.remove(), 460);
      if (ev.victim !== undefined) {
        const v = unitEls.get(ev.victim);
        v?.classList.add('hit');
        setTimeout(() => v?.classList.remove('hit'), 320);
        sfx.buzz(25);
      }
    }
  }
}

undoBtn.onclick = () => {
  if (tutorial.blocks('other')) return;
  const prev = history.pop();
  if (!prev || busy) return;
  state = prev;
  autoSelect();
  // 되돌릴 때 사라졌던 유닛이 다시 생기도록 요소를 새로 만든다
  for (const [, el] of unitEls) el.remove();
  unitEls.clear();
  render();
};
restartBtn.onclick = () => !tutorial.blocks('other') && load(index);
prevBtn.onclick = () => !tutorial.blocks('other') && index > 0 && load(index - 1);
nextBtn.onclick = () => !tutorial.blocks('other') && index < STAGES.length - 1 && load(index + 1);
helpBtn.onclick = () => !busy && tutorial.start();

endBtn.onclick = async () => {
  if (busy || state.over || tutorial.blocks('end')) return;
  busy = true;
  selected = null;
  render(state, false);
  const { state: after, steps } = endTurn(state);
  for (const step of steps) {
    await wait(380);
    render(step.state, false);
    playEvents(step.events);
  }
  await wait(250);
  state = after;
  history = [];
  busy = false;
  autoSelect();
  render();
  tutorial.notify('end');
  if (state.over) setTimeout(showResult, 300);
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function showResult() {
  if (tutorial.active) return; // 튜토리얼 중에는 안내가 다음으로 이어 준다
  const won = state.over === 'won';
  const n = stars(state);
  if (won) {
    saveBest(STAGES[index].id, n);
    sfx.finale();
  } else sfx.fail();
  const hasNext = index < STAGES.length - 1;
  resultEl.innerHTML = won
    ? `<h2>${L('양을 지켰어요!', 'Flock saved!')}</h2><div class="stars">${'★'.repeat(n)}${'☆'.repeat(3 - n)}</div>
       <p>${n < 3 ? L('모든 양을 지키면 별 3개예요', 'Save every sheep for 3 stars') : L('완벽해요', 'Perfect')}</p>
       <div class="row"><button class="pill" id="r-again">${L('다시', 'Retry')}</button>${hasNext ? `<button class="pill gold" id="r-next">${L('다음', 'Next')}</button>` : ''}</div>`
    : `<h2>${L('양을 잃었어요', 'The flock is lost')}</h2><p>${L('되돌리기로 한 수 전으로 가거나 처음부터 다시 해 보세요', 'Undo a move, or start over')}</p>
       <div class="row"><button class="pill gold" id="r-again">${L('다시', 'Retry')}</button></div>`;
  resultEl.hidden = false;
  $('r-again').onclick = () => load(index);
  if (won && hasNext) $('r-next').onclick = () => load(index + 1);
  updateUi(state);
}

let toastTimer = 0;
function toast(text: string) {
  hintEl.textContent = text;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => updateUi(state), 1500);
}

let resizeTimer = 0;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    layout();
    for (const [, el] of unitEls) el.remove();
    unitEls.clear();
    render();
  }, 80);
});

const tutorial = new Tutorial({
  load,
  tileRect: (x, y) => {
    const r = boardEl.getBoundingClientRect();
    return new DOMRect(r.left + x * cell, r.top + y * cell, cell, cell);
  },
});

// 처음 실행하면 튜토리얼부터(주소에 stage를 준 개발·촬영용 실행은 제외)
if (!Tutorial.done() && !new URLSearchParams(location.search).has('stage')) tutorial.start();
else load(index);

// 개발·촬영용 훅
Object.assign(window, { __demo: { state: () => state, load: (n: number) => load(n - 1), tutorial: () => tutorial.start() } });
