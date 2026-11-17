// 무기 8종의 겉모습(결정 085 보완, docs/WEAPONS.md 6-4·7장): 코드 도형을 조각마다 색칠해 한 덩어리로 굽는다(무기 하나 = 그리기 1번).
// 휴대폰에서 무기는 30~50px라 무늬가 아니라 실루엣·고유색으로 구분한다. 모든 무기는 손잡이가 원점, +z 쪽으로 뻗는다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MASTERY_LINES, MASTERY_MAX, masteryMods, weaponRec, weaponWind } from './game/rules';
import { weaponOpen, type WeaponId } from './game/meta';

type KoEn = readonly [string, string];
/** 이름·한 줄 손맛·아이콘 바탕색·아이콘(24×24 흰 선, 기존 ICON 방식) */
export const UI: Record<WeaponId, { name: KoEn; tag: KoEn; color: string; icon: string }> = {
  hammer: { name: ['망치', 'Mallet'], tag: ['쾅!이 더 자주', 'More SLAMs'], color: '#f0a24a', icon: '<path d="M5 19l8-8M9 5l6-1 5 5-1 6-4-4-2 2-4-4 2-2z"/>' },
  squeaky: { name: ['뿅망치', 'Squeaky Hammer'], tag: ['빠른 두 번', 'Quick double tap'], color: '#ef5da8', icon: '<rect x="7" y="3" width="13" height="8" rx="3"/><path d="M11 3v8M15.5 3v8M12 11l-6 10"/>' },
  sledge: { name: ['대형 해머', 'Sledgehammer'], tag: ['둥근 충격파', 'Round shockwave'], color: '#6b7280', icon: '<rect x="3" y="2.5" width="16" height="9" rx="1.5"/><path d="M11 11.5v10M7 21.5h8"/>' },
  twin: { name: ['스펀지 쌍검', 'Foam Twins'], tag: ['준비 없이 다다닥', 'No wind-up'], color: '#3d7ff2', icon: '<path d="M5 3l11 11M19 3L8 14M5 13l6 6M19 13l-6 6M4 20l3-3M20 20l-3-3"/>' },
  pan: { name: ['프라이팬', 'Frying Pan'], tag: ['방패 무시', 'Ignores shields'], color: '#2f3640', icon: '<ellipse cx="9" cy="11" rx="7" ry="3.2"/><path d="M2 11v2a7 3.2 0 0 0 14 0v-2"/><path d="M16.5 11.5h5" stroke-width="3.6"/>' },
  bat: { name: ['야구방망이', 'Bat'], tag: ['멀리 한 방', 'One big hit'], color: '#c98a3e', icon: '<path d="M3.5 20.5l2-2M6.5 17.5L16 6a2.8 2.8 0 0 1 4 4L8.5 19.5z"/>' },
  pole: { name: ['펀치 막대', 'Punch Pole'], tag: ['일직선 관통', 'Pierces a line'], color: '#e2483c', icon: '<path d="M3 21L13 11"/><circle cx="16.5" cy="7.5" r="4.5"/><path d="M12.5 6.5a2.5 2.5 0 0 1 2-3"/>' },
  fan: { name: ['큰 부채', 'Giant Fan'], tag: ['바람으로 밀기', 'Blows foes away'], color: '#3fb6e8', icon: '<path d="M12 19L3.5 10.5a12 12 0 0 1 17 0z"/><path d="M12 19l-4-10M12 19l4-10M12 19v3"/>' },
};

/** 이번 판 무기 고르기(결정 088 보완): 직접 고름(열려 있으면) > 자동이면 추천(잠겼으면 상징 무기 망치) > 저장해 둔 무기 */
export function pickRunWeapon(manual: WeaponId | null, auto: boolean, rec: WeaponId, saved: WeaponId, cleared: number): WeaponId {
  if (manual && weaponOpen(manual, cleared)) return manual;
  if (auto) return weaponOpen(rec, cleared) ? rec : 'hammer';
  return saved;
}

/** 숙련 단계 L(1~10)에 오르면 무엇이 붙는지 한 줄(무기 시트 「다음:」, 결과 화면). 준비·후딜은 하한까지 반영한 실제 줄어드는 값 */
export function masteryStep(id: WeaponId, level: number): KoEn {
  if (level >= MASTERY_MAX) return ['달인: 동작이 Lv2부터', 'Master: bonus move from Lv2'];
  const { k, v } = MASTERY_LINES[id][(level - 1) % 3], pct = Math.round(Math.abs(v) * 100);
  const drop = (f: typeof weaponWind) => +(f(id, 1, masteryMods(id, level - 1)) - f(id, 1, masteryMods(id, level))).toFixed(2);
  switch (k) {
    case 'range': return id === 'sledge' ? [`충격파 +${pct}%`, `Shockwave +${pct}%`] : id === 'pole' ? [`길이 +${pct}%`, `Length +${pct}%`] : [`사거리 +${pct}%`, `Reach +${pct}%`];
    case 'rest': return [`쉼 −${pct}%`, `Rest −${pct}%`]; // 숙련은 쉼만 줄인다(준비·후딜은 그대로)
    case 'charge': return [`쾅! 충전 +${pct}%`, `Slam charge +${pct}%`];
    case 'lastKnock': return id === 'squeaky' ? [`둘째 타 넉백 +${pct}%`, `2nd tap knock +${pct}%`] : [`마지막 타 넉백 +${pct}%`, `Last hit knock +${pct}%`];
    case 'arc': return [`각도 +${v}°`, `Arc +${v}°`];
    case 'wind': { const d = drop(weaponWind); return d > 0 ? [`준비 −${d}초`, `Wind-up −${d}s`] : ['준비 최소', 'Wind-up at minimum']; }
    case 'rec': { const d = drop(weaponRec); return d > 0 ? [`후딜 −${d}초`, `Recovery −${d}s`] : ['후딜 최소', 'Recovery at minimum']; }
    case 'knock': return [`넉백 +${pct}%`, `Knockback +${pct}%`];
    default: return [`관통 +${v}`, `Pierce +${v}`];
  }
}

// ───── 3D 모양 ─────
const GOLD = 0xffc94d;
const tint = (geo: THREE.BufferGeometry, hex: number) => {
  const c = new THREE.Color(hex), a = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) c.toArray(a, i);
  return geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
};
/** z0에서 +z로 len만큼 뻗는 원기둥(r1: 시작 쪽, r2: 끝 쪽) */
const rod = (r1: number, r2: number, len: number, z0: number, seg = 7) => new THREE.CylinderGeometry(r2, r1, len, seg).rotateX(Math.PI / 2).translate(0, 0, z0 + len / 2);
/** x축으로 누운 원기둥(망치 머리 등) */
const across = (r: number, len: number, z: number, x = 0, seg = 10) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2).translate(x, 0, z);
const box = (w: number, h: number, d: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(0, 0, z);
const ball = (r: number, x: number, y: number, z: number, seg = 8) => new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2)).translate(x, y, z);

type Part = [THREE.BufferGeometry, number];
/** tier: 0 = Lv1 재질, 1 = Lv2~3 재질, 2 = Lv4~5 금(한 부분은 고유색으로 남긴다). left: 쌍검 왼손(빨강·주황) */
function parts(id: WeaponId, tier: number, left: boolean): { p: Part[]; tip: number } {
  const t = <T,>(a: T, b: T, c: T) => (tier === 0 ? a : tier === 1 ? b : c);
  switch (id) {
    case 'hammer': // T자 기준: 나무 자루·나무 → 쇠 → 금 머리
      return { tip: 1.4, p: [[rod(0.07, 0.06, 1.1, 0), 0x8a5a3c], [box(0.55, 0.36, 0.36, 1.15), t(0xc99a5c, 0x9aa3b0, GOLD)]] };
    case 'squeaky': { // 망치보다 머리가 1.3배 작다. 빨간 주름 원통 + 노란 캡(Lv2 파랑·흰)
      const body = t(0xe5484d, 0x3d7ff2, 0xe5484d), cap = t(0xffd23f, 0xffffff, GOLD), stick = t(0xffd23f, 0xffffff, GOLD);
      return { tip: 1.15, p: [
        [rod(0.05, 0.045, 0.85, 0), stick],
        [across(0.13, 0.08, 0.95, -0.1), body], [across(0.115, 0.06, 0.95, 0), body], [across(0.13, 0.08, 0.95, 0.1), body],
        [across(0.14, 0.05, 0.95, -0.17), cap], [across(0.14, 0.05, 0.95, 0.17), cap],
      ] };
    }
    case 'sledge': // 머리 1.8배 진회색 돌 → 쇠 → 금, 양 끝 납작한 원기둥은 늘 진회색
      return { tip: 1.75, p: [
        [rod(0.08, 0.07, 1.3, 0), 0x6e4a30], [box(1.0, 0.62, 0.62, 1.38), t(0x6b6f76, 0x8a96a6, GOLD)],
        [across(0.36, 0.08, 1.38, -0.53, 12), 0x3a3d42], [across(0.36, 0.08, 1.38, 0.53, 12), 0x3a3d42],
      ] };
    case 'twin': { // 굵은 스펀지 날·둥근 끝·큰 노란 십자 가드. 오른손 파랑, 왼손 빨강(Lv2 초록·주황, 금 단계는 가드·손잡이만 금)
      const blade = left ? t(0xe5484d, 0xff9a3c, 0xff9a3c) : t(0x3d7ff2, 0x3fbf6a, 0x3fbf6a), guard = t(0xffd23f, 0xffd23f, GOLD), grip = t(0x6e4a30, 0x6e4a30, GOLD);
      return { tip: 1.15, p: [
        [rod(0.05, 0.05, 0.3, -0.06), grip], [ball(0.07, 0, 0, -0.08), guard], [box(0.5, 0.11, 0.11, 0.26), guard],
        [box(0.19, 0.12, 0.74, 0.68), blade], [new THREE.CylinderGeometry(0.095, 0.095, 0.12, 12).translate(0, 0, 1.05), blade],
      ] };
    }
    case 'pan': { // 검은 원판(안쪽은 늘 검정) + 나무 자루, 테두리만 무쇠 → 스테인리스 → 금
      return { tip: 1.45, p: [
        [rod(0.05, 0.045, 0.6, 0), 0x8a5a3c], [rod(0.045, 0.045, 0.12, 0.55), t(0x2e2e33, 0xc8ccd2, GOLD)],
        [new THREE.CylinderGeometry(0.44, 0.4, 0.1, 16).translate(0, 0, 1.08), t(0x2e2e33, 0xc8ccd2, GOLD)],
        [new THREE.CylinderGeometry(0.37, 0.37, 0.1, 16).translate(0, 0.012, 1.08), 0x1f1f24],
      ] };
    }
    case 'bat': // 밝은 나무색, 끝이 굵은 막대 + 빨간 손잡이 테이프(금 단계에도 남김)
      return { tip: 1.5, p: [
        [rod(0.05, 0.13, 1.25, 0, 9), t(0xe8c48a, 0xb9c3cf, GOLD)], [ball(0.13, 0, 0, 1.25, 9), t(0xe8c48a, 0xb9c3cf, GOLD)],
        [rod(0.058, 0.064, 0.34, 0.02, 7), 0xd8423a], [new THREE.CylinderGeometry(0.085, 0.085, 0.05, 9).rotateX(Math.PI / 2).translate(0, 0, -0.01), 0xd8423a],
      ] };
    case 'pole': { // 주인공 키 1.6배 가장 긴 막대 + 끝에 빨간 권투 장갑(장갑은 늘 빨강)
      const z = -0.35; // 막대 끝에서 조금 앞을 쥔다
      return { tip: 2.05 + z, p: [
        [rod(0.04, 0.04, 1.85, z), t(0xf3f0e8, 0x3d7ff2, GOLD)], [rod(0.13, 0.15, 0.14, 1.78 + z, 10), 0xffffff],
        [ball(0.21, 0, 0, 2.02 + z, 10).scale(1, 0.92, 1.1), 0xe5484d], [ball(0.085, 0.17, 0.06, 1.97 + z), 0xe5484d],
      ] };
    }
    case 'fan': { // 하늘색 납작한 반원 + 짧은 자루. Lv2 비단 줄무늬, 금 단계는 살·자루만 금
      const leaf: Part[] = [];
      for (let k = 0; k < 6; k++)
        leaf.push([new THREE.CylinderGeometry(0.78, 0.78, 0.03, 3, 1, false, -Math.PI / 2 + (k * Math.PI) / 6, Math.PI / 6).translate(0, 0, 0.3), tier && k % 2 ? 0xc8eeff : 0x8fd6f5]);
      const rib = t(0x4f9cc4, 0x4f9cc4, GOLD);
      for (let k = 0; k < 5; k++) leaf.push([box(0.03, 0.05, 0.76, 0.38).translate(0, 0, -0.3).rotateY(((k - 2) * Math.PI) / 6.2).translate(0, 0.02, 0.3), rib]);
      return { tip: 1.15, p: [[rod(0.04, 0.035, 0.36, -0.04), rib], ...leaf] };
    }
  }
}
const cache = new Map<string, THREE.BufferGeometry>();
/** 무기 모양(단계·★·쌍검 왼손별로 한 번만 굽는다) */
export function weaponGeo(id: WeaponId, tier: number, star: boolean, left = false): THREE.BufferGeometry {
  const key = `${id}|${tier}|${star}|${left}`;
  let geo = cache.get(key);
  if (!geo) {
    const { p, tip } = parts(id, tier, left);
    if (star) p.push([new THREE.OctahedronGeometry(0.11).translate(0, 0.18, tip), 0xfff176]); // 숙련 ★: 끝에 작은 노란 별
    geo = mergeGeometries(p.map(([g, c]) => tint(g.index ? g.toNonIndexed() : g, c))); // 별(팔면체)은 인덱스가 없어 모두 풀어서 합친다
    cache.set(key, geo);
  }
  return geo;
}
/** 카드 레벨 → 재질 단계(나무 → 쇠 → 금) */
export const tierOf = (lv: number) => (lv <= 1 ? 0 : lv <= 3 ? 1 : 2);
