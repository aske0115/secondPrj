import { describe, expect, it } from 'vitest';
import { UI, masteryStep, pickRunWeapon, weaponGeo } from './weaponLook';
import { WEAPONS } from './game/meta';

describe('무기 겉모습(결정 088)', () => {
  it('숙련 단계 문구는 A→B→C 순서, 10단계는 달인', () => {
    expect(masteryStep('sledge', 1)[0]).toBe('준비 −0.04초');
    expect(masteryStep('sledge', 2)[0]).toBe('충격파 +6%');
    expect(masteryStep('sledge', 3)[0]).toBe('후딜 −0.04초');
    expect(masteryStep('sledge', 4)[0]).toBe('준비 −0.04초');
    expect(masteryStep('pole', 1)[0]).toBe('관통 +1');
    expect(masteryStep('hammer', 10)[0]).toContain('달인');
    expect(masteryStep('hammer', 2)[0]).toBe('쉼 −4%');
    expect(masteryStep('pole', 9)[0]).toBe('준비 −0.01초'); // 하한 0.08에 걸려 −0.03이 아니라 −0.01
  });
  it('이번 판 무기: 직접 고름 > 자동 추천 > 잠김이면 망치 > 저장 무기', () => {
    expect(pickRunWeapon('bat', true, 'pan', 'twin', 100)).toBe('bat');
    expect(pickRunWeapon('fan', true, 'pan', 'twin', 100)).toBe('pan'); // 직접 고른 무기가 잠겼으면 무시
    expect(pickRunWeapon(null, true, 'fan', 'twin', 100)).toBe('hammer');
    expect(pickRunWeapon(null, false, 'pan', 'twin', 100)).toBe('twin');
  });
  it('8종 모두 이름·아이콘·모양이 있고, T자 셋 머리는 1.3배 이상 차이', () => {
    const headW = (id: 'hammer' | 'squeaky' | 'sledge') => {
      const g = weaponGeo(id, 0, false);
      g.computeBoundingBox();
      return g.boundingBox!.max.x - g.boundingBox!.min.x;
    };
    for (const w of WEAPONS) {
      expect(UI[w].name[0]).toBeTruthy();
      expect(weaponGeo(w, 2, true).attributes.color).toBeTruthy();
    }
    expect(headW('hammer') / headW('squeaky')).toBeGreaterThanOrEqual(1.3);
    expect(headW('sledge') / headW('hammer')).toBeGreaterThanOrEqual(1.3);
  });
});
