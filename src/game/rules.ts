import type { WeaponId } from './meta';
// 숫자 규칙만 모은 곳. 화면·입력과 떼어 두어 테스트하고, 손맛 조정은 여기 숫자만 고친다.
export const ISLAND_R = 13; // 가장 큰 섬의 반지름(섬 모양은 이걸로 만들고 섬마다 줄여 쓴다)
export const RUN_SECONDS = 120;
export const MAX_ENEMIES = 300;
export const MAX_HP = 100;
// 적마다 피해가 다르다: 큰 좀비는 피해야 할 상대(결정 049). 숫자는 봇으로 맞춘다
export const enemyDamage = (big: boolean) => (big ? 34 : 18);
export const HEAL = 30; // 회복 상자·레벨업 회복
export const HURT_INV = 0.9; // 맞은 뒤 무적 시간
export const MAX_LEVEL = 5;

// 시간이 갈수록 더 자주, 더 많이, 더 큰 적이 올라온다
// 초반은 부드럽게(사람은 봇보다 늦게 피한다), 뒤로 갈수록 빽빽하게(결정 043)
// cap: 처음 간격의 상한(결정 091, 스테이지의 gap — 배우는 섬 1-1~1-4만 0.45, 나머지 1 = 상한 없음). 상한이 풀리는 뒤 곡선은 그대로.
// 모든 스테이지에 걸면(0.45) 2장 승률·스테이지 50이 떨어졌다(봇)
export const spawnInterval = (t: number, cap = 1) => Math.max(0.12, Math.min(cap, 1.0 - t * 0.0075));
export const spawnBatch = (t: number) => 1 + Math.floor(t / 30);
export const bigChance = (t: number) => Math.min(0.3, Math.max(0, (t - 20) / 260));
export const enemyHp = (t: number, big: boolean) => (big ? 32 + t * 0.5 : 8 + t * 0.12);
export const enemySpeed = (t: number, big: boolean) => (big ? 1.3 : 1.8 + t * 0.007);

// 뒤 레벨일수록 가파르게: 무너짐으로 한꺼번에 떨어질 때 모든 스킬이 만렙이 되던 폭주를 막는다
export const xpNeed = (level: number) => Math.round(4 + level * 3 + level * level * 0.4);
// 카드 간격(결정 078): 첫 두 장은 위 표대로 빨리, 그 뒤는 "최근 경험치 속도 × CARD_GAP초"만큼 모아야 한 장.
// 강한 판(뒤 장·강화)은 경험치가 10배 넘게 쏟아져 한 판 20장까지 나오던 것을 어느 섬에서나 약 15초에 1장으로 맞춘다
export const CARD_GAP = 24; // 경험치가 판 안에서 빠르게 불어나 최근 속도가 늘 뒤처진다: 24로 둬야 실제 약 15초(봇 측정)
export const XP_WINDOW = 10; // recent = 최근 경험치의 지수 합(이 초를 시간 상수로 줄어든다) ≈ 초당 경험치 × XP_WINDOW
export const cardNeed = (level: number, recent: number) =>
  level < 2 ? xpNeed(level) : Math.max(xpNeed(level), Math.round((recent / XP_WINDOW) * CARD_GAP));

// 스킬은 모두 "밀어내기"다: 쏘아 맞히는 무기 대신 장난감 섬의 물건으로 친다(쓸어킬과 겹치지 않게, 결정 039)
export const UPGRADES = ['hammer', 'log', 'pumpkin', 'sweep', 'knock', 'speed'] as const;
export const ATTACKS: readonly UpgradeId[] = ['hammer', 'log', 'pumpkin', 'sweep'];
export type UpgradeId = (typeof UPGRADES)[number];
export const SUBS: readonly UpgradeId[] = ['log', 'pumpkin'];
export type Levels = Record<UpgradeId, number>;
export const startLevels = (): Levels => ({ hammer: 1, log: 0, pumpkin: 0, sweep: 0, knock: 0, speed: 0 });

// 카드가 한 판 약 15장 → 7~8장으로 줄어(결정 078) 한 장의 효과를 약 1.5배로 키웠다
/** 망치: 가까운 적 쪽으로 부채꼴을 휘둘러 크게 날린다 */
export const hammerCooldown = (lv: number) => 0.9 * 0.8 ** (lv - 1);
export const hammerRadius = (lv: number) => 1.8 + 0.32 * lv;
export const hammerArc = (lv: number) => ((100 + 20 * (lv - 1)) * Math.PI) / 180;

const LIFT_BASE = 4.5;
// ───── 주무기 8종(결정 082·083·085·086): 한 번 휘두름 = 준비(wind) → 타격(taps, gap 간격) → 후딜(rec) → 쉼(rest) ─────
/** 무기 한 줄(Lv1 값). 준비 중 맞아도 취소되지 않는다. 카드 레벨: 쉼 ×0.8^(lv−1), 준비·타 간격·후딜 ×0.9^(lv−1)(레벨이 올라도 박자 차이가 남게).
 *  range·arc는 망치 레벨 공식(hammerRadius·hammerArc)에 곱하는 배율. shape: fan 부채꼴 / circle 앞 at칸 자리 원(range가 반지름) / line 직선(range가 길이, width 폭, pierce 관통 수).
 *  windMove·recMove: 준비·후딜(타격 포함) 동안 이동 배율. knocks: 타마다 넉백(길이 = 타수). core: 원 가운데 이 반지름 안은 coreDamage.
 *  lift: 맞은 적을 늘 이만큼 띄움(0이면 세게 맞을 때만). flat: 모두 휘두른 쪽으로 평행하게 밂. ignoreShield: 방패 무시. aim: 타격 순간 가까운 적 쪽으로 다시 겨눔.
 *  boss: 왕좀비에게 넉백 배율. good: 이 무기가 유리한 스테이지 성질(무기 ↔ 성질 매핑은 여기 한곳) */
export type WeaponShape = 'fan' | 'circle' | 'line';
export type WeaponStat = {
  wind: number; windMove: number; rec: number; recMove: number; rest: number; gap: number;
  damage: number; knocks: readonly number[]; range: number; arc: number; shape: WeaponShape;
  at?: number; core?: number; coreDamage?: number; width?: number; pierce?: number;
  lift: number; flat?: boolean; ignoreShield?: boolean; aim?: boolean; boss: number; good: Trait;
  windPush?: boolean; // 바람: 적의 무게(넉백 저항)와 상관없이 민다(왕좀비·큰 적 버팀은 그대로)
  pierceLv?: number; // 카드 레벨마다 관통 +
  widthLv?: number; // 카드 레벨마다 직선 폭 +(펀치 막대가 뒤 장 떼에 둘러싸여 1~3/20이던 것, 봇)
};
const W0 = { windMove: 1, recMove: 1, gap: 0, lift: 0, arc: 1, shape: 'fan' as WeaponShape, boss: 1 };
export const WEAPON_STATS: Record<WeaponId, WeaponStat> = {
  hammer: { ...W0, good: 'swarm', wind: 0.1, windMove: 0.8, rec: 0.15, recMove: 0.8, rest: 0.65, damage: 14, knocks: [9], range: 1 },
  squeaky: { ...W0, good: 'air', wind: 0.05, rec: 0.1, recMove: 0.9, rest: 0.38, gap: 0.12, damage: 4.9, knocks: [5.2, 6.2], range: 0.85, arc: 0.8, aim: true },
  sledge: { ...W0, good: 'pack', wind: 0.45, windMove: 0.7, rec: 0.35, recMove: 0.3, rest: 0.85, damage: 26, knocks: [16], range: 1.9 / 2.12, shape: 'circle', at: 1.3, core: 0.7, coreDamage: 34, lift: LIFT_BASE, boss: 0.6 },
  twin: { ...W0, good: 'rush', wind: 0.03, rec: 0.06, rest: 0.26, gap: 0.07, damage: 2.2, knocks: [2.5, 2.5, 5], range: 1.6 / 2.12, arc: 0.9, aim: true },
  pan: { ...W0, good: 'shield', wind: 0.12, windMove: 0.8, rec: 0.2, recMove: 0.7, rest: 0.5, damage: 12.6, knocks: [9], range: 0.85, arc: 1.3, flat: true, ignoreShield: true },
  bat: { ...W0, good: 'heavy', wind: 0.22, windMove: 0.8, rec: 0.25, recMove: 0.6, rest: 0.6, damage: 18.5, knocks: [18], range: 1.3, arc: 0.9, lift: LIFT_BASE, boss: 1.3 / 2 },
  pole: { ...W0, good: 'line', wind: 0.15, windMove: 0.7, rec: 0.2, recMove: 0.8, rest: 0.42, damage: 13, knocks: [14], range: 3.4 / 2.12, shape: 'line', width: 1.6, widthLv: 0.4, pierce: 3, pierceLv: 1, flat: true },
  fan: { ...W0, good: 'tough', wind: 0.1, windMove: 0.8, rec: 0.15, recMove: 0.8, rest: 0.55, damage: 6, knocks: [9], range: 3.4 / 2.12, arc: 0.7, windPush: true },
};
export const WEAPON_MAX_ARC = (240 * Math.PI) / 180;
/** 숙련으로 바뀌는 값(무기 표에 더하거나 곱함). 단계 0이면 모두 그대로 */
export type WeaponMods = { range: number; arc: number; rest: number; wind: number; rec: number; knock: number; lastKnock: number; charge: number; pierce: number; star: boolean };
export const NO_MODS: WeaponMods = { range: 1, arc: 0, rest: 1, wind: 0, rec: 0, knock: 1, lastKnock: 1, charge: 1, pierce: 0, star: false };
export const weaponRadius = (id: WeaponId, lv: number, m = NO_MODS) => hammerRadius(lv) * WEAPON_STATS[id].range * m.range;
export const weaponArc = (id: WeaponId, lv: number, m = NO_MODS) => Math.min(WEAPON_MAX_ARC, hammerArc(lv) * WEAPON_STATS[id].arc + (m.arc * Math.PI) / 180);
const beat = (lv: number) => 0.9 ** (lv - 1);
/** 박자(초). 하한은 숙련 줄의 하한 */
export const weaponWind = (id: WeaponId, lv: number, m = NO_MODS) => Math.max(WEAPON_STATS[id].wind + m.wind, WIND_MIN[id] ?? 0) * beat(lv);
export const weaponRec = (id: WeaponId, lv: number, m = NO_MODS) => Math.max(WEAPON_STATS[id].rec + m.rec, REC_MIN[id] ?? 0) * beat(lv);
export const weaponGap = (id: WeaponId, lv: number) => WEAPON_STATS[id].gap * beat(lv);
export const weaponRest = (id: WeaponId, lv: number, m = NO_MODS) => WEAPON_STATS[id].rest * m.rest * 0.8 ** (lv - 1);
/** 한 바퀴(공속) = 준비 + 타 간격들 + 후딜 + 쉼 */
export const weaponCycle = (id: WeaponId, lv: number, m = NO_MODS) =>
  weaponWind(id, lv, m) + weaponGap(id, lv) * (WEAPON_STATS[id].knocks.length - 1) + weaponRec(id, lv, m) + weaponRest(id, lv, m);
/** 예전 이름(쿨다운) = 한 바퀴 */
export const weaponCooldown = weaponCycle;
export const WIND_REACH = 0.2; // 준비가 이만큼 이상이면 사거리 +0.5칸에서 준비를 시작(걸어오는 적을 미리 노림)
/** 망치만의 장점 「쾅! 망치」(2-4): 망치를 들면 쾅! 충전 +60%, 반지름 +15% */
export const HAMMER_SLAM = { charge: 1.6, radius: 1.15 }; // 1.25·1.1 → 1.6·1.15(결정 087): 떼 성질에서 망치가 앞서게, 성질 없는 스테이지 승률은 그대로

// ───── 숙련(결정 085 3장): 그 무기로 떨어뜨린 수가 쌓여 0~10단계, 줄 A→B→C 순서로 저절로 ─────
export const MASTERY_MAX = 10;
export const MASTERY_K = 30; // 단계 n에 필요한 누적 = K·n². 봇으로 맞춤(무기 하나 약 25판에 10단계)
export const masteryLevel = (points: number) => Math.min(MASTERY_MAX, Math.floor(Math.sqrt(Math.max(0, points) / MASTERY_K)));
/** 판 점수 = 떨어뜨린 수 ÷ (장 번호+1): 뒤 장은 한 판에 10배 넘게 떨어뜨려(1-1 약 26 → 10장 약 1,000) 그대로 세면 두세 판에 10단계가 됐다(봇).
 *  장으로 나누면 어느 장에서나 판당 약 25~100점 → 약 25판에 10단계. 따라잡기: 가장 높은 무기보다 3단계 이상 낮으면 2배 */
export const masteryGain = (falls: number, chapter: number, lv: number, best: number) => Math.round(falls / (chapter + 1)) * (best - lv >= 3 ? 2 : 1);
type MasteryLine = { k: Exclude<keyof WeaponMods, 'star'>; v: number };
/** 무기마다 성격을 키우는 3줄(각 3단계). 하한은 WIND_MIN·REC_MIN */
export const MASTERY_LINES: Record<WeaponId, readonly [MasteryLine, MasteryLine, MasteryLine]> = {
  hammer: [{ k: 'range', v: 0.04 }, { k: 'rest', v: -0.04 }, { k: 'charge', v: 0.05 }],
  squeaky: [{ k: 'lastKnock', v: 0.1 }, { k: 'rest', v: -0.05 }, { k: 'arc', v: 8 }],
  sledge: [{ k: 'wind', v: -0.04 }, { k: 'range', v: 0.06 }, { k: 'rec', v: -0.04 }],
  twin: [{ k: 'lastKnock', v: 0.12 }, { k: 'rest', v: -0.05 }, { k: 'range', v: 0.05 }],
  pan: [{ k: 'arc', v: 10 }, { k: 'knock', v: 0.05 }, { k: 'rec', v: -0.03 }],
  bat: [{ k: 'knock', v: 0.06 }, { k: 'wind', v: -0.03 }, { k: 'range', v: 0.04 }],
  pole: [{ k: 'pierce', v: 1 }, { k: 'range', v: 0.05 }, { k: 'wind', v: -0.03 }],
  fan: [{ k: 'arc', v: 6 }, { k: 'knock', v: 0.05 }, { k: 'range', v: 0.04 }],
};
const WIND_MIN: Partial<Record<WeaponId, number>> = { sledge: 0.3, bat: 0.13, pole: 0.08 };
const REC_MIN: Partial<Record<WeaponId, number>> = { sledge: 0.22 };
/** 숙련 단계 → 무기 값 바꾸기(A1→B1→C1→A2…, 10단계 ★는 Lv3 동작이 판 안 Lv2부터) */
export function masteryMods(id: WeaponId, level: number): WeaponMods {
  const m = { ...NO_MODS }, steps = [Math.floor((level + 2) / 3), Math.floor((level + 1) / 3), Math.floor(level / 3)].map((n) => Math.min(3, n));
  MASTERY_LINES[id].forEach((ln, i) => {
    const add = ln.v * steps[i];
    if (ln.k === 'arc' || ln.k === 'wind' || ln.k === 'rec' || ln.k === 'pierce') m[ln.k] += add;
    else m[ln.k] *= 1 + add;
  });
  m.star = level >= MASTERY_MAX;
  return m;
}

/** 덧붙는 타격(Lv3·Lv5)은 피해 없이 넉백만: 처치 속도·카드·코인은 그대로, 날리는 맛만 커진다 */
export const WEAPON_LV_A = 3;
export const WEAPON_LV_B = 5;
export const SQUEAKY_LV3_KNOCK = 2 / 1.4; // Lv3 뿅!: 둘째 타 넉백 ×1.4 → ×2.0(공중 콤보로 세지 않음)
export const SQUEAKY_SHOCK_R = 1.6; // Lv5 연타 끝 둘레 원
export const SQUEAKY_SHOCK_KNOCK = 7;
export const HAMMER_BACK = { delay: 0.15, knock: 0.6 }; // Lv3 되돌려 치기
export const HAMMER_WHIRL = { every: 3, r: 0.9, knock: 1.2 }; // Lv5 세 번째마다 한 바퀴(피해는 원래 부채꼴 안에만)
export const SLEDGE_AFTER = { delay: 0.3, r: 1.4, knock: 0.5 }; // Lv3 여진: 같은 자리 더 큰 고리
export const SLEDGE_DOUBLE = { every: 3, knock: 0.8 }; // Lv5 세 번째마다 한 번 더 쿵
export const TWIN_FOURTH = 5; // Lv3 넷째 타 넉백
export const TWIN_SPIN = 6; // Lv5 마지막 타 한 바퀴 넉백
export const PAN_BACK = { arc: Math.PI / 2, knock: 0.6 }; // Lv3 등 뒤 90°
export const PAN_FLIP_LIFT = 6; // Lv5 맞은 적이 높이 뜬다
export const BAT_FULL = { every: 3, knock: 1.6, shake: 0.3 }; // Lv3 풀스윙
export const BAT_BACK = { delay: 0.2, knock: 0.7 }; // Lv5 되받아 치기
export const BAT_BOSS = 1.3 / 2; // 방망이 넉백 ×2를 왕좀비에겐 ×1.3만(결정 072처럼 왕좀비를 너무 빨리 떨구지 않게)
export const POLE_RING = { r: 1.2, knock: 6 }; // Lv3 찌른 끝 바람 고리
export const POLE_FORK = { every: 3, spread: (25 * Math.PI) / 180 }; // Lv5 세 번째마다 양옆 ±25° 펀치(넉백만)
export const FAN_GUST = { t: 1.5, r: 1.2, knock: 5 }; // Lv3 바람 끝 작은 회오리(지나는 적을 바깥으로)
export const LIFT = LIFT_BASE; // 맞아 뜰 때 위로 튀는 힘(저중력 장은 LOW_GRAV_LIFT)
/** 보조 무기(통나무·호박)에 맞으면 더 멀리, 세기와 상관없이 뜬다 → 주무기로 공중 콤보 */
export const SUB_KNOCK = 1.3;

/** 통나무: 섬을 가로질러 굴러가며 길 위의 적을 줄줄이 민다 */
export const logInterval = (lv: number) => 5 * 0.72 ** (lv - 1); // 6.5 → 5(결정 083): Lv1에서 "가끔 지나감"이 되지 않게
export const LOG_WARN = 0.6; // 지나갈 줄을 이만큼 먼저 보여 준 뒤 굴러간다
export const logCount = (lv: number) => (lv >= 3 ? 2 : 1);
/** 호박 폭탄: 적 쪽으로 던지면 떨어진 자리에서 터져 둥글게 민다 */
export const pumpkinInterval = (lv: number) => 3.4 * 0.78 ** (lv - 1);
export const pumpkinCount = (lv: number) => 1 + Math.floor(lv / 2);
export const pumpkinRadius = (lv: number) => 2.0 + 0.35 * lv;

export const sweepRadius = (lv: number) => 5 + lv * 0.9;
export const sweepCost = (lv: number) => 25 - lv * 3; // 처치 수로 채운다
export const knockMul = (lv: number) => 1 + 0.5 * lv; // 모든 공격의 밀어내는 힘
export const moveSpeed = (lv: number) => 5.5 * (1 + 0.12 * lv);

// 박치기 보너스: 판 중간에 한 번, 생존 시계를 멈추고 튕겨서 돌진하는 미니게임
export const BONUS_AT = 65;
export const BONUS_SECONDS = 15;
export const BONUS_COIN = 3; // 보너스 중 떨어뜨린 한 마리당
/** 손가락을 튕긴 길이(px)로 돌진 속도를 정한다. 너무 짧으면 무시 */
/** 보너스가 끝난 뒤 숨 고르기(결정 078): 이 시간 동안 무적, 적은 천천히 다시 늘어난다 */
export const BONUS_CALM = 3;
export const BONUS_INV = 2;
/** 남은 숨 고르기 시간 → 적 생성 속도 배수(0.25에서 1까지) */
export const calmSpawn = (left: number) => Math.max(0.25, Math.min(1, 1 - left / BONUS_CALM));
export const dashSpeed = (px: number) => (px < 18 ? 0 : Math.min(24, 6 + px * 0.12));

/** 레벨업 3택. 공격 스킬이 패시브보다 3배 잘 나오고, 공격 스킬이 남아 있으면 적어도 하나는 넣는다.
 *  다 올린 강화는 빼고, 체력이 깎였을 때만 회복을 섞는다. 고를 것이 없으면 빈 배열 */
export function pickUpgrades(lv: Levels, hpFull: boolean, rand = Math.random): (UpgradeId | 'heart')[] {
  const pool: { id: UpgradeId | 'heart'; w: number }[] = UPGRADES.filter((id) => lv[id] < MAX_LEVEL).map((id) => ({ id, w: ATTACKS.includes(id) ? 3 : 1 }));
  if (!hpFull) pool.push({ id: 'heart', w: 1.5 });
  const out: (UpgradeId | 'heart')[] = [];
  while (out.length < 3 && pool.length) {
    let r = rand() * pool.reduce((a, p) => a + p.w, 0), k = 0;
    while (k < pool.length - 1 && (r -= pool[k].w) > 0) k++;
    out.push(pool.splice(k, 1)[0].id);
  }
  const anyAttack = (ids: readonly (UpgradeId | 'heart')[]) => ids.some((id) => ATTACKS.includes(id as UpgradeId));
  const spare = pool.find((p) => ATTACKS.includes(p.id as UpgradeId));
  if (!anyAttack(out) && spare) out[out.length - 1] = spare.id;
  // 보조 무기 보장(결정 082): 통나무·호박이 하나도 없으면 3장 중 1장은 그 둘 중 하나(패시브·회복 자리를 먼저 바꾼다)
  const subs = SUBS.filter((id) => lv[id] < MAX_LEVEL);
  if (subs.length === SUBS.length && !SUBS.some((id) => lv[id] > 0) && !out.some((id) => SUBS.includes(id as UpgradeId)) && out.length) {
    const k = out.findIndex((id) => !ATTACKS.includes(id as UpgradeId));
    out[k < 0 ? out.length - 1 : k] = subs[Math.floor(rand() * subs.length)];
  }
  return out;
}

// 밀어 떨어뜨리기가 그냥 처치보다 이득이어야 벼랑 쪽으로 몰 이유가 생긴다
export const KILL_CHARGE = 1;
/** 쾅! 직후 이 시간 동안은 게이지가 차지 않는다(쾅!으로 떨어뜨린 보상이 바로 다음 쾅!을 채워 무한으로 쓰던 고리, 결정 055) */
export const SWEEP_LOCK = 3;
export const FALL_CHARGE = 2;
export const killXp = (big: boolean) => (big ? 3 : 1);
export const fallXp = (big: boolean) => killXp(big) * 2;

// 섬(스테이지). 앞 섬을 버티면 다음 섬이 열린다. 섬마다 색·무너지는 때·적 세기가 다르다
export type Crumble = { readonly at: number; readonly r: number };
/** 섬마다 다른 장난감 장치(결정 059): 풀밭 스프링 버섯, 단풍 통, 달빛 유령 등불 */
export type Gadget = 'spring' | 'barrel' | 'lantern';
export type Stage = {
  name: readonly [string, string]; r: number; grass: number; cliff: number; sky: number; sun: number;
  crumbles: readonly Crumble[]; spawn: number; big: number; hp: number; speed: number; dmg: number; gadget: Gadget;
};
export const STAGES: readonly Stage[] = [
  // 크기는 노는 방식: 좁을수록 가장자리가 가까워 떨어뜨리기가 늘어난다. 넓히면 오히려 어려워져서(봇 측정) 첫 섬이 가장 넓다(결정 045)
  { name: ['풀밭 섬', 'Meadow Isle'], r: 13, grass: 0x86c46a, cliff: 0xb89468, sky: 0xbfe6f5, sun: 0xfff0d2,
    crumbles: [{ at: 40, r: 11.5 }, { at: 80, r: 10 }], spawn: 0.55, big: 0.45, hp: 0.6, speed: 0.85, dmg: 0.45, gadget: 'spring' }, // 첫 섬은 배우는 섬: 처음 하는 사람도 몇 판 안에 깨게(결정 050)
  { name: ['단풍 섬', 'Maple Isle'], r: 12, grass: 0xd9a24e, cliff: 0x9a6b4a, sky: 0xf6dcc0, sun: 0xffd9a8,
    crumbles: [{ at: 30, r: 11 }, { at: 60, r: 10 }, { at: 90, r: 9 }], spawn: 0.7, big: 0.8, hp: 0.78, speed: 0.92, dmg: 0.6, gadget: 'barrel' },
  { name: ['달빛 묘지 섬', 'Moonlit Isle'], r: 10.5, grass: 0x5f8a7a, cliff: 0x6b6378, sky: 0x2d3555, sun: 0xb9c6ff,
    crumbles: [{ at: 25, r: 10 }, { at: 50, r: 9.4 }, { at: 75, r: 8.8 }, { at: 100, r: 8.2 }], spawn: 0.95, big: 1, hp: 1, speed: 1, dmg: 0.8, gadget: 'lantern' },
];
export const CRUMBLE_WARN = 3;
export const islandRadius = (t: number, st: Stage = STAGES[0]) => st.crumbles.reduce((r, c) => (t >= c.at ? c.r : r), st.r);
/** 곧 무너질 단계의 번호(경고 중일 때만), 없으면 -1 */
export const crumbleWarning = (t: number, st: Stage = STAGES[0]) => st.crumbles.findIndex((c) => t >= c.at - CRUMBLE_WARN && t < c.at);

// 낙하산 보급: 판 중간중간 하늘에서 상자가 내려온다. 밟으면 열린다(결정 042)
export const DROPS = ['heart', 'charge', 'golden', 'helper'] as const;
export type DropId = (typeof DROPS)[number];
export const FIRST_DROP = 20;
export const DROP_INTERVAL = 28; // 사용자: 17초는 너무 잦음(결정 055)
export const DROP_FALL = 3; // 내려오는 데 걸리는 초
export const DROP_LIFE = 12; // 땅에 닿은 뒤 이만큼 지나면 사라진다
export const GOLDEN_SECONDS = 8;
export const HELPER_SECONDS = 7; // 사용자: 12초는 너무 오래 잡음(결정 055)
/** 체력이 가득이면 회복은, 이번 판에 도우미가 이미 왔으면 도우미는 빼고 고른다(도우미는 판당 1번).
 *  체력이 절반 아래(low)면 반드시 회복(결정 092: 사용자 "1-4 회복 없어서 깨기 어려웠을 것") */
export function pickDrop(hpFull: boolean, rand = Math.random, helperUsed = false, low = false): DropId {
  if (low) return 'heart';
  const pool = DROPS.filter((d) => !(hpFull && d === 'heart') && !(helperUsed && d === 'helper'));
  return pool[Math.floor(rand() * pool.length)];
}

// ───── 왕좀비 피날레(결정 057): 체력으로는 못 쓰러뜨리고 섬 밖으로 밀어야 한다. 떨어뜨리면 그 자리에서 클리어 ─────
export const BOSS_AT = 95;
export const BOSS_WARN = 3;
export const BOSS_SCALE = 2.6;
export const BOSS_KNOCK = 0.35; // 무거워서 덜 밀린다(0%일 때)
/** 때릴수록 오르는 %(결정 064): 피해만큼 오르고, %가 높을수록 멀리 날아간다. 망치만으로는 넉백이 걷는 속도를 못 이겨 떨어뜨릴 수 없었다 */
export const BOSS_PCT_PER_DMG = 0.8;
export const bossKnock = (pct: number) => BOSS_KNOCK * (1 + pct / 45);
export const BOSS_STAGGER = 0.7; // 맞으면 이만큼 멈칫(걷지 않음)
export const BOSS_DMG = 30;
export const bossCoins = (stage: number) => 80 * (stage + 1);

// ───── 손맛 보너스(결정 058) ─────
export const STRIKE_CHAIN = 6; // 한 번에 이만큼 이어 떨어뜨리면 STRIKE!
export const STRIKE_COINS = 10;
export const JUGGLE_KNOCK = 1.4; // 공중에 뜬 적을 또 치면 더 세게 날아간다

// ───── 새 적(결정 058) ─────
export type Kind = '' | 'balloon' | 'shield' | 'bomb' | 'boss';
/** 시간이 지나며 하나씩 등장: 풍선 해골(15초~), 폭탄 해골(30초~), 방패 좀비(45초~) */
export function pickKind(t: number, big: boolean, rand = Math.random, trait?: Trait): Kind {
  const r = rand(), fx = trait ? TRAIT_FX[trait] : TRAIT_FX0;
  if (big) return t >= fx.shieldAt && r < fx.shield ? 'shield' : '';
  if (t >= fx.shieldAt && r > 1 - fx.smallShield) return 'shield';
  if (t >= fx.airAt && r < fx.balloon) return 'balloon';
  if (t >= fx.airAt * 2 && r < fx.balloon + fx.bomb) return 'bomb';
  return '';
}

// ───── 스테이지 성질(결정 083·085): 적 구성만 바꾼다. 무기에 숨은 배율은 없고, 성질에 맞는 무기의 원래 성질이 유리해진다 ─────
export const TRAITS = ['swarm', 'air', 'pack', 'rush', 'shield', 'heavy', 'line', 'tough'] as const;
export type Trait = (typeof TRAITS)[number];
/** spawn·big: 적 수·큰 적 비율 배수, hp: 모든 적 체력 배수, smallHp·smallSpeed: 작은 적 체력·속도 배수,
 *  shield: 큰 적이 방패를 들 확률(shieldAt초부터), smallShield: 작은 적도 방패를 들 확률,
 *  balloon·bomb: 작은 적이 풍선·폭탄일 확률(airAt초부터, 폭탄은 두 배 뒤), pop: 풍선은 첫 타엔 풍선만 터진다(피해 없음), balloonSpeed: 풍선 해골 속도 배수,
 *  brace: 큰 적(왕좀비 빼고)이 버티는 힘 — 한 타 넉백이 이보다 약하면 밀리지 않는다,
 *  pack: 한 번에 나오는 수·간격 배수, 같이 나온 적은 한 덩어리(총 수는 같음), lanes: 마주 보는 두 방향에서만 줄지어 나온다,
 *  clump: 겹겹이 뭉쳐 관통 직선도 가린 적은 못 맞힌다(원 충격파만 안쪽까지), anchor: 바닥에 붙은 덩어리 — 띄우지 않는 주무기 타에 밀리는 정도(띄우는 타·보조 무기는 그대로), block: 방패가 막고 남기는 비율(작을수록 단단한 방패), braceKeep: 버틸 때도 이만큼은 밀림, cover: 앞 적이 이 폭 안에서 가리면 뒤 적은 부채꼴 공격에 안 맞는다(원 충격파·관통 직선만 뒤까지, 0이면 없음), popMin: 풍선을 터뜨리는 최소 한 타 넉백(스펀지 칼처럼 무른 타는 튕겨 나감),
 *  weight: 작은·큰 적(왕좀비 빼고)이 밀리는 정도(무게), ring: 주인공 둘레에 이만큼씩 한꺼번에 솟아오른다(0이면 섬 끝에서) */
export type TraitFx = {
  spawn: number; big: number; hp: number; smallHp: number; smallSpeed: number; shield: number; shieldAt: number; smallShield: number;
  balloon: number; bomb: number; airAt: number; pop: boolean; balloonSpeed: number; brace: number; pack: number; lanes: boolean;
  weight: number; ring: number; braceKeep: number; cover: number; clump: boolean; block: number; anchor: number;
};
const TRAIT_FX0: TraitFx = {
  spawn: 1, big: 1, hp: 1, smallHp: 1, smallSpeed: 1, shield: 0.25, shieldAt: 45, smallShield: 0,
  balloon: 0.12, bomb: 0.1, airAt: 15, pop: false, balloonSpeed: 1.15, brace: 0, pack: 1, lanes: false, weight: 1, ring: 0, braceKeep: 0, cover: 0, clump: false, anchor: 1, block: 0.25, // block = SHIELD_BLOCK(아래에서 정의)
};
export const NO_TRAIT = TRAIT_FX0;
export const PACK_R = 4.5; // 뭉침: 덩어리가 떨어지는 거리
export const PACK_SPREAD = 1; // 덩어리 반지름
export const RING_R = 5.3; // 떼: 주인공 둘레 이 거리에서 솟아오른다. 쾅! 반지름(5)보다 조금 밖이라 망치의 쾅!(×1.15)만 바로 덮는다
export const POP_MIN = 5; // 풍선은 이보다 약한 타에는 안 터지고 튕겨 나간다(스펀지 쌍검은 셋째 타 5만, 뿅망치는 첫 타 5.2부터)
export const TRAIT_FX: Record<Trait, TraitFx> = {
  swarm: { ...TRAIT_FX0, spawn: 1.2, big: 1 / 1.2, smallHp: 0.35, ring: 12, anchor: 0.5 }, // 주인공 둘레에 솟아오르는 엉겨 붙은 떼(무기엔 덜 밀림) → 망치(쾅!이 자주·크게)
  air: { ...TRAIT_FX0, spawn: 0.58, smallHp: 0.4, balloon: 0.85, bomb: 0.05, airAt: 5, pop: true, balloonSpeed: 1.8 }, // 풍선 해골(약한 타는 튕김, 터뜨린 뒤 한 번 더) → 뿅망치(첫 타로 터뜨리고 둘째 타로)
  pack: { ...TRAIT_FX0, pack: 8, hp: 1.5, cover: 0.7, clump: true, anchor: 0.7 }, // 가까이 떨어지는 덩어리(안쪽은 가려짐, 바닥에 붙어 띄우는 타에만 잘 밀림) → 대형 해머(원 충격파·늘 띄움)
  rush: { ...TRAIT_FX0, spawn: 1.2, smallHp: 0.15, smallSpeed: 1.6 }, // 빠른 작은 적 → 스펀지 쌍검(준비 없이 계속)
  shield: { ...TRAIT_FX0, shield: 0.9, shieldAt: 10, big: 1.4, smallShield: 0.3, block: 0.28 }, // 방패 좀비(단단한 방패) → 프라이팬(방패 무시)
  heavy: { ...TRAIT_FX0, spawn: 0.45, big: 1.6, brace: 17, braceKeep: 0.2 }, // 버티는 큰 적 → 야구방망이(넉백 2배)
  line: { ...TRAIT_FX0, lanes: true, cover: 0.45, spawn: 1, hp: 4 }, // 두 방향 행렬(앞 적이 뒤를 가림, 단단함) → 펀치 막대(관통)
  tough: { ...TRAIT_FX0, hp: 1.2, spawn: 0.38, weight: 0.3 }, // 무거운 적(덜 밀림) → 큰 부채(바람은 무게와 상관없이 민다)
};
/** 특징 → 추천 무기(WEAPON_STATS의 good에서 만든다) */
export const TRAIT_WEAPON = Object.fromEntries(Object.entries(WEAPON_STATS).map(([id, w]) => [w.good, id])) as Record<Trait, WeaponId>;
export const KIND_HP: Record<Kind, number> = { '': 1, balloon: 0.5, shield: 1.2, bomb: 0.8, boss: Infinity };
export const KIND_KNOCK: Record<Kind, number> = { '': 1, balloon: 2.2, shield: 1, bomb: 1, boss: BOSS_KNOCK };
export const SHIELD_BLOCK = 0.25; // 방패는 정면에서 오는 망치를 막는다(통나무·호박·쾅!은 그대로)
export const BOMB_RADIUS = 2.6;
export const BOMB_KNOCK = 13;

// ───── 섬 장치(결정 059) ─────
export const GADGET_COUNT = 3;
export const SPRING_LAUNCH = 18; // 버섯을 밟은 적이 섬 바깥쪽으로 튕겨 나가는 힘
export const SPRING_CD = 0.8;
export const BARREL_SPEED = 9;
export const BARREL_RANGE = 7; // 이만큼 굴러가거나 적에 닿으면 터진다
export const BARREL_RESPAWN = 9;
export const LANTERN_EVERY = 9;
export const LANTERN_ON = 2.5;
export const LANTERN_PULL = 4.5; // 이 거리 안의 적을 끌어당긴다
export const LANTERN_FORCE = 9;

// ───── 날씨(결정 059): 판마다 한 번, 한쪽으로 모두 미끄러진다 ─────
export const WEATHER_AT = 55;
export const WEATHER_SECONDS = 6;
export const WEATHER_PUSH = 12; // 넉백으로 더해 가장자리 적은 떨어진다(자기들끼리 밀린 것과 구분되는 기준 2를 넘김)
export type Weather = 'wind' | 'quake';

// ───── 장 규칙(결정 078): 장마다 몸으로 바로 느끼는 규칙 하나. 장 데이터의 rule 칸으로 켠다 ─────
export type Rule = 'ice' | 'lowGrav' | 'springs' | 'wind2';
export const ICE_DECAY = 2.5; // 얼음 바닥: 밀린 적이 멀리 미끄러진다(평소 4.5, 보너스 판 1.4는 봇 승률 15→40/40이라 너무 쉬웠다)
export const LOW_GRAV = 12; // 저중력: 맞아 뜬 적이 천천히 내려온다(평소 22)
export const LOW_GRAV_LIFT = 6; // 뜨는 힘(평소 4.5): 떠 있는 동안 0.4초 → 1초
export const LOW_GRAV_KNOCK = 5; // 이 넉백부터 뜬다(평소 7): 망치 한 번에도 떠서 공중 콤보가 쉽다
export const SPRINGS_MUL = 2; // 스프링 버섯 수 배수
export const WIND2_AT = [8, WEATHER_AT] as const; // 강풍 두 번: 첫 10초 안에 한 번 느끼게

// ───── 오늘의 섬(결정 062): 날마다 모두 같은 섬·같은 무작위(적·상자·날씨) ─────
export const DAILY_COINS = 50; // 그날 처음 버티면
/** 한국 시간 기준 날짜 번호(같은 날이면 같은 값) */
export const dayNumber = (ms: number) => Math.floor((ms + 9 * 3600e3) / 86400e3);
export const dailyStage = (day: number) => (day * 7) % 30; // 앞 두 장(30스테이지) 중 하나, 날마다 다르게
/** 같은 씨앗이면 늘 같은 수열(mulberry32) */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
