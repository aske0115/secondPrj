// 사주·타로 → 같은 "기운 프로필"(결정 024). 계산은 만세력 라이브러리(lunar-javascript, MIT)를 쓰고,
// 해석은 전통 명리의 오행 생극·십신 관계를 따른다. 재미로 보는 운세이며 과학적 예측이 아니다.
import { Solar } from 'lunar-javascript';

export type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export const ELEMENTS: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];

/** 오늘 기운과 나의 관계 = 십신의 다섯 갈래 */
export type Category = 'friend' | 'express' | 'wealth' | 'work' | 'learn';

export const GAN_EL: Record<string, Element> = { 甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth', 己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water' };
export const ZHI_EL: Record<string, Element> = {
  寅: 'wood', 卯: 'wood', 巳: 'fire', 午: 'fire', 辰: 'earth', 戌: 'earth', 丑: 'earth', 未: 'earth', 申: 'metal', 酉: 'metal', 亥: 'water', 子: 'water',
};
export const HANGUL: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
};
/** 상생: wood→fire→earth→metal→water→wood */
const GEN: Record<Element, Element> = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
/** 상극: wood→earth→water→fire→metal→wood */
const CTRL: Record<Element, Element> = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };

/** 오늘 기운(today)이 나(me)에게 어떤 관계인가 — 십신의 오행 갈래와 같은 규칙 */
export function relation(me: Element, today: Element): Category {
  if (me === today) return 'friend';
  if (GEN[me] === today) return 'express'; // 내가 낳는 것
  if (CTRL[me] === today) return 'wealth'; // 내가 다스리는 것
  if (CTRL[today] === me) return 'work'; // 나를 다스리는 것
  return 'learn'; // 나를 낳는 것
}

export interface Pillar {
  gan: string;
  zhi: string;
}

export interface Profile {
  source: 'saju' | 'tarot';
  /** 나를 나타내는 기운(사주는 일간의 오행, 타로는 운명 카드의 원소) */
  self: Element;
  /** 오행 분포(사주는 여덟 글자 또는 시각을 모르면 여섯 글자) */
  counts: Record<Element, number>;
  /** 사주 입구일 때 */
  birth?: { y: number; m: number; d: number; h: number | null; mi: number };
  pillars?: (Pillar | null)[];
  dayGan?: string;
  /** 타로 입구일 때 운명 카드 번호(0~21) */
  card?: number;
  createdAt: string;
}

/**
 * 출생 시각 보정(결정 028).
 * 라이브러리는 중국 표준시(UTC+8, 동경 120°)의 시계로 계산한다. 그래서
 * - 년·월주(절기 경계)는 같은 순간의 중국 시각으로 넣고,
 * - 일·시주는 출생지의 태양 시각(지방평균시)으로 넣는다. 한국(UTC+9)은 서울 동경 127°라 표준시보다 약 32분 늦다.
 * 다른 시간대는 경도를 모르므로 그 시간대의 표준시를 태양 시각으로 본다.
 * tzOffsetMin: 출생 시각의 UTC 차이(분, 한국 +540). 기본은 기기의 시간대.
 */
export const SEOUL_LONGITUDE = 126.98;
export function birthClocks(y: number, m: number, d: number, h: number, mi: number, tzOffsetMin?: number) {
  const tz = tzOffsetMin ?? -new Date(y, m - 1, d, h, mi).getTimezoneOffset();
  const utc = Date.UTC(y, m - 1, d, h, mi) - tz * 60000;
  const solarOffsetMin = tz === 540 ? SEOUL_LONGITUDE * 4 : tz; // 경도 1° = 4분
  const at = (ms: number) => {
    const t = new Date(ms);
    return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), t.getUTCHours(), t.getUTCMinutes()] as const;
  };
  return { china: at(utc + 480 * 60000), solar: at(utc + solarOffsetMin * 60000), correctionMin: Math.round(solarOffsetMin - tz) };
}

export function sajuProfile(y: number, m: number, d: number, h: number | null, mi = 0, tzOffsetMin?: number): Profile {
  // 시각을 모르면 정오로 계산하되 시주는 쓰지 않는다(일주는 자시 경계를 벗어나 안전)
  const { china, solar } = birthClocks(y, m, d, h ?? 12, h === null ? 0 : mi, tzOffsetMin);
  const ecChina = Solar.fromYmdHms(...china, 0).getLunar().getEightChar();
  const ec = Solar.fromYmdHms(...solar, 0).getLunar().getEightChar();
  const split = (gz: string): Pillar => ({ gan: gz[0], zhi: gz[1] });
  const pillars: (Pillar | null)[] = [split(ecChina.getYear()), split(ecChina.getMonth()), split(ec.getDay()), h === null ? null : split(ec.getTime())];
  const counts = emptyCounts();
  for (const p of pillars) {
    if (!p) continue;
    counts[GAN_EL[p.gan]]++;
    counts[ZHI_EL[p.zhi]]++;
  }
  const dayGan = ec.getDayGan();
  return { source: 'saju', self: GAN_EL[dayGan], counts, birth: { y, m, d, h, mi }, pillars, dayGan, createdAt: new Date().toISOString() };
}

/**
 * 타로 입구(결정 029): 처음 뽑은 운명 카드가 그 사람의 일주(日柱)를 정한다.
 * 카드의 원소 → 일간의 오행, 카드 번호의 홀짝 → 음양. 지지는 같은 오행·같은 음양에서 고른다(60갑자에 있는 조합만 나온다).
 * 그 뒤의 오늘 운세는 생년월일 입구와 똑같이 이 일주로 본다.
 */
const STEM_OF: Record<Element, [string, string]> = { wood: ['甲', '乙'], fire: ['丙', '丁'], earth: ['戊', '己'], metal: ['庚', '辛'], water: ['壬', '癸'] };
const BRANCH_OF: Record<Element, [string[], string[]]> = {
  wood: [['寅'], ['卯']], fire: [['午'], ['巳']], earth: [['辰', '戌'], ['丑', '未']], metal: [['申'], ['酉']], water: [['子'], ['亥']],
};
export function cardPillar(card: number, element: Element): Pillar {
  const yin = card % 2;
  const branches = BRANCH_OF[element][yin];
  return { gan: STEM_OF[element][yin], zhi: branches[Math.floor(card / 2) % branches.length] };
}

export function tarotProfile(card: number, element: Element): Profile {
  // 카드 한 장에는 팔자 여덟 글자가 없으니 일주 두 글자에 운명 카드의 기운을 더해 분포를 만든다
  const day = cardPillar(card, element);
  const counts = emptyCounts();
  for (const e of ELEMENTS) counts[e] = 1;
  counts[element] = 3;
  const mother = ELEMENTS.find((e) => GEN[e] === element)!;
  counts[mother] = 2;
  return { source: 'tarot', self: element, counts, card, dayGan: day.gan, pillars: [null, null, day, null], createdAt: new Date().toISOString() };
}

const emptyCounts = (): Record<Element, number> => ({ wood: 0, fire: 0, earth: 0, metal: 0, water: 0 });

/** 가장 모자란 기운 = 행운의 기운(채워 주면 좋은 것). 같으면 생 순서상 앞쪽 */
export function luckyElement(p: Profile): Element {
  return ELEMENTS.reduce((a, b) => (p.counts[b] < p.counts[a] ? b : a));
}

// ── 십신(열 가지 관계). 라이브러리 표와 같은 결과를 내도록 직접 계산해 지지(본기)에도 쓴다
export type TenGod = 'bigyeon' | 'geopjae' | 'siksin' | 'sanggwan' | 'pyeonjae' | 'jeongjae' | 'pyeongwan' | 'jeonggwan' | 'pyeonin' | 'jeongin';
export const TEN_GODS: TenGod[] = ['bigyeon', 'geopjae', 'siksin', 'sanggwan', 'pyeonjae', 'jeongjae', 'pyeongwan', 'jeonggwan', 'pyeonin', 'jeongin'];
export const TEN_GOD_CAT: Record<TenGod, Category> = {
  bigyeon: 'friend', geopjae: 'friend', siksin: 'express', sanggwan: 'express', pyeonjae: 'wealth', jeongjae: 'wealth',
  pyeongwan: 'work', jeonggwan: 'work', pyeonin: 'learn', jeongin: 'learn',
};
const YANG = new Set(['甲', '丙', '戊', '庚', '壬']);
/** 지지의 본기(가장 강한 지장간) */
export const ZHI_MAIN: Record<string, string> = { 子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬' };
export function tenGod(dayGan: string, other: string): TenGod {
  const stem = ZHI_MAIN[other] ?? other;
  const same = YANG.has(dayGan) === YANG.has(stem);
  const pair: Record<Category, [TenGod, TenGod]> = {
    friend: ['bigyeon', 'geopjae'], express: ['siksin', 'sanggwan'], wealth: ['pyeonjae', 'jeongjae'], work: ['pyeongwan', 'jeonggwan'], learn: ['pyeonin', 'jeongin'],
  };
  return pair[relation(GAN_EL[dayGan], GAN_EL[stem])][same ? 0 : 1];
}

/** 지지 사이의 충(부딪힘)·합(어울림) */
const CLASH = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'];
const HARMONY = ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'];
export function branchRelation(a: string, b: string): 'clash' | 'harmony' | null {
  const has = (list: string[]) => list.some((x) => x === a + b || x === b + a);
  return has(CLASH) ? 'clash' : has(HARMONY) ? 'harmony' : null;
}

export interface DailyFortune {
  /** 날짜(YYYY-MM-DD) */
  date: string;
  category: Category;
  /** 오늘의 십신(사주는 일진 천간과 일간, 타로는 그날 카드의 원소와 운명 원소에 음양을 시드로) */
  god: TenGod;
  /** 오늘 일진 지지와 내 일지의 관계(사주만) */
  branch: 'clash' | 'harmony' | null;
  todayGanZhi?: string;
  todayCard?: number;
  /** 타로: 오늘 카드가 거꾸로 나왔는지(약 30%) */
  reversed?: boolean;
  todayElement: Element;
  /** 1~5 */
  score: number;
  /** 같은 날 같은 사람에게 항상 같은 문구가 나오도록 고르는 번호 */
  seed: number;
}

export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** 오늘의 운세. 사주는 오늘 일진과 일간의 십신·일지와의 충합, 타로는 그날의 카드 원소와 운명 원소의 관계 */
export function dailyFortune(p: Profile, date: Date, tarotElements: Element[]): DailyFortune {
  const key = dayKey(date);
  const who = p.source === 'saju' ? `${p.birth!.y}${p.birth!.m}${p.birth!.d}${p.birth!.h}` : `card${p.card}`;
  const seed = hash(key + who);
  let god: TenGod;
  let todayElement: Element;
  let branch: DailyFortune['branch'] = null;
  const extra: Partial<DailyFortune> = {};
  if (p.dayGan) {
    const gz = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunar().getDayInGanZhi();
    todayElement = GAN_EL[gz[0]];
    god = tenGod(p.dayGan!, gz[0]);
    branch = branchRelation(p.pillars![2]!.zhi, gz[1]);
    extra.todayGanZhi = gz;
  } else {
    const card = seed % tarotElements.length;
    todayElement = tarotElements[card];
    const cat = relation(p.self, todayElement);
    god = TEN_GODS.filter((g) => TEN_GOD_CAT[g] === cat)[(seed >> 4) % 2];
    extra.todayCard = card;
    extra.reversed = (seed >> 12) % 10 < 3;
  }
  const category = TEN_GOD_CAT[god];
  // 점수: 정인·식신·정재·정관처럼 안정된 관계는 높게, 겁재·상관·편관은 낮게. 행운의 기운 +1, 합 +1, 충 −1
  const base: Record<TenGod, number> = { bigyeon: 3, geopjae: 2, siksin: 4, sanggwan: 3, pyeonjae: 4, jeongjae: 4, pyeongwan: 2, jeonggwan: 3, pyeonin: 3, jeongin: 4 };
  let score = (extra.reversed ? -1 : 0) + base[god] + (todayElement === luckyElement(p) ? 1 : 0) + (branch === 'harmony' ? 1 : branch === 'clash' ? -1 : 0) + ((seed >> 8) % 2);
  score = Math.max(1, Math.min(5, score));
  return { date: key, category, god, branch, todayElement, score, seed, ...extra };
}
