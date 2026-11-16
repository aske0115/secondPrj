// content:check — AI가 스테이지를 추가하면 이 검사를 통과시켜야 한다(결정 012·019).
import { describe, expect, it } from 'vitest';
import { fromStage, type StageData } from './rules';
import { idleStars, solve } from './solver';

const stages = import.meta.glob('../../content/stages/*.json', { eager: true, import: 'default' }) as Record<string, StageData>;
const hasText = (t?: { ko?: string; en?: string }) => !!t?.ko?.trim() && !!t?.en?.trim();

for (const [file, st] of Object.entries(stages)) {
  describe(file.split('/').pop()!, () => {
    it('형식: 이름 한영, 지도 크기 일정, 개·양·늑대가 있다', () => {
      expect(hasText(st.name)).toBe(true);
      if (st.tip) expect(hasText(st.tip)).toBe(true);
      expect(st.map.every((r) => r.length === st.map[0].length)).toBe(true);
      expect(st.map.every((r) => /^[.#T~DS^>v<]+$/.test(r))).toBe(true);
      const s = fromStage(st);
      expect(s.units.some((u) => u.kind === 'dog')).toBe(true);
      expect(s.units.some((u) => u.kind === 'sheep')).toBe(true);
      expect(s.units.some((u) => u.kind === 'wolf') || (st.spawns?.length ?? 0) > 0).toBe(true);
    });

    it('풀이: 별 3개가 가능하고, 아무것도 안 하면 별 3개가 아니다', () => {
      const sol = solve(fromStage(st));
      const idle = idleStars(fromStage(st));
      console.log(`${st.id}: 최고 ${sol.stars}별, 무행동 ${idle}별, 탐색 ${sol.explored}`);
      expect(sol.stars).toBe(3);
      expect(idle).toBeLessThan(3);
    }, 60000);
  });
}
