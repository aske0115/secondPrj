// 전술 퍼즐 규칙(결정 019). 화면을 모르는 순수 로직이라 테스트·풀이기·화면이 함께 쓴다.
//
// 한 턴: 내 차례(개마다 이동 ≤2칸 → 이웃 하나 밀기, 각각 생략 가능) → 늑대 차례(예고한 칸 물기 → 새 늑대 등장 → 이동·다음 예고)
// 늑대의 물기는 "늑대 앞 칸"이라, 늑대를 밀면 무는 칸도 함께 옮겨 간다. 이게 퍼즐의 핵심이다.

export type Dir = 0 | 1 | 2 | 3; // 위·오른쪽·아래·왼쪽
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

/** 지형: . 풀밭  # 바위  T 나무  ~ 강(밀려 들어간 늑대·양은 떠내려감) */
export type Tile = '.' | '#' | 'T' | '~';
export type Kind = 'dog' | 'wolf' | 'sheep';

export interface Unit {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  hp: number;
  /** 늑대가 보는 방향(앞 칸을 문다) */
  dir: Dir;
  /** 개: 이번 턴에 움직였나 / 밀었나(밀면 그 개의 차례는 끝) */
  moved: boolean;
  done: boolean;
}

export interface Spawn {
  /** 이 늑대 차례가 끝날 때 나타난다(그 전 턴부터 발자국으로 예고) */
  turn: number;
  x: number;
  y: number;
  dir: Dir;
}

export interface State {
  w: number;
  h: number;
  tiles: Tile[];
  units: Unit[];
  spawns: Spawn[];
  /** 지금 몇 번째 턴인지(1부터) */
  turn: number;
  /** 늑대 차례를 이만큼 버티면 끝 */
  turns: number;
  sheepTotal: number;
  over: null | 'won' | 'lost';
  nextId: number;
}

export const HP: Record<Kind, number> = { dog: 3, wolf: 2, sheep: 2 };
export const BITE = 2; // 물기 피해(양·늑대는 한 번에 쓰러짐)
export const BUMP = 1; // 부딪힘 피해
export const DOG_MOVE = 2;
export const WOLF_MOVE = 2;

export const tileAt = (s: State, x: number, y: number): Tile | null =>
  x < 0 || y < 0 || x >= s.w || y >= s.h ? null : s.tiles[y * s.w + x];
export const unitAt = (s: State, x: number, y: number) => s.units.find((u) => u.x === x && u.y === y);
const walkable = (t: Tile | null) => t === '.';

export function clone(s: State): State {
  return { ...s, tiles: s.tiles, spawns: s.spawns, units: s.units.map((u) => ({ ...u })) };
}

/** 무는 칸(늑대 앞) */
export function biteTarget(u: Unit) {
  return { x: u.x + DX[u.dir], y: u.y + DY[u.dir] };
}

function damage(s: State, u: Unit, n: number) {
  u.hp -= n;
  if (u.hp <= 0) s.units = s.units.filter((x) => x !== u);
}

// ── 내 차례

/** 개가 갈 수 있는 칸(제자리 제외). 풀밭으로만, 다른 유닛을 지나가지 못한다 */
export function reachable(s: State, dog: Unit): { x: number; y: number }[] {
  if (dog.moved || dog.done) return [];
  const seen = new Set([dog.y * s.w + dog.x]);
  let frontier = [{ x: dog.x, y: dog.y }];
  const out: { x: number; y: number }[] = [];
  for (let step = 0; step < DOG_MOVE; step++) {
    const next: { x: number; y: number }[] = [];
    for (const p of frontier)
      for (let d = 0; d < 4; d++) {
        const x = p.x + DX[d], y = p.y + DY[d];
        if (!walkable(tileAt(s, x, y)) || unitAt(s, x, y) || seen.has(y * s.w + x)) continue;
        seen.add(y * s.w + x);
        next.push({ x, y });
        out.push({ x, y });
      }
    frontier = next;
  }
  return out;
}

export function move(s: State, dogId: number, x: number, y: number): boolean {
  const dog = s.units.find((u) => u.id === dogId);
  if (!dog || dog.kind !== 'dog' || s.over) return false;
  if (!reachable(s, dog).some((p) => p.x === x && p.y === y)) return false;
  dog.x = x;
  dog.y = y;
  dog.moved = true;
  return true;
}

/** 이웃한 늑대·양을 밀 수 있는 방향들 */
export function pushTargets(s: State, dog: Unit): { unit: Unit; dir: Dir }[] {
  if (dog.done) return [];
  const out: { unit: Unit; dir: Dir }[] = [];
  for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
    const u = unitAt(s, dog.x + DX[d], dog.y + DY[d]);
    if (u && u.kind !== 'dog') out.push({ unit: u, dir: d });
  }
  return out;
}

export type Event =
  | { type: 'push'; id: number; dir: Dir }
  | { type: 'bump'; id: number; other?: number }
  | { type: 'swept'; id: number }
  | { type: 'bite'; id: number; x: number; y: number; victim?: number }
  | { type: 'spawn'; id: number }
  | { type: 'walk'; id: number };

/** 밀기: 밀린 쪽이 막혀 있으면 부딪혀 둘 다 다치고, 강이면 떠내려간다. 늑대의 방향은 그대로다 */
export function push(s: State, dogId: number, targetId: number, events: Event[] = []): boolean {
  const dog = s.units.find((u) => u.id === dogId);
  const t = s.units.find((u) => u.id === targetId);
  if (!dog || !t || dog.kind !== 'dog' || dog.done || s.over) return false;
  const d = pushTargets(s, dog).find((p) => p.unit.id === targetId)?.dir;
  if (d === undefined) return false;
  dog.done = true;
  dog.moved = true;
  shove(s, t, d, events);
  settle(s);
  return true;
}

function shove(s: State, t: Unit, d: Dir, events: Event[]) {
  const nx = t.x + DX[d], ny = t.y + DY[d];
  const tile = tileAt(s, nx, ny);
  const other = unitAt(s, nx, ny);
  events.push({ type: 'push', id: t.id, dir: d });
  if (tile === '~' && !other) {
    t.x = nx;
    t.y = ny;
    events.push({ type: 'swept', id: t.id });
    s.units = s.units.filter((u) => u !== t);
  } else if (tile === null || tile === '#' || tile === 'T' || other) {
    events.push({ type: 'bump', id: t.id, other: other?.id });
    damage(s, t, BUMP);
    if (other) damage(s, other, BUMP);
  } else {
    t.x = nx;
    t.y = ny;
  }
}

// ── 늑대 차례

/** 끝내기: 물기 → 등장 → 이동·예고. 화면이 차례로 보여 줄 수 있게 단계마다 상태를 돌려준다 */
export function endTurn(s0: State): { state: State; steps: { state: State; events: Event[] }[] } {
  const s = clone(s0);
  const steps: { state: State; events: Event[] }[] = [];
  const snap = (events: Event[]) => steps.push({ state: clone(s), events });

  // 1) 예고한 칸 물기(번호 순서대로, 앞서 쓰러진 늑대는 물지 못한다)
  for (const w of s.units.filter((u) => u.kind === 'wolf').sort((a, b) => a.id - b.id)) {
    if (!s.units.includes(w)) continue;
    const { x, y } = biteTarget(w);
    const victim = unitAt(s, x, y);
    if (victim) damage(s, victim, BITE);
    snap([{ type: 'bite', id: w.id, x, y, victim: victim?.id }]);
  }
  // 2) 예고된 늑대 등장(그 칸이 비어 있을 때만)
  const spawned: Event[] = [];
  for (const sp of s.spawns.filter((p) => p.turn === s.turn)) {
    if (unitAt(s, sp.x, sp.y) || !walkable(tileAt(s, sp.x, sp.y))) continue;
    const u: Unit = { id: s.nextId++, kind: 'wolf', x: sp.x, y: sp.y, hp: HP.wolf, dir: sp.dir, moved: false, done: false };
    s.units.push(u);
    spawned.push({ type: 'spawn', id: u.id });
  }
  if (spawned.length) snap(spawned);
  // 3) 늑대 이동과 다음 예고
  const walks: Event[] = [];
  for (const w of s.units.filter((u) => u.kind === 'wolf').sort((a, b) => a.id - b.id)) {
    if (wolfStep(s, w)) walks.push({ type: 'walk', id: w.id });
  }
  for (const u of s.units) {
    u.moved = false;
    u.done = false;
  }
  s.turn++;
  settle(s);
  snap(walks);
  return { state: s, steps };
}

/** 늑대: 가장 가까운 양(없으면 개) 쪽으로 최대 2칸, 그리고 그쪽을 바라본다 */
function wolfStep(s: State, w: Unit): boolean {
  for (const prey of ['sheep', 'dog'] as const) {
    const path = pathToAdjacent(s, w, prey);
    if (!path) continue;
    // path = [지금 자리, …, 먹잇감 옆 칸, 먹잇감]이라 옆 칸까지는 length − 2걸음
    const steps = Math.min(WOLF_MOVE, path.length - 2);
    const moved = steps > 0;
    if (moved) {
      w.x = path[steps].x;
      w.y = path[steps].y;
    }
    // 다음 칸(또는 먹잇감) 쪽을 본다
    const look = path[steps + 1] ?? path[path.length - 1];
    const fx = look.x - w.x, fy = look.y - w.y;
    for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) if (DX[d] === Math.sign(fx) && DY[d] === Math.sign(fy) && (fx === 0 || fy === 0)) w.dir = d;
    return moved;
  }
  return false;
}

/** 먹잇감과 이웃한 칸까지의 최단 경로(끝 칸 다음에 먹잇감 위치를 붙여 돌려준다). 같은 거리면 위·오른쪽·아래·왼쪽 순 */
function pathToAdjacent(s: State, w: Unit, prey: Kind) {
  const targets = s.units.filter((u) => u.kind === prey);
  if (!targets.length) return null;
  const key = (x: number, y: number) => y * s.w + x;
  const prev = new Map<number, number>([[key(w.x, w.y), -1]]);
  let frontier = [{ x: w.x, y: w.y }];
  while (frontier.length) {
    const next: { x: number; y: number }[] = [];
    for (const p of frontier) {
      for (let d = 0; d < 4; d++) {
        const x = p.x + DX[d], y = p.y + DY[d];
        const t = targets.find((u) => u.x === x && u.y === y);
        if (t) {
          const path = [{ x: t.x, y: t.y }];
          let k = key(p.x, p.y);
          while (k !== -1) {
            path.unshift({ x: k % s.w, y: Math.floor(k / s.w) });
            k = prev.get(k)!;
          }
          return path;
        }
        if (!walkable(tileAt(s, x, y)) || unitAt(s, x, y) || prev.has(key(x, y))) continue;
        prev.set(key(x, y), key(p.x, p.y));
        next.push({ x, y });
      }
    }
    frontier = next;
  }
  return null;
}

/** 승패 판정 */
function settle(s: State) {
  const sheep = s.units.filter((u) => u.kind === 'sheep').length;
  const dogs = s.units.filter((u) => u.kind === 'dog').length;
  const wolves = s.units.some((u) => u.kind === 'wolf') || s.spawns.some((p) => p.turn >= s.turn);
  if (sheep === 0 || dogs === 0) s.over = 'lost';
  // 늑대를 모두 물리치면(더 올 늑대도 없으면) 턴을 다 채우지 않아도 바로 이긴다
  else if (s.turn > s.turns || !wolves) s.over = 'won';
}

export const sheepLeft = (s: State) => s.units.filter((u) => u.kind === 'sheep').length;
/** 별: 양을 모두 지키면 3개, 하나 잃으면 2개, 그 이상이면 1개 */
export const stars = (s: State) => (s.over !== 'won' ? 0 : Math.max(1, 3 - (s.sheepTotal - sheepLeft(s))));

// ── 스테이지 데이터 → 상태

export interface StageData {
  id: string;
  name: { ko: string; en: string };
  /** 한 줄 안내(처음 몇 판에 규칙을 하나씩 소개) */
  tip?: { ko: string; en: string };
  turns: number;
  /** 지형 줄들. 유닛 글자: D 개, S 양, 늑대는 방향으로 ^ > v < (밑은 풀밭) */
  map: string[];
  spawns?: Spawn[];
}

export function fromStage(st: StageData): State {
  const h = st.map.length, w = st.map[0].length;
  const tiles: Tile[] = [];
  const units: Unit[] = [];
  let id = 1;
  const WOLF: Record<string, Dir> = { '^': 0, '>': 1, v: 2, '<': 3 };
  st.map.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === 'D' || c === 'S' || c in WOLF) {
        tiles.push('.');
        const kind: Kind = c === 'D' ? 'dog' : c === 'S' ? 'sheep' : 'wolf';
        units.push({ id: id++, kind, x, y, hp: HP[kind], dir: WOLF[c] ?? 0, moved: false, done: false });
      } else tiles.push(c as Tile);
    }),
  );
  return { w, h, tiles, units, spawns: st.spawns ?? [], turn: 1, turns: st.turns, sheepTotal: units.filter((u) => u.kind === 'sheep').length, over: null, nextId: id };
}
