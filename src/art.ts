// 직접 그린 SVG 일러스트(결정 025). 외부 에셋 없이 펫 다섯 종·타로 앞뒷면·도장을 코드로 그린다.
// 모든 그림은 같은 규칙(둥근 실루엣, 큰 눈+하이라이트, 볼터치, 부드러운 그라데이션, 금색 장식)을 따라 화풍을 맞춘다.
import type { Element } from './fortune/saju';

const PAL: Record<Element, { a: string; b: string; c: string; d: string }> = {
  // a 몸 밝은색, b 몸 어두운색, c 포인트, d 외곽선
  wood: { a: '#b98a5e', b: '#8c6239', c: '#7cc36e', d: '#5b3d22' },
  fire: { a: '#f39a4a', b: '#d9612a', c: '#ffd36b', d: '#7a2e12' },
  earth: { a: '#d9a35f', b: '#a8723a', c: '#f5d9a8', d: '#5e3b17' },
  metal: { a: '#e9e6ef', b: '#a9a3bd', c: '#e3b45a', d: '#4d4766' },
  water: { a: '#6cc2b8', b: '#2f8a86', c: '#bfeee5', d: '#1d4d55' },
};

/** 눈(큰 눈동자 + 하이라이트 두 개), 깜빡임은 CSS(.blink) */
function eyes(cx: number, cy: number, gap: number, r: number, ring = '') {
  const one = (x: number) => `
    ${ring ? `<circle cx="${x}" cy="${cy}" r="${r + 5}" fill="${ring}"/>` : ''}
    <g class="blink" style="transform-origin:${x}px ${cy}px">
      <ellipse cx="${x}" cy="${cy}" rx="${r}" ry="${r * 1.12}" fill="#2a1d2e"/>
      <circle cx="${x - r * 0.35}" cy="${cy - r * 0.4}" r="${r * 0.38}" fill="#fff"/>
      <circle cx="${x + r * 0.35}" cy="${cy + r * 0.35}" r="${r * 0.16}" fill="#fff" opacity=".8"/>
    </g>`;
  return one(cx - gap) + one(cx + gap);
}
const cheeks = (cx: number, cy: number, gap: number) =>
  `<ellipse cx="${cx - gap}" cy="${cy}" rx="9" ry="5.5" fill="#ff8fa3" opacity=".55"/><ellipse cx="${cx + gap}" cy="${cy}" rx="9" ry="5.5" fill="#ff8fa3" opacity=".55"/>`;
const mouth = (cx: number, cy: number, c: string) =>
  `<path d="M${cx - 6} ${cy} q6 6 12 0" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`;
const shadow = `<ellipse cx="100" cy="186" rx="52" ry="8" fill="#000" opacity=".22"/>`;

function grad(id: string, a: string, b: string) {
  return `<radialGradient id="${id}" cx="40%" cy="30%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
}

const PETS: Record<Element, (id: string) => string> = {
  // 숲사슴: 잎이 돋은 뿔, 등의 하얀 점
  wood: (id) => {
    const p = PAL.wood;
    return `<defs>${grad(id, p.a, p.b)}</defs>${shadow}
      <path d="M70 52 q-14 -26 -4 -40 M70 40 q-12 -6 -18 -2 M130 52 q14 -26 4 -40 M130 40 q12 -6 18 -2" stroke="${p.d}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <ellipse cx="55" cy="16" rx="9" ry="5" fill="${p.c}" transform="rotate(-30 55 16)"/><ellipse cx="146" cy="16" rx="9" ry="5" fill="${p.c}" transform="rotate(30 146 16)"/>
      <ellipse cx="47" cy="68" rx="20" ry="11" fill="${p.b}" transform="rotate(-25 47 68)"/><ellipse cx="153" cy="68" rx="20" ry="11" fill="${p.b}" transform="rotate(25 153 68)"/>
      <ellipse cx="100" cy="122" rx="66" ry="62" fill="url(#${id})" stroke="${p.d}" stroke-width="3"/>
      <ellipse cx="100" cy="146" rx="38" ry="28" fill="#f3e1c6"/>
      <circle cx="62" cy="108" r="4" fill="#fff6" /><circle cx="140" cy="104" r="5" fill="#fff6"/><circle cx="148" cy="124" r="3.5" fill="#fff6"/>
      ${eyes(100, 112, 24, 9)}${cheeks(100, 132, 38)}
      <ellipse cx="100" cy="134" rx="7" ry="5" fill="${p.d}"/>${mouth(100, 141, p.d)}`;
  },
  // 불꼬리여우: 뾰족 귀, 끝이 불꽃인 꼬리
  fire: (id) => {
    const p = PAL.fire;
    return `<defs>${grad(id, p.a, p.b)}<linearGradient id="${id}f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff7b39"/><stop offset="1" stop-color="#ffe27a"/></linearGradient></defs>${shadow}
      <path d="M150 160 q40 -10 34 -60 q-6 -24 -22 -30 q10 24 -4 40 q-10 14 -24 14z" fill="url(#${id}f)" stroke="${p.d}" stroke-width="2.5"/>
      <path d="M50 70 L58 18 L92 54z" fill="url(#${id})" stroke="${p.d}" stroke-width="3" stroke-linejoin="round"/><path d="M62 52 L64 32 L80 50z" fill="#ffd9c2"/>
      <path d="M150 70 L142 18 L108 54z" fill="url(#${id})" stroke="${p.d}" stroke-width="3" stroke-linejoin="round"/><path d="M138 52 L136 32 L120 50z" fill="#ffd9c2"/>
      <ellipse cx="100" cy="120" rx="64" ry="60" fill="url(#${id})" stroke="${p.d}" stroke-width="3"/>
      <path d="M74 132 q26 26 52 0 q-4 26 -26 30 q-22 -4 -26 -30z" fill="#fff4e6"/>
      ${eyes(100, 110, 25, 9)}${cheeks(100, 130, 40)}
      <ellipse cx="100" cy="132" rx="6" ry="4.5" fill="${p.d}"/>${mouth(100, 139, p.d)}`;
  },
  // 언덕곰: 둥근 귀, 배의 반달 무늬
  earth: (id) => {
    const p = PAL.earth;
    return `<defs>${grad(id, p.a, p.b)}</defs>${shadow}
      <circle cx="54" cy="58" r="20" fill="url(#${id})" stroke="${p.d}" stroke-width="3"/><circle cx="54" cy="58" r="10" fill="${p.c}"/>
      <circle cx="146" cy="58" r="20" fill="url(#${id})" stroke="${p.d}" stroke-width="3"/><circle cx="146" cy="58" r="10" fill="${p.c}"/>
      <ellipse cx="100" cy="122" rx="68" ry="62" fill="url(#${id})" stroke="${p.d}" stroke-width="3"/>
      <path d="M78 156 q22 -14 44 0 q-22 10 -44 0z" fill="${p.c}"/>
      <ellipse cx="100" cy="132" rx="24" ry="17" fill="${p.c}"/>
      ${eyes(100, 108, 26, 8.5)}${cheeks(100, 128, 42)}
      <ellipse cx="100" cy="126" rx="8" ry="5.5" fill="${p.d}"/>${mouth(100, 135, p.d)}`;
  },
  // 은빛부엉이: 귀깃, 금테 큰 눈, 가슴 깃털
  metal: (id) => {
    const p = PAL.metal;
    return `<defs>${grad(id, p.a, p.b)}</defs>${shadow}
      <path d="M50 80 L44 40 L82 62z" fill="${p.b}" stroke="${p.d}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M150 80 L156 40 L118 62z" fill="${p.b}" stroke="${p.d}" stroke-width="3" stroke-linejoin="round"/>
      <ellipse cx="100" cy="120" rx="64" ry="64" fill="url(#${id})" stroke="${p.d}" stroke-width="3"/>
      <path d="M70 140 q6 8 12 0 q6 8 12 0 q6 8 12 0 q6 8 12 0 q6 8 12 0" fill="none" stroke="${p.b}" stroke-width="2.5"/>
      <path d="M76 156 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0" fill="none" stroke="${p.b}" stroke-width="2.5"/>
      <path d="M38 118 q-6 30 18 46" fill="none" stroke="${p.b}" stroke-width="8" stroke-linecap="round"/>
      <path d="M162 118 q6 30 -18 46" fill="none" stroke="${p.b}" stroke-width="8" stroke-linecap="round"/>
      ${eyes(100, 102, 26, 10, p.c)}
      <path d="M94 118 L100 130 L106 118z" fill="${p.c}" stroke="${p.d}" stroke-width="2" stroke-linejoin="round"/>
      ${cheeks(100, 124, 44)}`;
  },
  // 물결거북: 물결무늬 등딱지, 빼꼼 내민 머리
  water: (id) => {
    const p = PAL.water;
    return `<defs>${grad(id, p.a, p.b)}<radialGradient id="${id}h" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#d8f4c9"/><stop offset="1" stop-color="#8fca86"/></radialGradient></defs>${shadow}
      <ellipse cx="56" cy="168" rx="16" ry="10" fill="#8fca86" stroke="${p.d}" stroke-width="2.5"/><ellipse cx="144" cy="168" rx="16" ry="10" fill="#8fca86" stroke="${p.d}" stroke-width="2.5"/>
      <path d="M30 150 q4 -86 70 -88 q66 2 70 88z" fill="url(#${id})" stroke="${p.d}" stroke-width="3"/>
      <path d="M48 128 q13 -12 26 0 q13 12 26 0 q13 -12 26 0 q13 12 26 0" fill="none" stroke="${p.c}" stroke-width="4" stroke-linecap="round"/>
      <path d="M58 104 q11 -10 22 0 q11 10 22 0 q11 -10 22 0 q11 10 22 0" fill="none" stroke="${p.c}" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>
      <ellipse cx="100" cy="152" rx="74" ry="10" fill="${p.b}" stroke="${p.d}" stroke-width="3"/>
      <ellipse cx="100" cy="60" rx="38" ry="34" fill="url(#${id}h)" stroke="${p.d}" stroke-width="3"/>
      ${eyes(100, 56, 15, 7.5)}${cheeks(100, 70, 25)}${mouth(100, 74, p.d)}`;
  },
};

let uid = 0;
export function petSvg(el: Element, size = 180) {
  const id = `g${uid++}`;
  return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" class="pet-svg" aria-hidden="true">${PETS[el](id)}</svg>`;
}

/** 아직 태어나지 않은 알 */
export function eggSvg(size = 140) {
  return `<svg viewBox="0 0 200 220" width="${size}" height="${size * 1.1}" aria-hidden="true">
    <defs><radialGradient id="egg" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#e3d2b0"/></radialGradient></defs>
    <ellipse cx="100" cy="206" rx="54" ry="9" fill="#000" opacity=".25"/>
    <path d="M100 18 C150 18 172 110 166 150 C160 190 132 204 100 204 C68 204 40 190 34 150 C28 110 50 18 100 18z" fill="url(#egg)" stroke="#b79a64" stroke-width="3"/>
    <path d="M44 120 l18 -12 l16 12 l16 -12 l14 12 l16 -12 l16 12 l16 -12" fill="none" stroke="#e3b45a" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="80" cy="76" r="6" fill="#7cc36e"/><circle cx="118" cy="62" r="5" fill="#e0603e"/><circle cx="128" cy="96" r="6" fill="#3b5b8a"/><circle cx="72" cy="150" r="5" fill="#d9a441"/><circle cx="126" cy="160" r="5" fill="#a9a3bd"/>
    <ellipse cx="78" cy="58" rx="12" ry="20" fill="#fff" opacity=".55" transform="rotate(20 78 58)"/></svg>`;
}

// ── 타로

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
const EL_HEX: Record<Element, string> = { wood: '#5fa463', fire: '#e0603e', earth: '#d9a441', metal: '#9b97ad', water: '#3b5b8a' };
const HANJA: Record<Element, string> = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };

function star(cx: number, cy: number, r: number, points = 8, inner = 0.42) {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }
  return d + 'z';
}

/** 카드마다 가운데 상징(단순한 판화풍 도상) */
function glyph(n: number, c: string) {
  const G: Record<number, string> = {
    0: `<circle cx="180" cy="250" r="40" fill="none" stroke="${c}" stroke-width="6"/><path d="M150 330 q30 -30 60 0" fill="none" stroke="${c}" stroke-width="6"/><path d="${star(180, 250, 16, 4)}" fill="${c}"/>`,
    1: `<path d="M120 270 q30 -50 60 0 q30 50 60 0 q-30 -50 -60 0 q-30 50 -60 0z" fill="none" stroke="${c}" stroke-width="7"/>`,
    2: `<path d="M196 200 a56 56 0 1 0 0 112 a44 44 0 1 1 0 -112z" fill="${c}"/>`,
    3: `<path d="M130 290 l20 -60 l30 34 l30 -34 l20 60z" fill="${c}"/><circle cx="150" cy="226" r="7" fill="${c}"/><circle cx="210" cy="226" r="7" fill="${c}"/><circle cx="180" cy="256" r="7" fill="#fff"/>`,
    4: `<rect x="138" y="230" width="84" height="70" rx="6" fill="${c}"/><path d="M138 230 l14 -28 l14 28 l14 -28 l14 28 l14 -28 l14 28" fill="${c}"/>`,
    6: `<path d="M180 320 C110 270 130 210 180 240 C230 210 250 270 180 320z" fill="${c}"/>`,
    7: `<circle cx="140" cy="300" r="22" fill="none" stroke="${c}" stroke-width="7"/><circle cx="220" cy="300" r="22" fill="none" stroke="${c}" stroke-width="7"/><path d="M118 270 h124 l-20 -50 h-84z" fill="${c}"/>`,
    8: `<path d="M180 210 a50 50 0 1 1 -1 0" fill="none" stroke="${c}" stroke-width="8"/><path d="M150 262 l22 -10 l8 -20 l8 20 l22 10 l-22 10 l-8 20 l-8 -20z" fill="${c}"/>`,
    9: `<path d="M170 210 h20 l10 20 v60 h-40 v-60z" fill="${c}"/><circle cx="180" cy="262" r="10" fill="#fff"/><path d="M180 290 v40" stroke="${c}" stroke-width="6"/>`,
    10: `<circle cx="180" cy="262" r="60" fill="none" stroke="${c}" stroke-width="7"/>${[0, 45, 90, 135].map((a) => `<line x1="180" y1="202" x2="180" y2="322" stroke="${c}" stroke-width="5" transform="rotate(${a} 180 262)"/>`).join('')}<circle cx="180" cy="262" r="12" fill="${c}"/>`,
    11: `<path d="M180 200 v120 M120 230 h120" stroke="${c}" stroke-width="6"/><path d="M120 230 l-20 44 h40z M240 230 l-20 44 h40z" fill="${c}"/>`,
    13: `<path d="M180 200 c40 40 40 80 0 120 c-40 -40 -40 -80 0 -120z" fill="none" stroke="${c}" stroke-width="7"/><circle cx="180" cy="262" r="10" fill="${c}"/>`,
    14: `<path d="M130 220 h40 l-6 50 h-28z M190 260 h40 l-6 50 h-28z" fill="${c}"/><path d="M164 250 q20 -10 30 20" fill="none" stroke="${c}" stroke-width="5"/>`,
    16: `<rect x="150" y="214" width="60" height="110" fill="${c}"/><path d="M196 190 l-22 44 h20 l-18 40" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>`,
    17: `<path d="${star(180, 260, 58, 8, 0.38)}" fill="${c}"/><path d="${star(130, 214, 12, 4)}" fill="${c}"/><path d="${star(232, 312, 10, 4)}" fill="${c}"/>`,
    18: `<path d="M206 200 a62 62 0 1 0 0 124 a50 50 0 1 1 0 -124z" fill="${c}"/><path d="${star(140, 222, 10, 4)}" fill="${c}"/>`,
    19: `<circle cx="180" cy="262" r="38" fill="${c}"/>${Array.from({ length: 12 }, (_, i) => `<line x1="180" y1="206" x2="180" y2="188" stroke="${c}" stroke-width="6" stroke-linecap="round" transform="rotate(${i * 30} 180 262)"/>`).join('')}`,
    20: `<path d="M140 300 l80 -60 M212 232 l18 -6 l-6 18z" stroke="${c}" stroke-width="8" fill="${c}"/><path d="M130 300 q50 30 100 0" fill="none" stroke="${c}" stroke-width="6"/>`,
    21: `<ellipse cx="180" cy="262" rx="52" ry="66" fill="none" stroke="${c}" stroke-width="7"/><path d="${star(180, 262, 22, 4)}" fill="${c}"/>`,
  };
  return G[n] ?? `<path d="${star(180, 262, 52, 6, 0.5)}" fill="${c}"/>`;
}

const CORNERS = (c: string) =>
  [[34, 34], [326, 34], [34, 546], [326, 546]].map(([x, y]) => `<path d="${star(x, y, 9, 4)}" fill="${c}"/>`).join('');

export function cardFaceSvg(n: number, el: Element, name: string, width = 200) {
  const c = EL_HEX[el];
  return `<svg viewBox="0 0 360 580" width="${width}" height="${width * 1.611}" class="card-svg" aria-hidden="true">
    <defs><linearGradient id="paper${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf5e6"/><stop offset="1" stop-color="#efe2c4"/></linearGradient></defs>
    <rect x="4" y="4" width="352" height="572" rx="22" fill="url(#paper${n})" stroke="#c99a3e" stroke-width="6"/>
    <rect x="20" y="20" width="320" height="540" rx="14" fill="none" stroke="#c99a3e" stroke-width="2"/>
    ${CORNERS('#c99a3e')}
    <text x="180" y="78" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="#8a6a2a">${ROMAN[n]}</text>
    <path d="M110 92 h140" stroke="#c99a3e" stroke-width="2"/>
    <circle cx="180" cy="262" r="96" fill="${c}" opacity=".12"/>
    <circle cx="180" cy="262" r="96" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="4 8"/>
    ${glyph(n, c)}
    <path d="M60 430 h240 l-14 22 l14 22 h-240 l14 -22z" fill="${c}"/>
    <text x="180" y="461" text-anchor="middle" font-family="-apple-system, 'Apple SD Gothic Neo', sans-serif" font-weight="700" font-size="${name.length > 9 ? 22 : 26}" fill="#fff">${name}</text>
    <rect x="156" y="494" width="48" height="48" rx="8" fill="#c0392b" transform="rotate(-4 180 518)"/>
    <text x="180" y="530" text-anchor="middle" font-family="serif" font-size="32" font-weight="700" fill="#fff4e6" transform="rotate(-4 180 518)">${HANJA[el]}</text>
  </svg>`;
}

export function cardBackSvg(width = 104) {
  return `<svg viewBox="0 0 360 580" width="${width}" height="${width * 1.611}" aria-hidden="true">
    <defs><linearGradient id="back" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d3680"/><stop offset="1" stop-color="#231f4d"/></linearGradient></defs>
    <rect x="4" y="4" width="352" height="572" rx="22" fill="url(#back)" stroke="#e3b45a" stroke-width="7"/>
    <rect x="22" y="22" width="316" height="536" rx="12" fill="none" stroke="#e3b45a" stroke-width="2" opacity=".7"/>
    ${CORNERS('#e3b45a')}
    <circle cx="180" cy="290" r="110" fill="none" stroke="#e3b45a" stroke-width="3" opacity=".8"/>
    <circle cx="180" cy="290" r="78" fill="none" stroke="#e3b45a" stroke-width="1.5" opacity=".6"/>
    ${Array.from({ length: 16 }, (_, i) => `<line x1="180" y1="168" x2="180" y2="152" stroke="#e3b45a" stroke-width="3" transform="rotate(${i * 22.5} 180 290)"/>`).join('')}
    <circle cx="180" cy="290" r="40" fill="#e3b45a"/>
    <path d="M200 262 a34 34 0 1 0 0 56 a28 28 0 1 1 0 -56z" fill="#231f4d"/>
    <path d="${star(180, 120, 12, 4)}" fill="#e3b45a"/><path d="${star(180, 460, 12, 4)}" fill="#e3b45a"/>
  </svg>`;
}

/** SVG 문자열을 공유 카드 캔버스에 그리기 위한 이미지로 */
export function svgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  });
}

// ── 꾸미기 소품(펫 주변에 놓인다). 펫과 같은 규칙: 둥근 형태, 그라데이션, 진한 외곽선
const DECO: Record<string, string> = {
  sapling: `<defs>${grad('dsa', '#9fe08f', '#3f8f45')}</defs><rect x="46" y="62" width="8" height="30" rx="3" fill="#7a5130"/>
    <circle cx="50" cy="44" r="24" fill="url(#dsa)" stroke="#2f5d2f" stroke-width="2.5"/><circle cx="36" cy="56" r="14" fill="url(#dsa)" stroke="#2f5d2f" stroke-width="2.5"/><circle cx="64" cy="56" r="14" fill="url(#dsa)" stroke="#2f5d2f" stroke-width="2.5"/>
    <circle cx="44" cy="38" r="4" fill="#fff" opacity=".5"/>`,
  blossom: `<defs>${grad('dbl', '#ffd1e6', '#e07aa8')}</defs><path d="M50 92 q-4 -30 6 -50 M52 64 q14 -6 20 -18 M50 70 q-12 -6 -18 -16" stroke="#6b4428" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${[[56, 34, 16], [74, 44, 12], [32, 50, 12], [44, 30, 11], [66, 26, 9]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#dbl)" stroke="#b5527f" stroke-width="2"/>`).join('')}`,
  lantern: `<defs><radialGradient id="dla" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#fff2b0"/><stop offset=".5" stop-color="#ff9a3d"/><stop offset="1" stop-color="#c2412a"/></radialGradient></defs>
    <circle cx="50" cy="50" r="34" fill="#ffb347" opacity=".25"/><rect x="47" y="8" width="6" height="12" fill="#5a3a24"/>
    <ellipse cx="50" cy="52" rx="24" ry="30" fill="url(#dla)" stroke="#7a2e12" stroke-width="2.5"/><path d="M30 52 h40 M34 36 h32 M34 68 h32" stroke="#7a2e12" stroke-width="1.5" opacity=".6"/>
    <rect x="40" y="20" width="20" height="6" rx="2" fill="#5a3a24"/><rect x="40" y="80" width="20" height="6" rx="2" fill="#5a3a24"/><path d="M50 86 v8" stroke="#e3b45a" stroke-width="3"/>`,
  campfire: `<defs><linearGradient id="dcf" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff5a2a"/><stop offset=".6" stop-color="#ffb02e"/><stop offset="1" stop-color="#fff3a8"/></linearGradient></defs>
    <circle cx="50" cy="66" r="36" fill="#ff8a3d" opacity=".22"/><path d="M22 88 l56 -14 M22 74 l56 14" stroke="#6b4428" stroke-width="9" stroke-linecap="round"/>
    <path d="M50 20 q22 26 14 46 q-6 14 -14 14 q-8 0 -14 -14 q-8 -20 14 -46z" fill="url(#dcf)" stroke="#a83a16" stroke-width="2"/><path d="M50 46 q10 14 4 26 q-4 6 -4 6 q-8 -10 0 -32z" fill="#fff6c0"/>`,
  rocks: `<defs>${grad('dro', '#e9dccb', '#9c8a74')}</defs><path d="M14 90 q-2 -26 22 -30 q20 -2 24 20 q4 12 -4 12z" fill="url(#dro)" stroke="#5e4e3c" stroke-width="2.5"/>
    <path d="M48 92 q-4 -40 24 -44 q22 0 18 32 q-2 12 -12 12z" fill="url(#dro)" stroke="#5e4e3c" stroke-width="2.5"/><path d="M60 64 q6 -6 14 -4" stroke="#fff" stroke-width="3" opacity=".5" fill="none"/>
    <circle cx="30" cy="90" r="5" fill="#7cc36e"/><circle cx="38" cy="92" r="4" fill="#7cc36e"/>`,
  sunflower: `<path d="M50 94 v-46" stroke="#4f8a3a" stroke-width="5"/><ellipse cx="38" cy="72" rx="10" ry="5" fill="#6fae4f" transform="rotate(-30 38 72)"/>
    ${Array.from({ length: 12 }, (_, i) => `<ellipse cx="50" cy="20" rx="6" ry="13" fill="#ffd23f" stroke="#c98f12" stroke-width="1.5" transform="rotate(${i * 30} 50 36)"/>`).join('')}
    <circle cx="50" cy="36" r="11" fill="#7a4a1e"/><circle cx="47" cy="33" r="3" fill="#a8703a"/>`,
  crystal: `<defs><linearGradient id="dcr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#cfc6ff"/><stop offset="1" stop-color="#7f74c9"/></linearGradient></defs>
    <circle cx="50" cy="52" r="34" fill="#cfc6ff" opacity=".25"/><path d="M50 8 l16 30 l-6 50 h-20 l-6 -50z" fill="url(#dcr)" stroke="#4d4766" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M24 50 l10 16 l-4 26 h-12 l-4 -26z M76 46 l10 18 l-4 28 h-12 l-4 -28z" fill="url(#dcr)" stroke="#4d4766" stroke-width="2" stroke-linejoin="round"/><path d="M50 8 v80" stroke="#fff" stroke-width="2" opacity=".6"/>`,
  bell: `<defs>${grad('dbe', '#fff1c4', '#c99a3e')}</defs><path d="M20 26 h60" stroke="#5a3a24" stroke-width="6" stroke-linecap="round"/><path d="M28 26 v-14 M72 26 v-14" stroke="#5a3a24" stroke-width="5"/>
    <path d="M50 30 q-22 0 -24 34 l-6 12 h60 l-6 -12 q-2 -34 -24 -34z" fill="url(#dbe)" stroke="#7a5a1a" stroke-width="2.5"/><circle cx="50" cy="82" r="6" fill="#7a5a1a"/><path d="M40 46 q4 -8 10 -8" stroke="#fff" stroke-width="3" opacity=".6" fill="none"/>`,
  pond: `<defs><radialGradient id="dpo" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#bfeee5"/><stop offset="1" stop-color="#2f7fa8"/></radialGradient></defs>
    <ellipse cx="50" cy="74" rx="44" ry="18" fill="#8a7a5a"/><ellipse cx="50" cy="72" rx="40" ry="15" fill="url(#dpo)"/>
    <ellipse cx="34" cy="70" rx="9" ry="4" fill="#5fae5a"/><circle cx="64" cy="68" r="5" fill="#ff9ac2"/><path d="M40 76 q8 -4 16 0" stroke="#fff" stroke-width="2" opacity=".6" fill="none"/>`,
  fountain: `<defs>${grad('dfo', '#eaf6ff', '#8fb4d9')}</defs><ellipse cx="50" cy="86" rx="40" ry="10" fill="url(#dfo)" stroke="#4d6a8a" stroke-width="2.5"/>
    <rect x="44" y="46" width="12" height="40" fill="url(#dfo)" stroke="#4d6a8a" stroke-width="2"/><ellipse cx="50" cy="46" rx="22" ry="7" fill="url(#dfo)" stroke="#4d6a8a" stroke-width="2"/>
    <path d="M50 40 q-14 -22 -26 4 M50 40 q14 -22 26 4 M50 40 v-24" stroke="#7fc8ff" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="50" cy="14" r="4" fill="#bfe6ff"/>`,
};

export function decoSvg(id: string, size = 64) {
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${DECO[id] ?? ''}</svg>`;
}
