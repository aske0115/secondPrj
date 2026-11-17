import { expect, test } from 'vitest';
import { STAGES, FALL_CHARGE, ISLAND_R, KILL_CHARGE, MAX_LEVEL, RUN_SECONDS, UPGRADES, crumbleWarning, fallXp, islandRadius, killXp, pickUpgrades, spawnBatch, spawnInterval, startLevels, sweepCost } from './rules';

test('시간이 갈수록 적이 더 자주·더 많이 나오고, 간격은 0이 되지 않는다', () => {
  for (let t = 1; t <= RUN_SECONDS; t++) {
    expect(spawnInterval(t)).toBeLessThanOrEqual(spawnInterval(t - 1));
    expect(spawnBatch(t)).toBeGreaterThanOrEqual(spawnBatch(t - 1));
    expect(spawnInterval(t)).toBeGreaterThan(0);
  }
});

test('레벨업 선택지는 서로 다른 3개이고, 다 올린 강화와 필요 없는 회복은 나오지 않는다', () => {
  const lv = startLevels();
  const first = pickUpgrades(lv, true);
  expect(new Set(first).size).toBe(3);
  expect(first).not.toContain('heart');

  for (const id of UPGRADES) lv[id] = MAX_LEVEL;
  expect(pickUpgrades(lv, true)).toEqual([]);
  expect(pickUpgrades(lv, false)).toEqual(['heart']);
});

test('쓸어내기 충전량은 끝까지 올려도 양수다', () => {
  expect(sweepCost(MAX_LEVEL)).toBeGreaterThan(0);
});

test.each(STAGES.map((st, i) => [i, st] as const))('섬 %i: 줄어들기만 하고, 끝까지 싸울 자리가 남고, 무너짐 전에 경고한다', (_, st) => {
  const cs = st.crumbles;
  expect(islandRadius(0, cs)).toBe(ISLAND_R);
  for (let t = 1; t <= RUN_SECONDS; t++) expect(islandRadius(t, cs)).toBeLessThanOrEqual(islandRadius(t - 1, cs));
  expect(islandRadius(RUN_SECONDS, cs)).toBeGreaterThanOrEqual(8);
  cs.forEach((c, k) => {
    expect(c.at).toBeLessThan(RUN_SECONDS);
    expect(crumbleWarning(c.at - 1, cs)).toBe(k);
    expect(crumbleWarning(c.at, cs)).toBe(-1);
    if (k) expect(c.at - cs[k - 1].at).toBeGreaterThan(10); // 경고가 겹치지 않게
  });
  expect(crumbleWarning(cs[0].at - 10, cs)).toBe(-1);
});

test('뒤 섬일수록 어렵다', () => {
  for (let i = 1; i < STAGES.length; i++)
    for (const k of ['spawn', 'big', 'hp', 'speed'] as const) expect(STAGES[i][k]).toBeGreaterThanOrEqual(STAGES[i - 1][k]);
});

test('떨어뜨리기가 그냥 처치보다 보상이 크다', () => {
  expect(FALL_CHARGE).toBeGreaterThan(KILL_CHARGE);
  for (const big of [false, true]) expect(fallXp(big)).toBeGreaterThan(killXp(big));
});
