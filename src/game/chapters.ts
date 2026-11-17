// 장(챕터)과 스테이지(결정 067). 장마다 배경·소품·적·장치가 다르고, 장 안 스테이지는 번호로 정해진 무작위로
// 섬 크기·소품 배치·시간대·무너짐·난이도가 달라진다. 모델은 모두 Kenney CC0(public/models/<팩>/).
import type { Gadget, Crumble, Rule } from './rules';

export type PropSpec = { m: string; h: number; n: readonly [number, number]; edge?: boolean };
export type Chapter = {
  id: string; name: readonly [string, string];
  sky: number; grass: number; cliff: number; sun: number; night?: boolean;
  small: readonly string[]; big: string; // 적 모델(작은 적은 1~2종을 섞는다)
  gadget: Gadget; props: readonly PropSpec[];
  rule?: Rule; ruleText?: readonly [string, string]; // 장 규칙(결정 078)과 안내 띠 문구
};

const n = (a: number, b: number) => [a, b] as const;
export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'meadow', name: ['풀밭 섬', 'Meadow Isle'], sky: 0xbfe6f5, grass: 0x86c46a, cliff: 0xb89468, sun: 0xfff0d2,
    small: ['graveyard/character-skeleton'], big: 'graveyard/character-zombie', gadget: 'spring',
    props: [
      { m: 'nature/tree_pineRoundA', h: 3, n: n(3, 5), edge: true }, { m: 'nature/tree_default', h: 2.8, n: n(3, 4), edge: true },
      { m: 'nature/flower_redA', h: 0.5, n: n(5, 8) }, { m: 'nature/flower_yellowA', h: 0.5, n: n(5, 8) },
      { m: 'nature/mushroom_redTall', h: 0.6, n: n(2, 4) }, { m: 'nature/rock_tallJ', h: 1.1, n: n(2, 3), edge: true },
      { m: 'nature/stump_old', h: 0.5, n: n(1, 3) }, { m: 'nature/plant_bush', h: 0.7, n: n(3, 5) },
    ],
  },
  {
    id: 'maple', name: ['단풍 숲', 'Maple Woods'], sky: 0xf6dcc0, grass: 0xd9a24e, cliff: 0x9a6b4a, sun: 0xffd9a8,
    small: ['chars/character-zombie'], big: 'dungeon/character-orc', gadget: 'barrel',
    props: [
      { m: 'nature/tree_oak_fall', h: 3, n: n(3, 5), edge: true }, { m: 'nature/tree_default_fall', h: 2.8, n: n(2, 4), edge: true },
      { m: 'nature/tree_cone_fall', h: 2.6, n: n(2, 3), edge: true }, { m: 'nature/log_large', h: 0.6, n: n(1, 3) },
      { m: 'nature/crop_pumpkin', h: 0.6, n: n(3, 6) }, { m: 'nature/campfire_stones', h: 0.5, n: n(1, 2) },
      { m: 'nature/log_stack', h: 0.9, n: n(1, 2) }, { m: 'nature/tent_detailedOpen', h: 1.6, n: n(0, 1), edge: true },
    ],
  },
  {
    id: 'grave', name: ['달빛 묘지', 'Moonlit Graves'], sky: 0x2d3555, grass: 0x5f8a7a, cliff: 0x6b6378, sun: 0xb9c6ff, night: true,
    small: ['graveyard/character-ghost', 'graveyard/character-skeleton'], big: 'graveyard/character-vampire', gadget: 'lantern',
    props: [
      { m: 'graveyard/pine', h: 3.2, n: n(3, 5), edge: true }, { m: 'graveyard/pine-crooked', h: 3, n: n(2, 3), edge: true },
      { m: 'graveyard/gravestone-cross', h: 0.9, n: n(3, 6) }, { m: 'graveyard/gravestone-round', h: 0.8, n: n(3, 6) },
      { m: 'graveyard/crypt-small', h: 2, n: n(1, 2), edge: true }, { m: 'graveyard/iron-fence', h: 1, n: n(2, 4), edge: true },
      { m: 'graveyard/lightpost-single', h: 2, n: n(1, 3) }, { m: 'graveyard/pumpkin-carved', h: 0.5, n: n(2, 4) },
    ],
  },
  {
    id: 'pirate', name: ['해적 해변', 'Pirate Beach'], sky: 0x9fe3f0, grass: 0xe8d39a, cliff: 0xc49a5e, sun: 0xfff4d6,
    small: ['chars/character-raider'], big: 'graveyard/character-zombie', gadget: 'barrel',
    rule: 'wind2', ruleText: ['강풍이 두 번 분다! 바람 쪽 적이 날아간다', 'Two gales! Foes blow off the edge'],
    props: [
      { m: 'pirate/palm-detailed-bend', h: 3.2, n: n(2, 4), edge: true }, { m: 'pirate/palm-straight', h: 3, n: n(2, 3), edge: true },
      { m: 'pirate/barrel', h: 0.8, n: n(2, 4) }, { m: 'pirate/crate', h: 0.7, n: n(2, 4) }, { m: 'pirate/chest', h: 0.6, n: n(1, 2) },
      { m: 'pirate/cannon', h: 0.8, n: n(1, 3), edge: true }, { m: 'pirate/rocks-sand-a', h: 0.8, n: n(2, 4) },
      { m: 'pirate/flag-pirate', h: 2.2, n: n(1, 1), edge: true },
    ],
  },
  {
    id: 'snow', name: ['눈 덮인 마을', 'Snowy Village'], sky: 0xdfeefa, grass: 0xf4f7fb, cliff: 0x9fb3c8, sun: 0xffffff,
    small: ['holiday/gingerbread-man', 'holiday/gingerbread-woman'], big: 'holiday/snowman', gadget: 'spring',
    rule: 'ice', ruleText: ['얼음 바닥! 밀린 적이 멀리 미끄러진다', 'Icy ground! Knocked foes slide far'],
    props: [
      { m: 'holiday/tree-snow-a', h: 3, n: n(2, 4), edge: true }, { m: 'holiday/tree-snow-b', h: 2.6, n: n(2, 3), edge: true },
      { m: 'holiday/tree-decorated-snow', h: 3, n: n(1, 2), edge: true }, { m: 'holiday/present-a-cube', h: 0.6, n: n(2, 4) },
      { m: 'holiday/present-b-round', h: 0.6, n: n(2, 4) }, { m: 'holiday/sled', h: 0.6, n: n(1, 2) },
      { m: 'holiday/lantern', h: 1.2, n: n(1, 3) }, { m: 'holiday/snow-pile', h: 0.6, n: n(2, 4) },
    ],
  },
  {
    id: 'castle', name: ['성벽 섬', 'Castle Isle'], sky: 0xcfe3f2, grass: 0x7fb069, cliff: 0x8a8f99, sun: 0xfff0d2,
    small: ['chars/character-knight', 'chars/character-soldier'], big: 'dungeon/character-orc', gadget: 'barrel',
    props: [
      { m: 'castle/tree-large', h: 3, n: n(3, 5), edge: true }, { m: 'castle/tree-small', h: 2, n: n(2, 4) },
      { m: 'castle/rocks-large', h: 1, n: n(1, 3), edge: true }, { m: 'castle/rocks-small', h: 0.5, n: n(2, 4) },
      { m: 'castle/flag', h: 2.4, n: n(1, 2), edge: true }, { m: 'castle/siege-catapult', h: 1.4, n: n(1, 1), edge: true },
      { m: 'castle/siege-ballista', h: 1.2, n: n(0, 1), edge: true },
    ],
  },
  {
    id: 'town', name: ['판타지 마을', 'Fairy Town'], sky: 0xc8e8ff, grass: 0x8fcf72, cliff: 0xa88f6a, sun: 0xfff2dc,
    small: ['chars/character-male-a', 'chars/character-female-c'], big: 'chars/character-soldier', gadget: 'spring',
    props: [
      { m: 'town/tree', h: 2.8, n: n(2, 4), edge: true }, { m: 'town/tree-high-round', h: 3.2, n: n(2, 3), edge: true },
      { m: 'town/tree-crooked', h: 2.6, n: n(1, 2), edge: true }, { m: 'town/cart', h: 1, n: n(1, 2) },
      { m: 'town/stall-red', h: 1.6, n: n(1, 2), edge: true }, { m: 'town/fountain-round', h: 1.2, n: n(0, 1) },
      { m: 'town/hedge', h: 0.9, n: n(2, 4) }, { m: 'town/rock-large', h: 1, n: n(1, 2) },
    ],
  },
  {
    id: 'sweets', name: ['과자 섬', 'Candy Isle'], sky: 0xffd9ec, grass: 0xffb3c7, cliff: 0xc9845c, sun: 0xfff0f5,
    small: ['food/donut-sprinkles', 'food/cupcake'], big: 'food/burger-double', gadget: 'spring',
    rule: 'springs', ruleText: ['스프링 버섯이 두 배!', 'Double the spring mushrooms!'],
    props: [
      { m: 'food/cake-birthday', h: 1.6, n: n(1, 2), edge: true }, { m: 'food/ice-cream', h: 1.4, n: n(1, 3), edge: true },
      { m: 'food/lollypop', h: 1.8, n: n(2, 3), edge: true }, { m: 'food/apple', h: 0.7, n: n(2, 4) },
      { m: 'food/strawberry', h: 0.6, n: n(2, 4) }, { m: 'food/watermelon', h: 1, n: n(1, 2) },
      { m: 'food/candy-bar', h: 0.6, n: n(1, 3) }, { m: 'food/muffin', h: 0.8, n: n(1, 3) },
    ],
  },
  {
    id: 'moon', name: ['달 기지', 'Moon Base'], sky: 0x141a33, grass: 0x9aa0b5, cliff: 0x5c6070, sun: 0xcfd8ff, night: true,
    small: ['chars/character-alien'], big: 'chars/character-robot', gadget: 'lantern',
    rule: 'lowGrav', ruleText: ['저중력! 맞은 적이 높이 떠오른다', 'Low gravity! Hit foes float high'],
    props: [
      { m: 'space/rocksTall', h: 1.6, n: n(2, 4), edge: true }, { m: 'space/rocks', h: 0.8, n: n(2, 4) },
      { m: 'space/crater', h: 0.3, n: n(2, 4) }, { m: 'space/satelliteDish', h: 1.8, n: n(1, 2), edge: true },
      { m: 'space/spaceCraft1', h: 1.6, n: n(1, 1), edge: true }, { m: 'space/meteorFull', h: 0.9, n: n(1, 3) },
      { m: 'space/barrel', h: 0.8, n: n(1, 3) }, { m: 'space/alienBones', h: 0.6, n: n(1, 2) },
    ],
  },
  {
    id: 'dungeon', name: ['던전 섬', 'Dungeon Isle'], sky: 0x3a2f45, grass: 0x7a7f86, cliff: 0x5a4f45, sun: 0xffcf9a, night: true,
    small: ['graveyard/character-skeleton', 'chars/character-zombie'], big: 'dungeon/character-orc', gadget: 'barrel',
    props: [
      { m: 'dungeon/column', h: 2.2, n: n(3, 5), edge: true }, { m: 'dungeon/banner', h: 2, n: n(1, 3), edge: true },
      { m: 'dungeon/chest', h: 0.6, n: n(1, 2) }, { m: 'dungeon/stones', h: 0.4, n: n(3, 5) },
      { m: 'dungeon/rocks', h: 0.6, n: n(2, 3) }, { m: 'dungeon/wood-support', h: 1.8, n: n(1, 2), edge: true },
      { m: 'dungeon/trap', h: 0.3, n: n(1, 2) },
    ],
  },
];

export const STAGES_PER_CHAPTER = 15;
export const STAGE_COUNT = CHAPTERS.length * STAGES_PER_CHAPTER;

export type TimeOfDay = 'day' | 'dusk' | 'night';
export type StageDef = {
  no: number; chapter: number; inChapter: number; seed: number; r: number; crumbles: Crumble[];
  spawn: number; big: number; hp: number; speed: number; dmg: number; time: TimeOfDay; finale: boolean;
};

/** 장 규칙이 봇 승률을 올린 만큼 그 장을 단단하게(봇 측정, 결정 078). 강풍·스프링은 승률 변화가 작아 그대로 */
export const RULE_TOUGH: Record<string, number> = { ice: 1.35, lowGrav: 1.15 };

/** 스테이지 번호(0부터) → 그 스테이지의 규칙. 같은 번호면 늘 같다 */
export function stageDef(no: number, rand: () => number): StageDef {
  const chapter = Math.floor(no / STAGES_PER_CHAPTER), s = no % STAGES_PER_CHAPTER, ch = CHAPTERS[chapter];
  const p = no / (STAGE_COUNT - 1); // 0 → 1 로 전체 난이도가 오른다
  const inCh = s / (STAGES_PER_CHAPTER - 1); // 장 안에서도 조금씩
  const r = Math.round((13 - inCh * 2.2 - rand() * 0.8) * 10) / 10; // 장 끝으로 갈수록 좁아진다(떨어뜨리기가 늘어남)
  const nCr = 2 + Math.min(2, Math.floor(chapter / 3)); // 무너지는 횟수 2~4
  const first = 25 + Math.round(rand() * 10), gap = Math.floor((90 - first) / nCr);
  const crumbles: Crumble[] = [];
  for (let k = 0; k < nCr; k++) {
    const at = first + k * gap;
    if (Math.abs(at - 65) <= 4 || Math.abs(at - 95) <= 4 || Math.abs(at - 55) <= 2) continue; // 보너스·왕좀비·날씨 경고와 겹치지 않게
    crumbles.push({ at, r: Math.round((r - (k + 1) * (r - 8.4) / nCr) * 10) / 10 });
  }
  const time: TimeOfDay = ch.night ? 'night' : rand() < 0.2 ? 'dusk' : 'day';
  const tough = RULE_TOUGH[ch.rule ?? ''] ?? 1; // 쉬워지는 장 규칙만큼 적 수·피해를 올린다(결정 078)
  const easy = [0.6, 0.75, 0.88][no] ?? 1; // 맨 앞 세 스테이지는 서툴게 해도 깨지게: 적 수는 그대로(줄이면 첫 레벨 업이 41초로 늘어 지루), 피해·큰 적만 줄임(결정 074)
  return {
    no, chapter, inChapter: s, seed: no * 9973 + 17, r, crumbles, time, finale: s === STAGES_PER_CHAPTER - 1,
    // 뒤 장을 가파르게(결정 072): 강화가 체감되게 세진 만큼 1장은 그대로 두고 뒤로 갈수록 더 단단하게
    spawn: (0.55 + p * 1.4 + inCh * 0.15) * tough, big: (0.45 + p * 1.4) * easy, hp: 0.6 + p * 3.2 + inCh * 0.3,
    speed: 0.85 + p * 0.3, dmg: (0.45 + p * 0.5) * easy * tough, // p * 1.0 → 0.5(결정 078): 카드가 줄어 뒤 장에서 체력·회복 카드가 덜 쌓인다(적 체력을 낮춰도 승률이 그대로였다)
  };
}

/** 이 장에서 쓰는 모델 경로(불러오기용) */
export const chapterModels = (c: Chapter) => [...new Set([...c.small, c.big, ...c.props.map((p) => p.m)])];
export const allModels = () => [...new Set(CHAPTERS.flatMap(chapterModels))];
