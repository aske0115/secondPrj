import { expect, test } from 'vitest';
import { CAPSULE_COST, CAPSULE_REFUND, PERK_MAX, buy, coinsFor, freshMeta, loadMeta, perkCost, rollCapsule } from './meta';

test('사면 코인이 줄고 레벨이 오르며, 돈이 모자라거나 최대면 못 산다', () => {
  const m = { ...freshMeta(), coins: perkCost('shove', 0) };
  const after = buy(m, 'shove')!;
  expect(after.coins).toBe(0);
  expect(after.perks.shove).toBe(1);
  expect(m.perks.shove).toBe(0); // 원래 값은 그대로
  expect(buy(after, 'shove')).toBeNull();

  const rich = { ...freshMeta(), coins: 1e9 };
  rich.perks.vigor = PERK_MAX.vigor;
  expect(buy(rich, 'vigor')).toBeNull();
});

test('값은 레벨마다 오른다', () => {
  for (let lv = 1; lv < 5; lv++) expect(perkCost('charge', lv)).toBeGreaterThan(perkCost('charge', lv - 1));
});

test('이기면 더 받고, 뒤 섬일수록 더 받는다', () => {
  expect(coinsFor(50, 10, true, 0)).toBeGreaterThan(coinsFor(50, 10, false, 0));
  expect(coinsFor(50, 10, false, 2)).toBeGreaterThan(coinsFor(50, 10, false, 0));
});

test('깨진 저장값은 처음 상태로, 범위 밖 값은 잘라서 불러온다', () => {
  expect(loadMeta('{망가짐', 3)).toEqual(freshMeta());
  expect(loadMeta(null, 3)).toEqual(freshMeta());
  const m = loadMeta(JSON.stringify({ coins: -5, cleared: 99, perks: { vigor: 9, shove: 2.7, charge: 'x' } }), 3);
  expect(m).toEqual({ ...freshMeta(), coins: 0, cleared: 3, perks: { ...freshMeta().perks, vigor: PERK_MAX.vigor, shove: 2 } });
});

test('빠진 강화(지혜)에 쓴 코인은 돌려준다', () => {
  const m = loadMeta(JSON.stringify({ coins: 10, perks: { wisdom: 2 } }), 3);
  expect(m.coins).toBe(10 + 40 + Math.round(40 * 2 ** 2.8));
  expect('wisdom' in m.perks).toBe(false);
});

test('캡슐: 새 캐릭터는 얻고, 이미 있으면 일부 돌려받고, 돈이 모자라면 못 돌린다', () => {
  expect(rollCapsule({ ...freshMeta(), coins: CAPSULE_COST - 1 })).toBeNull();
  const first = rollCapsule({ ...freshMeta(), coins: CAPSULE_COST }, () => 0)!;
  expect(first.dup).toBe(false);
  expect(first.meta.chars).toContain(first.got);
  expect(first.meta.coins).toBe(0);
  const again = rollCapsule({ ...first.meta, coins: CAPSULE_COST }, () => 0)!;
  expect(again.dup).toBe(true);
  expect(again.meta.coins).toBe(CAPSULE_REFUND);
  expect(again.meta.chars).toEqual(first.meta.chars);
});

test('저장값의 캐릭터·미션은 모르는 값을 버리고 기본 캐릭터는 늘 가진다', () => {
  const m = loadMeta(JSON.stringify({ chars: ['orc', 'dragon'], hero: 'dragon', missions: ['falls15', 3] }), 3);
  expect(m.chars).toEqual(['human', 'orc']);
  expect(m.hero).toBe('human');
  expect(m.missions).toEqual(['falls15']);
});
