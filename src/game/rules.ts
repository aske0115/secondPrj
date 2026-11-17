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
export const spawnInterval = (t: number) => Math.max(0.12, 1.0 - t * 0.0075);
export const spawnBatch = (t: number) => 1 + Math.floor(t / 30);
export const bigChance = (t: number) => Math.min(0.3, Math.max(0, (t - 20) / 260));
export const enemyHp = (t: number, big: boolean) => (big ? 32 + t * 0.5 : 8 + t * 0.12);
export const enemySpeed = (t: number, big: boolean) => (big ? 1.3 : 1.8 + t * 0.007);

// 뒤 레벨일수록 가파르게: 무너짐으로 한꺼번에 떨어질 때 모든 스킬이 만렙이 되던 폭주를 막는다
export const xpNeed = (level: number) => Math.round(4 + level * 3 + level * level * 0.4);

// 스킬은 모두 "밀어내기"다: 쏘아 맞히는 무기 대신 장난감 섬의 물건으로 친다(쓸어킬과 겹치지 않게, 결정 039)
export const UPGRADES = ['hammer', 'log', 'pumpkin', 'sweep', 'knock', 'speed'] as const;
export const ATTACKS: readonly UpgradeId[] = ['hammer', 'log', 'pumpkin', 'sweep'];
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
/** 체력이 가득이면 회복은 빼고 고른다 */
/** 체력이 가득이면 회복은, 이번 판에 도우미가 이미 왔으면 도우미는 빼고 고른다(도우미는 판당 1번) */
export function pickDrop(hpFull: boolean, rand = Math.random, helperUsed = false): DropId {
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
export function pickKind(t: number, big: boolean, rand = Math.random): Kind {
  const r = rand();
  if (big) return t >= 45 && r < 0.25 ? 'shield' : '';
  if (t >= 15 && r < 0.12) return 'balloon';
  if (t >= 30 && r < 0.22) return 'bomb';
  return '';
}
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
