// 판 사이에 이어지는 것: 코인, 영구 강화, 깬 섬 수. 기기에만 저장한다.
import { MAX_HP } from './rules';

export const PERKS = ['vigor', 'shove', 'charge', 'wisdom'] as const;
export type Perk = (typeof PERKS)[number];
export const PERK_MAX: Record<Perk, number> = { vigor: 3, shove: 5, charge: 5, wisdom: 5 };
const PERK_BASE: Record<Perk, number> = { vigor: 80, shove: 40, charge: 40, wisdom: 40 };
export const perkCost = (id: Perk, lv: number) => Math.round(PERK_BASE[id] * (1 + lv) ** 1.6);

// 캐릭터(결정 061): 캡슐로 얻는 Kenney 캐릭터, 저마다 작은 특성 하나
export const CHARS = ['human', 'orc', 'keeper', 'vampire', 'ghost'] as const;
export type CharId = (typeof CHARS)[number];
export const CAPSULE_COST = 120;
export const CAPSULE_REFUND = 40; // 이미 가진 캐릭터가 나오면 돌려주는 코인

export type Meta = {
  coins: number; perks: Record<Perk, number>; cleared: number;
  missions: string[]; missionsDone: number; bossDowns: number; // 미션·내 섬 트로피(결정 060)
  chars: CharId[]; hero: CharId; // 캐릭터(결정 061)
};
export const freshMeta = (): Meta => ({
  coins: 0, perks: { vigor: 0, shove: 0, charge: 0, wisdom: 0 }, cleared: 0,
  missions: [], missionsDone: 0, bossDowns: 0, chars: ['human'], hero: 'human',
});

// 효과
export const maxHp = (m: Meta) => MAX_HP + 20 * m.perks.vigor + (m.hero === 'orc' ? 20 : 0);
export const shoveMul = (m: Meta) => (1 + 0.12 * m.perks.shove) * (m.hero === 'keeper' ? 1.15 : 1);
export const startChargeFrac = (m: Meta) => 0.15 * m.perks.charge;
export const xpMul = (m: Meta) => 1 + 0.1 * m.perks.wisdom;

/** 판 보상. 처치 수에는 떨어뜨린 수가 들어 있어 떨어뜨리기는 두 번 센다. 뒤 섬일수록 많이 준다 */
export const coinsFor = (kills: number, falls: number, win: boolean, stage: number) =>
  Math.round((kills + falls) * (1 + 0.5 * stage) + (win ? 60 * (stage + 1) : 0));

export const speedMul = (m: Meta) => (m.hero === 'ghost' ? 1.12 : 1);
/** 흡혈귀: 이만큼 처치할 때마다 체력 1(0이면 없음) */
export const healEvery = (m: Meta) => (m.hero === 'vampire' ? 4 : 0);

/** 캡슐: 아직 없는 캐릭터면 얻고, 이미 있으면 일부 코인을 돌려준다. 돈이 모자라면 null */
export function rollCapsule(m: Meta, rand = Math.random): { meta: Meta; got: CharId; dup: boolean } | null {
  if (m.coins < CAPSULE_COST) return null;
  const pool = CHARS.filter((c) => c !== 'human');
  const got = pool[Math.floor(rand() * pool.length)];
  const dup = m.chars.includes(got);
  return { got, dup, meta: { ...m, coins: m.coins - CAPSULE_COST + (dup ? CAPSULE_REFUND : 0), chars: dup ? m.chars : [...m.chars, got] } };
}

/** 살 수 없으면(돈 부족·최대 레벨) null */
export function buy(m: Meta, id: Perk): Meta | null {
  const lv = m.perks[id], cost = perkCost(id, lv);
  if (lv >= PERK_MAX[id] || m.coins < cost) return null;
  return { ...m, coins: m.coins - cost, perks: { ...m.perks, [id]: lv + 1 } };
}

/** 저장된 값은 믿지 않는다: 깨졌거나 범위를 벗어나면 고친다 */
export function loadMeta(raw: string | null, stageCount: number): Meta {
  const m = freshMeta();
  let v: unknown;
  try {
    v = JSON.parse(raw ?? 'null');
  } catch {
    return m;
  }
  if (!v || typeof v !== 'object') return m;
  const o = v as Partial<Meta>;
  const int = (x: unknown, max: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(max, Math.floor(x))) : 0);
  m.coins = int(o.coins, 1e9);
  m.cleared = int(o.cleared, stageCount);
  for (const id of PERKS) m.perks[id] = int(o.perks?.[id], PERK_MAX[id]);
  m.missions = Array.isArray(o.missions) ? o.missions.filter((x): x is string => typeof x === 'string').slice(0, 3) : [];
  m.missionsDone = int(o.missionsDone, 1e6);
  m.bossDowns = int(o.bossDowns, 1e6);
  const isChar = (x: unknown): x is CharId => typeof x === 'string' && (CHARS as readonly string[]).includes(x);
  m.chars = Array.isArray(o.chars) ? [...new Set(['human' as CharId, ...o.chars.filter(isChar)])] : ['human'];
  m.hero = isChar(o.hero) && m.chars.includes(o.hero) ? o.hero : 'human';
  return m;
}
