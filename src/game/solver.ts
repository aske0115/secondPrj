// 풀이기: 스테이지가 풀리는지, 별 3개가 가능한지, 아무것도 안 하면 지는지를 검사한다(content:check).
// 늑대 차례는 정해진 규칙대로라 내 차례의 경우만 펼치면 된다. 턴마다 점수 높은 상태만 남기는 빔 탐색.
import { clone, endTurn, move, push, pushTargets, reachable, sheepLeft, stars, type State } from './rules';

export interface Action {
  dog: number;
  to?: { x: number; y: number };
  push?: number;
}

/** 내 차례에 할 수 있는 모든 조합(개 순서도 바꿔 본다) */
export function playerTurns(s: State): { state: State; actions: Action[] }[] {
  const dogs = s.units.filter((u) => u.kind === 'dog').map((u) => u.id);
  const orders = permutations(dogs);
  const out = new Map<string, { state: State; actions: Action[] }>();
  const go = (st: State, order: number[], i: number, acts: Action[]) => {
    if (i === order.length) {
      const k = hash(st);
      if (!out.has(k)) out.set(k, { state: st, actions: acts });
      return;
    }
    const dog = st.units.find((u) => u.id === order[i]);
    if (!dog) return go(st, order, i + 1, acts);
    const spots = [null, ...reachable(st, dog)];
    for (const to of spots) {
      const a = clone(st);
      if (to) move(a, dog.id, to.x, to.y);
      const d = a.units.find((u) => u.id === dog.id)!;
      go(a, order, i + 1, [...acts, { dog: dog.id, to: to ?? undefined }]);
      for (const p of pushTargets(a, d)) {
        const b = clone(a);
        push(b, dog.id, p.unit.id);
        go(b, order, i + 1, [...acts, { dog: dog.id, to: to ?? undefined, push: p.unit.id }]);
      }
    }
  };
  for (const o of orders) go(clone(s), o, 0, []);
  return [...out.values()];
}

function permutations(a: number[]): number[][] {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
}

export const hash = (s: State) =>
  s.turn + '|' + s.units.map((u) => `${u.id}:${u.x},${u.y},${u.hp},${u.dir},${u.moved ? 1 : 0}${u.done ? 1 : 0}`).sort().join(';');

/** 늑대 차례가 끝난 뒤 상태가 얼마나 좋은지(다음 턴 위협까지 본다) */
function score(s: State) {
  let v = sheepLeft(s) * 1000;
  for (const u of s.units) {
    if (u.kind === 'dog') v += u.hp * 20;
    if (u.kind === 'wolf') v -= 60 + u.hp * 10;
  }
  return v;
}

export interface Solution {
  stars: number;
  /** 턴마다 한 일 */
  turns: Action[][];
  explored: number;
}

export function solve(start: State, beam = 250): Solution {
  let layer = [{ state: start, path: [] as Action[][] }];
  let best: Solution = { stars: 0, turns: [], explored: 0 };
  let explored = 0;
  while (layer.length) {
    const next = new Map<string, { state: State; path: Action[][]; score: number }>();
    for (const node of layer) {
      for (const p of playerTurns(node.state)) {
        explored++;
        const after = endTurn(p.state).state;
        const path = [...node.path, p.actions];
        if (after.over === 'won') {
          const st = stars(after);
          if (st > best.stars) best = { stars: st, turns: path, explored };
          if (st === 3) return { ...best, explored };
          continue;
        }
        if (after.over === 'lost') continue;
        const k = hash(after);
        const sc = score(after);
        const prev = next.get(k);
        if (!prev || prev.score < sc) next.set(k, { state: after, path, score: sc });
      }
    }
    layer = [...next.values()].sort((a, b) => b.score - a.score).slice(0, beam);
  }
  return { ...best, explored };
}

/** 아무것도 안 하고 턴만 넘겼을 때의 별(0이면 지는 판) */
export function idleStars(start: State) {
  let s = start;
  while (!s.over) s = endTurn(s).state;
  return stars(s);
}
