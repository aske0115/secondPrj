import { expect, test } from 'vitest';
import { PERK_MAX, buy, coinsFor, freshMeta, loadMeta, perkCost } from './meta';

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
  expect(m).toEqual({ coins: 0, cleared: 3, perks: { vigor: PERK_MAX.vigor, shove: 2, charge: 0, wisdom: 0 } });
});
