import { describe, expect, it } from 'vitest';
import { CAMS, MOODS, POSES, caption, judge, look, word } from './bestShot';

const base = { speed: 12, chain: 1, boss: false, big: false, src: 'main', homer: false, last: false };
describe('베스트 컷 순간 고르기', () => {
  it('왕좀비 > 홈런 > 쾅! > 여러 마리 > 마지막 > 보통 순으로 종류를 붙인다', () => {
    expect(judge({ ...base, boss: true, homer: true }).kind).toBe('boss');
    expect(judge({ ...base, homer: true, src: 'sweep' }).kind).toBe('homer');
    expect(judge({ ...base, src: 'sweep', chain: 4 }).kind).toBe('slam');
    expect(judge({ ...base, chain: 3 }).kind).toBe('multi');
    expect(judge({ ...base, last: true }).kind).toBe('last');
    expect(judge(base).kind).toBe('hit');
  });
  it('더 세게·더 많이·왕좀비일수록 점수가 높다', () => {
    expect(judge({ ...base, speed: 20 }).score).toBeGreaterThan(judge(base).score);
    expect(judge({ ...base, chain: 4 }).score).toBeGreaterThan(judge({ ...base, chain: 2 }).score);
    expect(judge({ ...base, boss: true, speed: 0 }).score).toBeGreaterThan(judge({ ...base, speed: 40, chain: 8, src: 'sweep' }).score);
  });
  it('캡션은 n으로 돌아가며 고르고, 쾅!은 무기와 상관없이 「쾅!」', () => {
    expect(caption('hit', 0)).not.toEqual(caption('hit', 1));
    expect(caption('last', 5)).toEqual(caption('last', 0));
    expect(word('sweep', 'bat')[0]).toBe('쾅!');
    expect(word('main', 'bat')[0]).toBe('딱!');
  });
});

describe('베스트 컷 다양성(결정 094)', () => {
  it('이웃한 번호끼리 앵글·자세·표정이 모두 다르고, 30장이면 모든 조합 요소가 나온다', () => {
    for (let n = 0; n < 30; n++) {
      const a = look(n), b = look(n + 1);
      expect(a.cam).not.toBe(b.cam);
      expect(a.pose).not.toBe(b.pose);
      expect(a.mood).not.toBe(b.mood);
    }
    const all = Array.from({ length: 30 }, (_, n) => look(n));
    expect(new Set(all.map((l) => l.cam)).size).toBe(CAMS);
    expect(new Set(all.map((l) => l.pose)).size).toBe(POSES);
    expect(new Set(all.map((l) => l.mood)).size).toBe(MOODS.length);
  });
  it('보통 타격은 표정 캡션이 섞이고, 왕좀비 캡션은 표정과 무관', () => {
    const caps = new Set(Array.from({ length: 12 }, (_, n) => caption('hit', n, 'cry')[0]));
    expect(caps.has('엄마아아~!')).toBe(true);
    expect(caption('boss', 0, 'cry')).toEqual(caption('boss', 0));
  });
});
