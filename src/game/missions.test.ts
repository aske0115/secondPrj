import { expect, test } from 'vitest';
import { MISSIONS, fillMissions, isDone, missionById, type RunStats } from './missions';

const zero: RunStats = { falls: 0, kills: 0, strikes: 0, juggles: 0, opened: 0, slams: 0, time: 0, boss: 0, level: 0 };

test('미션 id는 겹치지 않는다', () => {
  expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
});

test('빈자리를 3개까지 채우고, 같은 종류는 하나씩, 남은 미션은 그대로 둔다', () => {
  for (let seed = 0; seed < 50; seed++) {
    const r = ((s) => () => ((s = (s * 16807) % 2147483647) / 2147483647))(seed + 1);
    const ms = fillMissions(['falls15', '없는미션'], r);
    expect(ms).toHaveLength(3);
    expect(ms[0]).toBe('falls15');
    expect(new Set(ms.map((id) => missionById(id)!.stat)).size).toBe(3);
  }
});

test('목표에 닿아야 달성', () => {
  expect(isDone('falls15', { ...zero, falls: 14 })).toBe(false);
  expect(isDone('falls15', { ...zero, falls: 15 })).toBe(true);
  expect(isDone('boss1', { ...zero, boss: 1 })).toBe(true);
  expect(isDone('없는미션', { ...zero, falls: 99 })).toBe(false);
});
