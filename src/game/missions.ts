// 미션(결정 060): 시작 화면에 3개, 판 중 달성하면 알림, 결과에서 코인. 달성한 미션은 새 것으로 바뀐다.
export type Stat = 'falls' | 'kills' | 'strikes' | 'juggles' | 'opened' | 'slams' | 'time' | 'boss' | 'level';
export type Mission = { id: string; stat: Stat; target: number; coins: number; ko: string; en: string };

export const MISSIONS: readonly Mission[] = [
  { id: 'falls15', stat: 'falls', target: 15, coins: 15, ko: '15마리 떨어뜨리기', en: 'Knock off 15' },
  { id: 'falls40', stat: 'falls', target: 40, coins: 30, ko: '40마리 떨어뜨리기', en: 'Knock off 40' },
  { id: 'kills80', stat: 'kills', target: 80, coins: 20, ko: '80마리 처치', en: 'Defeat 80' },
  { id: 'kills150', stat: 'kills', target: 150, coins: 35, ko: '150마리 처치', en: 'Defeat 150' },
  { id: 'strike1', stat: 'strikes', target: 1, coins: 25, ko: 'STRIKE! 1번', en: 'Score a STRIKE!' },
  { id: 'strike3', stat: 'strikes', target: 3, coins: 45, ko: 'STRIKE! 3번', en: '3 STRIKEs' },
  { id: 'juggle3', stat: 'juggles', target: 3, coins: 20, ko: '공중 콤보 3번', en: '3 air combos' },
  { id: 'open2', stat: 'opened', target: 2, coins: 15, ko: '보급 상자 2개 열기', en: 'Open 2 supply crates' },
  { id: 'slam3', stat: 'slams', target: 3, coins: 15, ko: '쾅! 3번 쓰기', en: 'Use SLAM! 3 times' },
  { id: 'time90', stat: 'time', target: 90, coins: 20, ko: '1:30 버티기', en: 'Survive 1:30' },
  { id: 'level10', stat: 'level', target: 10, coins: 20, ko: '레벨 10 찍기', en: 'Reach level 10' },
  { id: 'boss1', stat: 'boss', target: 1, coins: 60, ko: '왕좀비 떨어뜨리기', en: 'Knock off the king zombie' },
];
const BY_ID = new Map(MISSIONS.map((m) => [m.id, m]));
export const missionById = (id: string) => BY_ID.get(id);

/** 지금 목록에서 빈자리를 채운다. 같은 종류(stat)는 한 번에 하나만 */
export function fillMissions(current: readonly string[], rand = Math.random, count = 3): string[] {
  const kept = current.filter((id) => BY_ID.has(id)).slice(0, count);
  const used = new Set(kept.map((id) => BY_ID.get(id)!.stat));
  const pool = MISSIONS.filter((m) => !used.has(m.stat) && !kept.includes(m.id));
  while (kept.length < count && pool.length) {
    const m = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    if (used.has(m.stat)) continue;
    used.add(m.stat);
    kept.push(m.id);
  }
  return kept;
}

export type RunStats = Record<Stat, number>;
export const isDone = (id: string, s: RunStats) => {
  const m = BY_ID.get(id);
  return !!m && s[m.stat] >= m.target;
};
