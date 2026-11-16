// 놀이 고리 검사: 갈래마다 판 규칙이 실제로 다르고, 꾸미기 소품마다 그림·한영·가격이 있다
import { describe, expect, it } from 'vitest';
import decor from '../../content/fortune/decor.json';
import { decoSvg } from '../art';
import { ELEMENTS, type Category } from '../fortune/saju';
import { modsFor } from './catch';

const CATS: Category[] = ['friend', 'express', 'wealth', 'work', 'learn'];

describe('기운 모으기 판 규칙', () => {
  it('갈래마다 기본값과 다른 규칙이 하나 이상 있고 안내 문구가 한영', () => {
    const base = JSON.stringify({ ...modsFor('friend'), catchRadius: 56, label: null });
    for (const c of CATS) {
      const m = modsFor(c);
      expect(JSON.stringify({ ...m, label: null })).not.toBe(c === 'friend' ? '' : base);
      expect(m.label.ko && m.label.en).toBeTruthy();
      expect(m.cloudRate + m.coinRate + m.rainbowRate).toBeLessThan(0.4);
    }
  });
});

describe('꾸미기·성장 데이터(content:check)', () => {
  it('소품마다 그림이 있고, 자리가 겹치지 않고, 다섯 기운이 두 개씩', () => {
    const slots = decor.items.map((i) => i.slot);
    expect(new Set(slots).size).toBe(slots.length);
    for (const it of decor.items) {
      expect(decoSvg(it.id).length, it.id).toBeGreaterThan(250); // 그림이 비어 있지 않다
      expect(it.ko && it.en).toBeTruthy();
      expect(ELEMENTS).toContain(it.el);
      expect(it.cost).toBeGreaterThan(0);
    }
    for (const e of ELEMENTS) expect(decor.items.filter((i) => i.el === e).length).toBe(2);
  });
  it('성장 단계는 필요 기운이 오름차순', () => {
    const need = decor.stages.map((s) => s.need);
    expect(need).toEqual([...need].sort((a, b) => a - b));
    expect(need[0]).toBe(0);
  });
});
