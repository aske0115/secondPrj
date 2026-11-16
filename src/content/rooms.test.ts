// content:check — AI가 방 데이터를 추가하면 이 검사를 통과시켜야 한다(결정 012).
// 모델 생성은 브라우저(캔버스)가 필요해 여기서는 데이터만 검사하고, 모델 이름은 목록으로 대조한다.
import { describe, expect, it } from 'vitest';
import type { Room } from './types';

const rooms = import.meta.glob('../../content/rooms/*.json', { eager: true, import: 'default' }) as Record<string, Room>;
// src/models.ts 의 BUILDERS 이름과 같아야 한다(모델을 추가하면 여기도 추가)
const MODELS = ['counter', 'shelf', 'stool', 'wallClock', 'frame', 'window', 'displayCase', 'mantleClock', 'book', 'bookRed', 'deskLamp', 'bulb', 'plate'];
const SURFACES: Record<string, string[]> = { wallClock: ['face'], frame: ['photo'], window: ['glass'], displayCase: ['glass'] };
const MENDABLE = ['plate'];

const hasText = (t?: { ko?: string; en?: string }) => !!t?.ko?.trim() && !!t?.en?.trim();

for (const [file, room] of Object.entries(rooms)) {
  describe(file, () => {
    it('제목·쪽지·답장에 한국어와 영어가 모두 있다', () => {
      expect(hasText(room.title)).toBe(true);
      expect(hasText(room.note)).toBe(true);
      expect(hasText(room.reply)).toBe(true);
    });

    it('소품 ID가 겹치지 않고 모델이 존재한다', () => {
      const ids = room.props.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const p of room.props) expect(MODELS, `${p.id}: ${p.model}`).toContain(p.model);
    });

    it('작업마다 필요한 칸이 있고 이름·이야기는 한영 두 벌이다', () => {
      const tasks = room.props.filter((p) => p.task);
      expect(tasks.length).toBeGreaterThanOrEqual(5);
      for (const p of tasks) {
        expect(hasText(p.name), `${p.id} name`).toBe(true);
        if (p.story) expect(hasText(p.story), `${p.id} story`).toBe(true);
        const t = p.task!;
        if (t.kind === 'wipe') expect(SURFACES[p.model] ?? [], `${p.id} surface`).toContain(t.surface);
        if (t.kind === 'mend') expect(MENDABLE, `${p.id} mend`).toContain(p.model);
        if (t.kind === 'place') {
          // 처음 자리와 정답 자리가 충분히 떨어져 있어야 할 일이 된다
          const [x, y, z] = t.from.pos;
          expect(Math.hypot(x - p.pos[0], y - p.pos[1], z - p.pos[2]), `${p.id} 거리`).toBeGreaterThan(0.5);
          // 흐트러진 물건은 방 안(바닥 위)에 있어야 한다
          expect(Math.abs(x) <= 2.9 && z >= -2.2 && z <= 2.2 && y >= 0).toBe(true);
        }
      }
    });
  });
}
