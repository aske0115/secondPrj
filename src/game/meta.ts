// 판 사이에 이어지는 것: 코인, 영구 강화, 깬 섬 수. 기기에만 저장한다.
import { MAX_HP } from './rules';

// 영구 강화 6개(결정 072): 사자마자 눈·손으로 느껴지는 것만. 지혜(경험치 +5%)는 빼고 산 코인을 돌려준다
export const PERKS = ['vigor', 'shove', 'charge', 'cards', 'revive', 'purse'] as const;
export type Perk = (typeof PERKS)[number];
// 장 10개·150스테이지에 맞춰 단계를 늘리고 값을 가파르게(결정 068): 최대 효과는 예전과 같고, 다 사는 데 한 달쯤
export const PERK_MAX: Record<Perk, number> = { vigor: 5, shove: 10, charge: 10, cards: 5, revive: 5, purse: 5 };
const PERK_BASE: Record<Perk, number> = { vigor: 200, shove: 100, charge: 100, cards: 300, revive: 300, purse: 400 };
export const perkCost = (id: Perk, lv: number) => Math.round(PERK_BASE[id] * (1 + lv) ** 3.4); // 지수 3 → 3.4(결정 078): 하루 6판 중 3판 코인 2배여도 다 사기까지 30일(180판) 넘게. 3.5(결정 086) → 3.4(결정 087): 성질이 세져 진행이 다시 느려짐

// 캐릭터(결정 061): 캡슐로 얻는 Kenney 캐릭터, 저마다 작은 특성 하나
export const CHARS = ['human', 'orc', 'keeper', 'vampire', 'ghost'] as const;
export type CharId = (typeof CHARS)[number];
export const CAPSULE_COST = 120;
export const CAPSULE_REFUND = 40; // 이미 가진 캐릭터가 나오면 돌려주는 코인

// 주무기(결정 082·083): 스테이지를 지키면 열린다. 가진 목록은 저장하지 않고 cleared로 계산한다
export const WEAPONS = ['hammer', 'squeaky', 'sledge', 'twin', 'pan', 'bat', 'pole', 'fan'] as const;
export type WeaponId = (typeof WEAPONS)[number];
// 언락 순서(결정 085): 1장엔 뿅망치 하나, 그 뒤 장 끝마다, 7·9·10장은 숙련 ★이 목표
export const WEAPON_OPEN: Record<WeaponId, number> = { hammer: 0, squeaky: 8, sledge: 30, twin: 45, pan: 60, bat: 75, pole: 90, fan: 120 };
// 개발자 모드(실기기 시험용): 모든 무기 열기. 스토어용 출시 빌드(--mode release)에선 늘 꺼져 있고 설정 줄도 없다
export const DEV_MODE = import.meta.env.MODE !== 'release';
let devAll = false;
try { devAll = DEV_MODE && localStorage.getItem('devAllWeapons') === '1'; } catch { /* 저장소를 못 쓰면 끔 */ }
export const devAllWeapons = () => devAll;
export const setDevAllWeapons = (on: boolean) => { try { localStorage.setItem('devAllWeapons', on ? '1' : '0'); } catch { /* 무시 */ } };
export const weaponOpen = (id: WeaponId, cleared: number) => devAll || cleared >= WEAPON_OPEN[id];

export type Meta = {
  coins: number; perks: Record<Perk, number>; cleared: number;
  missions: string[]; missionsDone: number; bossDowns: number; // 미션·내 섬 트로피(결정 060)
  chars: CharId[]; hero: CharId; // 캐릭터(결정 061)
  weapon: WeaponId; // 고른 주무기(결정 082)
  mastery: Record<WeaponId, number>; // 무기별 숙련 점수 = 그 무기로 떨어뜨린 수 누적(결정 085, 단계는 rules.ts masteryLevel)
  autoWeapon: boolean; // 켜면 판 시작 때 스테이지 추천 무기가 열려 있으면 그걸 쓴다(결정 083, 기본 켬)
};
export const freshMeta = (): Meta => ({
  coins: 0, perks: { vigor: 0, shove: 0, charge: 0, cards: 0, revive: 0, purse: 0 }, cleared: 0,
  missions: [], missionsDone: 0, bossDowns: 0, chars: ['human'], hero: 'human', weapon: 'hammer', autoWeapon: true,
  mastery: Object.fromEntries(WEAPONS.map((w) => [w, 0])) as Record<WeaponId, number>,
});

// 효과
export const maxHp = (m: Meta) => MAX_HP + 15 * m.perks.vigor + (m.hero === 'orc' ? 20 : 0);
/** 큰 망치: 넉백과 함께 망치 크기·사거리도 커져 눈에 보인다 */
export const shoveMul = (m: Meta) => (1 + 0.05 * m.perks.shove) * (m.hero === 'keeper' ? 1.15 : 1);
export const hammerMul = (m: Meta) => 1 + 0.03 * m.perks.shove; // 크기·넉백이 곱해져 왕좀비를 5초 만에 떨굼 → 줄임
export const chargeMul = (m: Meta) => 1 + 0.1 * m.perks.charge; // 최대 2배: 7%일 땐 봇 기준 효과가 거의 없었다
/** 카드 달인: 단계마다 레벨 업 카드 다시 고르기 +1, 높은 단계는 카드를 골라 스킬을 들고 시작 */
export const rerolls = (lv: number) => lv;
export const startPicks = (lv: number) => [0, 0, 1, 1, 2, 3][lv] ?? 3;
/** 두 번째 기회: 판당 1번, 쓰러지면 최대 체력의 이만큼으로 일어난다(0이면 없음) */
export const revivePct = (lv: number) => (lv ? 0.25 + 0.1 * lv : 0);
export const coinMul = (m: Meta) => 1 + 0.1 * m.perks.purse;

/** 판 보상. 처치 수에는 떨어뜨린 수가 들어 있어 떨어뜨리기는 두 번 센다. 뒤 장일수록 많이 준다(chapter 0~9) */
export const coinsFor = (kills: number, falls: number, win: boolean, chapter: number) =>
  Math.round((kills + falls) * (1 + 0.3 * chapter) + (win ? 60 * (chapter + 1) : 0));

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
  // 빠진 강화(지혜)에 쓴 코인은 돌려준다. 다음 저장부터는 지혜가 없어 한 번만 돌려준다
  const wisdom = int((o.perks as Record<string, unknown> | undefined)?.wisdom, 10);
  for (let lv = 0; lv < wisdom; lv++) m.coins += Math.round(40 * (1 + lv) ** 2.8);
  m.missions = Array.isArray(o.missions) ? o.missions.filter((x): x is string => typeof x === 'string').slice(0, 3) : [];
  m.missionsDone = int(o.missionsDone, 1e6);
  m.bossDowns = int(o.bossDowns, 1e6);
  const isChar = (x: unknown): x is CharId => typeof x === 'string' && (CHARS as readonly string[]).includes(x);
  m.chars = Array.isArray(o.chars) ? [...new Set(['human' as CharId, ...o.chars.filter(isChar)])] : ['human'];
  m.hero = isChar(o.hero) && m.chars.includes(o.hero) ? o.hero : 'human';
  m.autoWeapon = o.autoWeapon !== false;
  for (const w of WEAPONS) m.mastery[w] = int((o.mastery as Record<string, unknown> | undefined)?.[w], 1e6); // 안 열린 무기도 값은 보존
  const w = o.weapon as unknown;
  m.weapon = typeof w === 'string' && (WEAPONS as readonly string[]).includes(w) && weaponOpen(w as WeaponId, m.cleared) ? (w as WeaponId) : 'hammer';
  return m;
}
