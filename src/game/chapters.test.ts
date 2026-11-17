import { expect, test } from 'vitest';
import { CHAPTERS, RULE_TOUGH, STAGE_COUNT, allModels, stageDef } from './chapters';
import { BONUS_AT, BOSS_AT, seeded } from './rules';

const def = (no: number) => stageDef(no, seeded(no * 9973 + 17));

test('장 10개 × 15 = 150스테이지, 같은 번호는 늘 같은 스테이지', () => {
  expect(CHAPTERS.length).toBe(10);
  expect(STAGE_COUNT).toBe(150);
  expect(def(37)).toEqual(def(37));
});

test('모든 스테이지: 섬 크기·무너짐이 안전한 범위이고 보너스·왕좀비와 겹치지 않는다', () => {
  for (let no = 0; no < STAGE_COUNT; no++) {
    const s = def(no);
    expect(s.r).toBeGreaterThanOrEqual(9.5);
    expect(s.r).toBeLessThanOrEqual(13);
    let prev = s.r;
    for (const c of s.crumbles) {
      expect(c.r).toBeLessThan(prev);
      expect(c.r).toBeGreaterThanOrEqual(8.4);
      expect(Math.abs(c.at - BONUS_AT)).toBeGreaterThan(4);
      expect(Math.abs(c.at - BOSS_AT)).toBeGreaterThan(4);
      prev = c.r;
    }
  }
});

test('뒤 스테이지일수록 어렵다(장 처음끼리 비교, 장 규칙 보정은 빼고)', () => {
  const plain = (ch: number, k: 'spawn' | 'big' | 'hp' | 'speed' | 'dmg') =>
    def(ch * 15)[k] / (k === 'spawn' || k === 'dmg' ? RULE_TOUGH[CHAPTERS[ch].rule ?? ''] ?? 1 : 1);
  for (let ch = 1; ch < CHAPTERS.length; ch++)
    for (const k of ['spawn', 'big', 'hp', 'speed', 'dmg'] as const) expect(plain(ch, k)).toBeGreaterThan(plain(ch - 1, k));
});

test('장 규칙 4개: 규칙이 있는 장은 안내 문구가 한국어·영어 둘 다 있다(결정 078)', () => {
  const ruled = CHAPTERS.filter((c) => c.rule);
  expect(ruled.map((c) => c.rule).sort()).toEqual(['ice', 'lowGrav', 'springs', 'wind2']);
  for (const c of ruled) expect(c.ruleText?.every((t) => t.length > 0)).toBe(true);
});

test('장에서 쓰는 모델 파일이 모두 저장소에 있다', () => {
  const files = new Set(Object.keys(import.meta.glob('/public/models/**/*.{glb,obj}')));
  for (const m of allModels()) expect(files.has(`/public/models/${m}.glb`) || files.has(`/public/models/${m}.obj`), m).toBe(true);
});
