// 사주 계산이 만세력 기준과 맞는지 정답표로 고정한다(공신력 = 일관성, 결정 024).
// 콘텐츠(content/fortune)가 갈래·오행·한영을 빠짐없이 갖췄는지도 함께 검사한다(content:check).
import { describe, expect, it } from 'vitest';
import messages from '../../content/fortune/messages.json';
import tarot from '../../content/fortune/tarot.json';
import { ELEMENTS, dailyFortune, luckyElement, relation, sajuProfile, tarotProfile, type Category, type Element } from './saju';

const pillars = (p: ReturnType<typeof sajuProfile>) => p.pillars!.map((x) => (x ? x.gan + x.zhi : '?')).join(' ');
const tarotEls = tarot.cards.map((c) => c.el as Element);

describe('사주 정답표', () => {
  it('2000-01-01 12시 → 기묘년 병자월 무오일 무오시', () => {
    expect(pillars(sajuProfile(2000, 1, 1, 12, 0))).toBe('己卯 丙子 戊午 戊午');
  });
  it('1900-01-01은 갑술일', () => {
    expect(sajuProfile(1900, 1, 1, 12, 0).pillars![2]).toEqual({ gan: '甲', zhi: '戌' });
  });
  it('입춘(2024-02-04 16:27) 전은 계묘년, 후는 갑진년', () => {
    expect(sajuProfile(2024, 2, 4, 10, 0).pillars![0]).toEqual({ gan: '癸', zhi: '卯' });
    expect(sajuProfile(2024, 2, 4, 18, 0).pillars![0]).toEqual({ gan: '甲', zhi: '辰' });
  });
  it('2024년 설날(2024-02-10)은 갑진일', () => {
    expect(sajuProfile(2024, 2, 10, 12, 0).pillars![2]).toEqual({ gan: '甲', zhi: '辰' });
  });
  it('태어난 시각을 모르면 시주 없이 여섯 글자로 센다', () => {
    const p = sajuProfile(2000, 1, 1, null);
    expect(p.pillars![3]).toBeNull();
    expect(Object.values(p.counts).reduce((a, b) => a + b, 0)).toBe(6);
    expect(p.self).toBe('earth'); // 일간 戊
  });
});

describe('오행 관계', () => {
  it('나무 기준: 같으면 친구, 불은 표현, 흙은 재물, 쇠는 일, 물은 배움', () => {
    const r = (t: Element) => relation('wood', t);
    expect([r('wood'), r('fire'), r('earth'), r('metal'), r('water')]).toEqual(['friend', 'express', 'wealth', 'work', 'learn']);
  });
  it('사주 운세의 갈래는 십신 표와 오행 관계가 같은 답을 낸다', () => {
    const p = sajuProfile(1990, 5, 5, 9, 30);
    for (let i = 0; i < 60; i++) {
      const d = new Date(2026, 0, 1 + i);
      const f = dailyFortune(p, d, tarotEls);
      expect(f.category).toBe(relation(p.self, f.todayElement));
    }
  });
  it('같은 날 같은 사람은 항상 같은 운세', () => {
    const p = tarotProfile(17, 'wood');
    const d = new Date(2026, 10, 16);
    expect(dailyFortune(p, d, tarotEls)).toEqual(dailyFortune(p, d, tarotEls));
  });
  it('점수는 1~5, 행운의 기운은 가장 적은 오행', () => {
    const p = sajuProfile(2000, 1, 1, 12, 0);
    expect(p.counts[luckyElement(p)]).toBe(Math.min(...Object.values(p.counts)));
    for (let i = 0; i < 100; i++) {
      const s = dailyFortune(p, new Date(2026, 0, 1 + i), tarotEls).score;
      expect(s >= 1 && s <= 5).toBe(true);
    }
  });
});

describe('content:check', () => {
  const hasText = (t?: { ko?: string; en?: string }) => !!t?.ko?.trim() && !!t?.en?.trim();
  it('다섯 갈래마다 제목·펫 반응·문구 3줄 이상, 모두 한영', () => {
    for (const c of ['friend', 'express', 'wealth', 'work', 'learn'] as Category[]) {
      const m = messages.categories[c];
      expect(hasText(m.title) && hasText(m.pet)).toBe(true);
      expect(m.lines.length).toBeGreaterThanOrEqual(3);
      m.lines.forEach((l) => expect(hasText(l)).toBe(true));
    }
  });
  it('오행 다섯 가지에 펫·색·숫자가 있다', () => {
    for (const e of ELEMENTS) {
      const m = messages.elements[e];
      expect(hasText(m) && hasText(m.pet) && hasText(m.pet.trait) && /^#[0-9a-f]{6}$/i.test(m.color.hex)).toBe(true);
      expect(m.numbers.length).toBe(2);
    }
  });
  it('타로 22장, 번호 순서, 원소가 다섯 오행 중 하나이고 고르게(3~6장) 나뉜다', () => {
    expect(tarot.cards.length).toBe(22);
    tarot.cards.forEach((c, i) => {
      expect(c.n).toBe(i);
      expect(ELEMENTS).toContain(c.el);
      expect(hasText(c) && hasText(c.kw)).toBe(true);
    });
    for (const e of ELEMENTS) {
      const n = tarot.cards.filter((c) => c.el === e).length;
      expect(n >= 3 && n <= 6).toBe(true);
    }
  });
});
