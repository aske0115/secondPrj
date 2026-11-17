// 숫자 규칙만 모은 곳. 화면·입력과 떼어 두어 테스트하고, 손맛 조정은 여기 숫자만 고친다.
export const ISLAND_R = 13;
export const RUN_SECONDS = 120;
export const MAX_ENEMIES = 300;
export const MAX_HP = 4;
export const MAX_LEVEL = 5;

// 시간이 갈수록 더 자주, 더 많이, 더 큰 적이 올라온다
export const spawnInterval = (t: number) => Math.max(0.1, 0.8 - t * 0.006);
export const spawnBatch = (t: number) => 1 + Math.floor(t / 25);
export const bigChance = (t: number) => Math.min(0.3, t / 240);
export const enemyHp = (t: number, big: boolean) => (big ? 40 + t * 0.5 : 10 + t * 0.12);

export const xpNeed = (level: number) => 4 + level * 3;

// 스킬은 모두 "밀어내기"다: 쏘아 맞히는 무기 대신 장난감 섬의 물건으로 친다(쓸어킬과 겹치지 않게, 결정 039)
export const UPGRADES = ['hammer', 'log', 'pumpkin', 'sweep', 'knock', 'speed'] as const;
export type UpgradeId = (typeof UPGRADES)[number];
export type Levels = Record<UpgradeId, number>;
export const startLevels = (): Levels => ({ hammer: 1, log: 0, pumpkin: 0, sweep: 0, knock: 0, speed: 0 });

/** 망치: 가까운 적 쪽으로 부채꼴을 휘둘러 크게 날린다 */
export const hammerCooldown = (lv: number) => 0.9 * 0.86 ** (lv - 1);
export const hammerRadius = (lv: number) => 1.9 + 0.22 * lv;
export const hammerArc = (lv: number) => ((100 + 20 * (lv - 1)) * Math.PI) / 180;
/** 통나무: 섬을 가로질러 굴러가며 길 위의 적을 줄줄이 민다 */
export const logInterval = (lv: number) => 6.5 * 0.8 ** (lv - 1);
export const logCount = (lv: number) => (lv >= 4 ? 2 : 1);
/** 호박 폭탄: 적 쪽으로 던지면 떨어진 자리에서 터져 둥글게 민다 */
export const pumpkinInterval = (lv: number) => 3.4 * 0.85 ** (lv - 1);
export const pumpkinCount = (lv: number) => 1 + Math.floor((lv - 1) / 2);
export const pumpkinRadius = (lv: number) => 2.1 + 0.25 * lv;

export const sweepRadius = (lv: number) => 5 + lv * 0.6;
export const sweepCost = (lv: number) => 25 - lv * 2; // 처치 수로 채운다
export const knockMul = (lv: number) => 1 + 0.35 * lv; // 모든 공격의 밀어내는 힘
export const moveSpeed = (lv: number) => 5.5 * (1 + 0.08 * lv);

// 박치기 보너스: 판 중간에 한 번, 생존 시계를 멈추고 튕겨서 돌진하는 미니게임
export const BONUS_AT = 65;
export const BONUS_SECONDS = 15;
export const BONUS_COIN = 3; // 보너스 중 떨어뜨린 한 마리당
/** 손가락을 튕긴 길이(px)로 돌진 속도를 정한다. 너무 짧으면 무시 */
export const dashSpeed = (px: number) => (px < 18 ? 0 : Math.min(24, 6 + px * 0.12));

/** 레벨업 3택. 다 올린 강화는 빼고, 체력이 깎였을 때만 회복을 섞는다. 고를 것이 없으면 빈 배열 */
export function pickUpgrades(lv: Levels, hpFull: boolean, rand = Math.random): (UpgradeId | 'heart')[] {
  const pool: (UpgradeId | 'heart')[] = UPGRADES.filter((id) => lv[id] < MAX_LEVEL);
  if (!hpFull) pool.push('heart');
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

// 밀어 떨어뜨리기가 그냥 처치보다 이득이어야 벼랑 쪽으로 몰 이유가 생긴다
export const KILL_CHARGE = 1;
export const FALL_CHARGE = 2;
export const killXp = (big: boolean) => (big ? 3 : 1);
export const fallXp = (big: boolean) => killXp(big) * 2;

// 섬(스테이지). 앞 섬을 버티면 다음 섬이 열린다. 섬마다 색·무너지는 때·적 세기가 다르다
export type Crumble = { readonly at: number; readonly r: number };
export type Stage = {
  name: readonly [string, string]; grass: number; cliff: number; sky: number; sun: number;
  crumbles: readonly Crumble[]; spawn: number; big: number; hp: number; speed: number;
};
export const STAGES: readonly Stage[] = [
  { name: ['풀밭 섬', 'Meadow Isle'], grass: 0x86c46a, cliff: 0xb89468, sky: 0xbfe6f5, sun: 0xfff0d2,
    crumbles: [{ at: 40, r: 11.5 }, { at: 80, r: 10 }], spawn: 1, big: 1, hp: 1, speed: 1 },
  { name: ['단풍 섬', 'Maple Isle'], grass: 0xd9a24e, cliff: 0x9a6b4a, sky: 0xf6dcc0, sun: 0xffd9a8,
    crumbles: [{ at: 30, r: 11.5 }, { at: 60, r: 10 }, { at: 90, r: 8.8 }], spawn: 1.3, big: 1.4, hp: 1.3, speed: 1.1 },
  { name: ['달빛 묘지 섬', 'Moonlit Isle'], grass: 0x5f8a7a, cliff: 0x6b6378, sky: 0x2d3555, sun: 0xb9c6ff,
    crumbles: [{ at: 25, r: 11.8 }, { at: 50, r: 10.6 }, { at: 75, r: 9.4 }, { at: 100, r: 8.4 }], spawn: 1.6, big: 1.8, hp: 1.7, speed: 1.2 },
];
export const CRUMBLE_WARN = 3;
export const islandRadius = (t: number, cs: readonly Crumble[] = STAGES[0].crumbles) => cs.reduce((r, c) => (t >= c.at ? c.r : r), ISLAND_R as number);
/** 곧 무너질 단계의 번호(경고 중일 때만), 없으면 -1 */
export const crumbleWarning = (t: number, cs: readonly Crumble[] = STAGES[0].crumbles) => cs.findIndex((c) => t >= c.at - CRUMBLE_WARN && t < c.at);
