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

export const UPGRADES = ['shot', 'orbit', 'sweep', 'knock', 'speed', 'magnet'] as const;
export type UpgradeId = (typeof UPGRADES)[number];
export type Levels = Record<UpgradeId, number>;
export const startLevels = (): Levels => ({ shot: 1, orbit: 0, sweep: 0, knock: 0, speed: 0, magnet: 0 });

export const shotCooldown = (lv: number) => 0.55 * 0.86 ** (lv - 1);
export const shotCount = (lv: number) => 1 + Math.floor((lv - 1) / 2);
export const orbitCount = (lv: number) => (lv ? lv + 1 : 0);
export const sweepRadius = (lv: number) => 5 + lv * 0.6;
export const sweepCost = (lv: number) => 25 - lv * 2; // 처치 수로 채운다
export const knockMul = (lv: number) => 1 + 0.35 * lv; // 모든 공격의 밀어내는 힘
export const moveSpeed = (lv: number) => 5.5 * (1 + 0.08 * lv);
export const magnetRadius = (lv: number) => 1.6 * (1 + 0.3 * lv);

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

// 섬 가장자리가 정해진 때 무너진다. 그 전에 경고를 띄운다
export const CRUMBLES = [
  { at: 40, r: 11.5 },
  { at: 80, r: 10 },
] as const;
export const CRUMBLE_WARN = 3;
export const islandRadius = (t: number) => CRUMBLES.reduce((r, c) => (t >= c.at ? c.r : r), ISLAND_R as number);
/** 곧 무너질 단계의 번호(경고 중일 때만), 없으면 -1 */
export const crumbleWarning = (t: number) => CRUMBLES.findIndex((c) => t >= c.at - CRUMBLE_WARN && t < c.at);
