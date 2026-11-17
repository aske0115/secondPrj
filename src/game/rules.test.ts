import { expect, test } from 'vitest';
import { CRUMBLES, FALL_CHARGE, ISLAND_R, KILL_CHARGE, MAX_LEVEL, RUN_SECONDS, UPGRADES, crumbleWarning, fallXp, islandRadius, killXp, pickUpgrades, spawnBatch, spawnInterval, startLevels, sweepCost } from './rules';

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

test('섬은 줄어들기만 하고, 끝까지 싸울 자리가 남는다', () => {
  expect(islandRadius(0)).toBe(ISLAND_R);
  for (let t = 1; t <= RUN_SECONDS; t++) expect(islandRadius(t)).toBeLessThanOrEqual(islandRadius(t - 1));
  expect(islandRadius(RUN_SECONDS)).toBeGreaterThanOrEqual(9);
  for (const c of CRUMBLES) expect(c.at).toBeLessThan(RUN_SECONDS);
});

test('무너지기 직전에만 경고한다', () => {
  expect(crumbleWarning(30)).toBe(-1);
  expect(crumbleWarning(CRUMBLES[0].at - 1)).toBe(0);
  expect(crumbleWarning(CRUMBLES[0].at)).toBe(-1);
  expect(crumbleWarning(CRUMBLES[1].at - 0.5)).toBe(1);
});

test('떨어뜨리기가 그냥 처치보다 보상이 크다', () => {
  expect(FALL_CHARGE).toBeGreaterThan(KILL_CHARGE);
  for (const big of [false, true]) expect(fallXp(big)).toBeGreaterThan(killXp(big));
});
