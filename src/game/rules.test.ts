import { expect, test } from 'vitest';
import { ATTACKS, xpNeed, BONUS_AT, BONUS_SECONDS, DROPS, DROP_FALL, FIRST_DROP, STAGES, pickDrop, dashSpeed, hammerArc, hammerCooldown, logInterval, pumpkinInterval, FALL_CHARGE, ISLAND_R, KILL_CHARGE, MAX_LEVEL, RUN_SECONDS, UPGRADES, crumbleWarning, fallXp, islandRadius, killXp, pickUpgrades, spawnBatch, spawnInterval, startLevels, sweepCost } from './rules';

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

test('스킬은 레벨이 오를수록 자주·넓게, 망치는 반원을 넘지 않는다', () => {
  for (let lv = 2; lv <= MAX_LEVEL; lv++) {
    expect(hammerCooldown(lv)).toBeLessThan(hammerCooldown(lv - 1));
    expect(logInterval(lv)).toBeLessThan(logInterval(lv - 1));
    expect(pumpkinInterval(lv)).toBeLessThan(pumpkinInterval(lv - 1));
  }
  expect(hammerArc(MAX_LEVEL)).toBeLessThanOrEqual(Math.PI);
});

test('보너스는 판 안에서 끝나고, 무너짐 경고와 겹치지 않는다', () => {
  expect(BONUS_AT).toBeLessThan(RUN_SECONDS);
  for (const st of STAGES) for (const c of st.crumbles) expect(Math.abs(c.at - BONUS_AT)).toBeGreaterThan(3);
  expect(BONUS_SECONDS).toBeGreaterThan(5);
});

test('짧게 스친 손가락은 돌진이 아니고, 길게 튕길수록 빠르되 상한이 있다', () => {
  expect(dashSpeed(5)).toBe(0);
  expect(dashSpeed(100)).toBeGreaterThan(dashSpeed(40));
  expect(dashSpeed(5000)).toBe(24);
});

test('낙하산: 체력이 가득이면 회복은 안 나오고, 아니면 모든 종류가 나올 수 있다', () => {
  const seen = (hpFull: boolean) => new Set(Array.from({ length: 40 }, (_, i) => pickDrop(hpFull, () => (i % 10) / 10)));
  expect(seen(true).has('heart')).toBe(false);
  expect(seen(false).size).toBe(DROPS.length);
  expect(FIRST_DROP + DROP_FALL).toBeLessThan(BONUS_AT);
});

test('레벨업은 공격 스킬 위주: 매번 하나 이상, 전체로는 패시브보다 훨씬 자주', () => {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let attack = 0, passive = 0;
  for (let i = 0; i < 2000; i++) {
    const picks = pickUpgrades(startLevels(), true, rand);
    expect(picks.some((id) => ATTACKS.includes(id as never))).toBe(true);
    for (const id of picks) ATTACKS.includes(id as never) ? attack++ : passive++;
  }
  expect(attack).toBeGreaterThan(passive * 2.5);
});

test('필요 경험치는 레벨마다 더 크게 는다', () => {
  for (let l = 2; l < 40; l++) expect(xpNeed(l) - xpNeed(l - 1)).toBeGreaterThanOrEqual(xpNeed(l - 1) - xpNeed(l - 2));
});
