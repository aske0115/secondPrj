import { describe, expect, it } from 'vitest';
import { biteTarget, endTurn, fromStage, move, push, reachable, unitAt, type StageData } from './rules';

const stage = (map: string[], turns = 1, extra: Partial<StageData> = {}): StageData => ({ id: 't', name: { ko: '시험', en: 'Test' }, turns, map, ...extra });

describe('규칙', () => {
  it('개는 풀밭으로 2칸까지, 다른 유닛·바위·강을 지나가지 못한다', () => {
    const s = fromStage(stage(['.....', '.#D~.', '.....']));
    const dog = s.units.find((u) => u.kind === 'dog')!;
    const cells = reachable(s, dog).map((p) => `${p.x},${p.y}`).sort();
    expect(cells).toContain('2,0');
    expect(cells).toContain('1,0');
    expect(cells).not.toContain('3,1'); // 강
    expect(cells).not.toContain('1,1'); // 바위
    expect(cells).not.toContain('4,1'); // 강 너머
  });

  it('늑대를 밀면 무는 칸도 함께 옮겨 가서, 다른 늑대를 물게 만들 수 있다', () => {
    // 늑대 A(아래를 봄)를 오른쪽으로 밀면 A의 앞 칸이 늑대 B가 된다
    const s = fromStage(stage(['Dv...', '..>..', '.S..S'], 3));
    const [dog, a, b] = [s.units[0], s.units[1], s.units[2]];
    expect(biteTarget(a)).toEqual({ x: 1, y: 1 });
    expect(push(s, dog.id, a.id)).toBe(true);
    expect(a.x).toBe(2);
    expect(biteTarget(a)).toEqual({ x: 2, y: 1 });
    const { state } = endTurn(s);
    expect(state.units.find((u) => u.id === b.id)).toBeUndefined(); // B는 물려 쓰러짐
  });

  it('강으로 밀린 늑대는 떠내려가고, 막힌 쪽으로 밀리면 둘 다 1씩 다친다', () => {
    const s = fromStage(stage(['D<~', 'D<#', '.S.'], 3));
    const [d1, w1, d2, w2] = s.units;
    push(s, d1.id, w1.id);
    expect(s.units.find((u) => u.id === w1.id)).toBeUndefined();
    push(s, d2.id, w2.id);
    expect(s.units.find((u) => u.id === w2.id)!.hp).toBe(1);
  });

  it('개가 무는 칸을 막으면 양 대신 개가 물린다', () => {
    const s = fromStage(stage(['.D...', 'v....', '.....', 'S....'], 3));
    const [dog, wolf, sheep] = s.units;
    // 늑대는 (0,2)를 문다. 양은 (0,3)이라 아직 안전하지만, 늑대가 다가오면 다음 턴에 위험
    expect(biteTarget(wolf)).toEqual({ x: 0, y: 2 });
    expect(move(s, dog.id, 0, 2)).toBe(false); // 3칸이라 못 감
    expect(move(s, dog.id, 1, 2)).toBe(true);
    const { state } = endTurn(s);
    expect(state.units.find((u) => u.id === sheep.id)).toBeDefined();
    // 늑대는 양 옆으로 다가와 양을 바라본다
    const w = state.units.find((u) => u.id === wolf.id)!;
    expect(biteTarget(w)).toEqual({ x: 0, y: 3 });
  });

  it('예고된 늑대는 그 턴 늑대 차례 끝에 나타난다', () => {
    const s = fromStage(stage(['D....', '.....', 'S....'], 3, { spawns: [{ turn: 1, x: 4, y: 0, dir: 3 }] }));
    const { state } = endTurn(s);
    expect(state.units.filter((u) => u.kind === 'wolf').length).toBe(1);
    expect(unitAt(state, 4, 0) ?? state.units.find((u) => u.kind === 'wolf')).toBeDefined();
  });

  it('정해진 턴을 버티면 이기고, 양을 모두 잃으면 진다', () => {
    const win = endTurn(fromStage(stage(['D....', '.....', 'S....'], 1))).state;
    expect(win.over).toBe('won');
    const lose = endTurn(fromStage(stage(['D....', 'v....', 'S....'], 3))).state;
    expect(lose.over).toBe('lost');
  });
});
