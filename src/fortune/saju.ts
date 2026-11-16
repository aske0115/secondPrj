// 사주·타로 → 같은 "기운 프로필"(결정 024). 계산은 만세력 라이브러리(lunar-javascript, MIT)를 쓰고,
// 해석은 전통 명리의 오행 생극·십신 관계를 따른다. 재미로 보는 운세이며 과학적 예측이 아니다.
import { Solar, LunarUtil } from 'lunar-javascript';

export type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export const ELEMENTS: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];

/** 오늘 기운과 나의 관계 = 십신의 다섯 갈래 */
export type Category = 'friend' | 'express' | 'wealth' | 'work' | 'learn';

const GAN_EL: Record<string, Element> = { 甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth', 己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water' };
const ZHI_EL: Record<string, Element> = {
  寅: 'wood', 卯: 'wood', 巳: 'fire', 午: 'fire', 辰: 'earth', 戌: 'earth', 丑: 'earth', 未: 'earth', 申: 'metal', 酉: 'metal', 亥: 'water', 子: 'water',
};
export const HANGUL: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
};
/** 라이브러리의 십신 이름(간체) → 다섯 갈래와 한글 이름 */
const SHI_SHEN: Record<string, { cat: Category; ko: string; en: string }> = {
  比肩: { cat: 'friend', ko: '비견', en: 'Companion' },
  劫财: { cat: 'friend', ko: '겁재', en: 'Rival' },
  食神: { cat: 'express', ko: '식신', en: 'Joy' },
  伤官: { cat: 'express', ko: '상관', en: 'Flair' },
  偏财: { cat: 'wealth', ko: '편재', en: 'Windfall' },
  正财: { cat: 'wealth', ko: '정재', en: 'Earnings' },
  七杀: { cat: 'work', ko: '편관', en: 'Challenge' },
  正官: { cat: 'work', ko: '정관', en: 'Duty' },
  偏印: { cat: 'learn', ko: '편인', en: 'Insight' },
  正印: { cat: 'learn', ko: '정인', en: 'Support' },
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

export function sajuProfile(y: number, m: number, d: number, h: number | null, mi = 0): Profile {
  // 시각을 모르면 정오로 계산하되 시주는 쓰지 않는다(일주는 자시 경계를 벗어나 안전)
  const ec = Solar.fromYmdHms(y, m, d, h ?? 12, h === null ? 0 : mi, 0).getLunar().getEightChar();
  const split = (gz: string): Pillar => ({ gan: gz[0], zhi: gz[1] });
  const pillars: (Pillar | null)[] = [split(ec.getYear()), split(ec.getMonth()), split(ec.getDay()), h === null ? null : split(ec.getTime())];
  const counts = emptyCounts();
  for (const p of pillars) {
    if (!p) continue;
    counts[GAN_EL[p.gan]]++;
    counts[ZHI_EL[p.zhi]]++;
  }
  const dayGan = ec.getDayGan();
  return { source: 'saju', self: GAN_EL[dayGan], counts, birth: { y, m, d, h, mi }, pillars, dayGan, createdAt: new Date().toISOString() };
}

export function tarotProfile(card: number, element: Element): Profile {
  // 카드 한 장에는 팔자가 없으니, 운명 카드의 원소를 중심으로 그 원소를 낳는 기운을 조금 더한 분포를 만든다
  const counts = emptyCounts();
  for (const e of ELEMENTS) counts[e] = 1;
  counts[element] = 3;
  const mother = ELEMENTS.find((e) => GEN[e] === element)!;
  counts[mother] = 2;
  return { source: 'tarot', self: element, counts, card, createdAt: new Date().toISOString() };
}

const emptyCounts = (): Record<Element, number> => ({ wood: 0, fire: 0, earth: 0, metal: 0, water: 0 });

/** 가장 모자란 기운 = 행운의 기운(채워 주면 좋은 것). 같으면 생 순서상 앞쪽 */
export function luckyElement(p: Profile): Element {
  return ELEMENTS.reduce((a, b) => (p.counts[b] < p.counts[a] ? b : a));
}

export interface DailyFortune {
  /** 날짜(YYYY-MM-DD) */
  date: string;
  category: Category;
  /** 사주: 오늘 일진의 십신 이름 / 타로: 오늘의 카드 번호 */
  shiShen?: { ko: string; en: string };
  todayGanZhi?: string;
  todayCard?: number;
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

/** 오늘의 운세. 사주는 오늘 일진과 일간의 십신, 타로는 그날의 카드 원소와 운명 원소의 관계 */
export function dailyFortune(p: Profile, date: Date, tarotElements: Element[]): DailyFortune {
  const key = dayKey(date);
  const who = p.source === 'saju' ? `${p.birth!.y}${p.birth!.m}${p.birth!.d}${p.birth!.h}` : `card${p.card}`;
  const seed = hash(key + who);
  let category: Category;
  let todayElement: Element;
  const extra: Partial<DailyFortune> = {};
  if (p.source === 'saju') {
    const lunar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunar();
    const gz = lunar.getDayInGanZhi();
    todayElement = GAN_EL[gz[0]];
    const ss = SHI_SHEN[LunarUtil.SHI_SHEN[p.dayGan! + gz[0]]];
    category = ss.cat;
    extra.shiShen = { ko: ss.ko, en: ss.en };
    extra.todayGanZhi = gz;
  } else {
    const card = seed % tarotElements.length;
    todayElement = tarotElements[card];
    category = relation(p.self, todayElement);
    extra.todayCard = card;
  }
  // 점수: 나를 돕는 날(인성·비겁)은 높고, 나를 누르는 날(관성)은 낮게. 행운의 기운이 들어오면 +1
  const base: Record<Category, number> = { learn: 4, friend: 3, express: 4, wealth: 4, work: 2 };
  let score = base[category] + (todayElement === luckyElement(p) ? 1 : 0) + ((seed >> 8) % 3) - 1;
  score = Math.max(1, Math.min(5, score));
  return { date: key, category, todayElement, score, seed, ...extra };
}
