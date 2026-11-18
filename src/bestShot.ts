// 베스트 컷(결정 062 → 다시 설계): 판에서 가장 멋지게 날려 보낸 순간을 고르고(judge),
// 따로 둔 카메라로 찍은 클로즈업 사진에 만화 효과(집중선·속도선·놀란 표정·「퍽!」)와 글을 얹어 공유 카드로 만든다(drawCard).
// 글은 [한국어, 영어] 짝으로 두고 고르는 건 main.ts의 L()이 한다(이 파일은 테스트에서 i18n 없이 불러야 해서).
import type { WeaponId } from './game/meta';

export type KoEn = readonly [string, string];
export type Kind = 'boss' | 'homer' | 'slam' | 'multi' | 'last' | 'hit';
export type Moment = { speed: number; chain: number; boss: boolean; big: boolean; src: string; homer: boolean; last: boolean };

/** 떨어뜨린 한 순간의 점수와 종류. 점수가 판 최고를 넘을 때만 사진을 다시 찍는다 */
export function judge(m: Moment): { score: number; kind: Kind } {
  const kind: Kind = m.boss ? 'boss' : m.homer ? 'homer' : m.src === 'sweep' ? 'slam' : m.chain >= 3 ? 'multi' : m.last ? 'last' : 'hit';
  const score = m.speed + (m.chain - 1) * 5 + (m.big ? 5 : 0) + (m.src === 'sweep' ? 8 : 0) + (m.homer ? 25 : 0) + (m.last ? 10 : 0) + (m.boss ? 100 : 0);
  return { score, kind };
}

/** 한 줄 캡션(종류마다 몇 개, n으로 고름 — 오늘의 섬은 Math.random이 씨앗이라 쓰지 않는다) */
const CAPTIONS: Record<Kind, readonly KoEn[]> = {
  boss: [['왕좀비, 퇴장!', 'Exit, King Zombie!'], ['왕관째로 날아간다~', 'Crown and all, bye~']],
  homer: [['장외 홈런!', 'Out of the park!'], ['담장 너머로~', 'Over the fence~']],
  slam: [['쾅! 하고 저 멀리', 'SLAM! See ya!'], ['땅이 울렸다!', 'The ground shook!']],
  multi: [['한꺼번에 우르르~', 'All at once~'], ['단체로 퇴장!', 'Group exit!']],
  last: [['마지막 한 방!', 'The final blow!']],
  hit: [['저 멀리~', 'Off you go~'], ['으아아아~', 'Waaaah~'], ['잘 가~', 'Bye-bye~'], ['어디로 가는 거야?!', 'Where am I going?!']],
};
export const caption = (kind: Kind, n: number): KoEn => CAPTIONS[kind][n % CAPTIONS[kind].length];

/** 맞은 자리에 터지는 만화 글자: 쾅!·통나무·호박은 따로, 나머지는 무기마다 */
const WORD: Record<WeaponId, KoEn> = {
  hammer: ['퍽!', 'POW!'], squeaky: ['뿅!', 'BOING!'], sledge: ['쿵!', 'THUD!'], twin: ['챙챙!', 'SWISH!'],
  pan: ['땡!', 'BONK!'], bat: ['딱!', 'CRACK!'], pole: ['뻥!', 'BAM!'], fan: ['휘잉!', 'WHOOSH!'],
};
export const word = (src: string, w: WeaponId): KoEn => (src === 'sweep' ? ['쾅!', 'SLAM!'] : src === 'log' ? ['쿵!', 'BUMP!'] : src === 'pumpkin' ? ['펑!', 'POP!'] : WORD[w]);

/** 찍을 때 잰 화면 자리(사진 픽셀): 얼굴 가운데와 머리 반지름, 날아온 길(먼 곳 → 적) */
export type ShotInfo = { face: { x: number; y: number; r: number; a: number }; trail: [number, number][]; kind: Kind };
export type CardText = { caption: string; word: string; brand: string; line: string };

const FONT = 'ui-rounded, "SF Pro Rounded", -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const INK = '#3a2a1a';

/** 사진 위에 효과·글을 얹은 새 캔버스(사진과 같은 크기) */
export function drawCard(photo: HTMLCanvasElement, s: ShotInfo, t: CardText): HTMLCanvasElement {
  const W = photo.width, H = photo.height, u = W / 360, cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  c.drawImage(photo, 0, 0);
  const { x: fx, y: fy, r } = s.face;
  c.lineJoin = c.lineCap = 'round';

  // 집중선: 테두리에서 적 쪽으로 가는 흰 쐐기(가운데는 비운다)
  c.fillStyle = 'rgba(255,255,255,0.5)';
  const far = Math.hypot(W, H);
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2 + Math.sin(k * 12.9) * 0.05, w = 0.012 + ((k * 7) % 5) * 0.004, r0 = r * 3.2 + (((k * 13) % 7) / 7) * W * 0.18;
    c.beginPath();
    c.moveTo(fx + Math.cos(a) * r0, fy + Math.sin(a) * r0);
    c.lineTo(fx + Math.cos(a - w) * far, fy + Math.sin(a - w) * far);
    c.lineTo(fx + Math.cos(a + w) * far, fy + Math.sin(a + w) * far);
    c.fill();
  }

  // 속도선: 날아온 길을 따라 굵어지는 흰 줄 세 개
  const tr = s.trail;
  if (tr.length > 1) {
    const [x0, y0] = tr[0], [x1, y1] = tr[tr.length - 1], len = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
    for (const off of [-1, 0, 1]) {
      for (let i = 1; i < tr.length; i++) {
        const k = i / (tr.length - 1), o = off * r * 0.55 * (0.4 + k * 0.6);
        c.strokeStyle = `rgba(255,255,255,${0.15 + k * 0.7})`;
        c.lineWidth = u * (1 + k * 4) * (off ? 0.7 : 1);
        c.beginPath();
        c.moveTo(tr[i - 1][0] + nx * o, tr[i - 1][1] + ny * o);
        c.lineTo(tr[i][0] + nx * o, tr[i][1] + ny * o);
        c.stroke();
      }
    }
  }

  // 「퍽!」: 날아온 길 시작(맞은 자리)에 노란 별 터짐. 얼굴을 가리면 얼굴에서 먼 쪽으로 민다
  let [bx, by] = tr[0] ?? [W * 0.3, H * 0.65];
  const fd = Math.hypot(bx - fx, by - fy), need = Math.max(r * 3.4, 110 * u);
  if (fd < need) { const k = need / (fd || 1); bx = fx + (fd ? (bx - fx) * k : -need); by = fy + (fd ? (by - fy) * k : 0); }
  bx = Math.min(W * 0.78, Math.max(W * 0.22, bx));
  by = Math.min(H * 0.8, Math.max(H * 0.3, by));
  c.save();
  c.translate(bx, by);
  c.rotate(-0.18);
  c.beginPath();
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2, rr = (k % 2 ? 30 : 50 + ((k * 5) % 3) * 6) * u;
    c[k ? 'lineTo' : 'moveTo'](Math.cos(a) * rr * 1.25, Math.sin(a) * rr * 0.85);
  }
  c.closePath();
  c.fillStyle = '#ffe066';
  c.strokeStyle = INK;
  c.lineWidth = 3 * u;
  c.fill();
  c.stroke();
  outlined(c, t.word, 0, 2 * u, fit(c, t.word, 34 * u, 100 * u), '#e5484d', INK, 6 * u);
  c.restore();

  // 놀란 얼굴: 동그란 눈(작은 눈동자)·올라간 눈썹·벌린 입·땀방울. 얼굴 기울기(a)대로 돌려 그린다
  c.save();
  c.translate(fx, fy);
  c.rotate(s.face.a);
  c.translate(-fx, -fy);
  c.lineWidth = Math.max(1.5, r * 0.09);
  c.strokeStyle = INK;
  for (const sx of [-1, 1]) {
    const ex = fx + sx * r * 0.4, ey = fy - r * 0.12;
    c.beginPath();
    c.arc(ex, ey, r * 0.3, 0, Math.PI * 2);
    c.fillStyle = '#fff';
    c.fill();
    c.stroke();
    c.beginPath();
    c.arc(ex + sx * r * 0.04, ey - r * 0.06, r * 0.08, 0, Math.PI * 2);
    c.fillStyle = '#1d1d1d';
    c.fill();
    c.beginPath(); // 눈썹: 바깥이 내려간 걱정 눈썹
    c.moveTo(ex - sx * r * 0.2, ey - r * 0.5);
    c.lineTo(ex + sx * r * 0.22, ey - r * 0.4);
    c.stroke();
  }
  c.beginPath();
  c.ellipse(fx, fy + r * 0.5, r * 0.2, r * 0.27, 0, 0, Math.PI * 2);
  c.fillStyle = '#5a1f24';
  c.fill();
  c.stroke();
  c.beginPath();
  c.ellipse(fx, fy + r * 0.64, r * 0.12, r * 0.08, 0, 0, Math.PI * 2);
  c.fillStyle = '#ff7b8a';
  c.fill();
  for (const [dx, dy, k] of [[1.05, -0.55, 1], [1.3, -0.15, 0.7], [-1.1, -0.45, 0.8]] as const) drop(c, fx + dx * r, fy + dy * r, r * 0.22 * k);
  if (s.kind === 'boss' || s.kind === 'slam' || s.kind === 'homer') // 머리 위에 노란 별(어질어질)
    for (let k = 0; k < 3; k++) star(c, fx + (k - 1) * r * 0.75, fy - r * (1.05 + (k % 2) * 0.22), r * 0.22, '#ffd23f', u);
  c.restore();

  // 캡션: 위 가운데 큰 흰 글씨 + 진한 테두리
  c.save();
  c.translate(W / 2, H * 0.1);
  c.rotate(-0.04);
  outlined(c, t.caption, 0, 0, fit(c, t.caption, 38 * u, W * 0.9), '#fff', INK, 8 * u);
  c.restore();

  // 아래 띠: 게임 이름 + 섬 이름·떨어뜨린 수(작게)
  const g = c.createLinearGradient(0, H * 0.82, 0, H);
  g.addColorStop(0, 'rgba(30,24,16,0)');
  g.addColorStop(1, 'rgba(30,24,16,0.6)');
  c.fillStyle = g;
  c.fillRect(0, H * 0.82, W, H * 0.18);
  c.textBaseline = 'alphabetic';
  c.fillStyle = '#ffd23f';
  c.font = `900 ${17 * u}px ${FONT}`;
  c.textAlign = 'left';
  c.fillText(t.brand, 16 * u, H - 16 * u);
  c.fillStyle = '#fff';
  c.font = `800 ${12 * u}px ${FONT}`;
  c.textAlign = 'right';
  c.fillText(t.line, W - 16 * u, H - 17 * u);
  return cv;
}

/** 폭 안에 들어가는 글자 크기 */
function fit(c: CanvasRenderingContext2D, text: string, size: number, maxW: number) {
  c.font = `900 ${size}px ${FONT}`;
  const w = c.measureText(text).width;
  return w > maxW ? (size * maxW) / w : size;
}
function outlined(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, stroke: string, lw: number) {
  c.font = `900 ${size}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineWidth = lw;
  c.strokeStyle = stroke;
  c.strokeText(text, x, y);
  c.fillStyle = fill;
  c.fillText(text, x, y);
}
function drop(c: CanvasRenderingContext2D, x: number, y: number, s: number) { // 땀방울
  c.beginPath();
  c.moveTo(x, y - s * 1.6);
  c.quadraticCurveTo(x + s, y - s * 0.2, x, y + s * 0.6);
  c.quadraticCurveTo(x - s, y - s * 0.2, x, y - s * 1.6);
  c.fillStyle = '#8fd3ff';
  c.fill();
  c.lineWidth = s * 0.25;
  c.strokeStyle = '#2f6f9a';
  c.stroke();
}
function star(c: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string, u: number) {
  c.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k / 10) * Math.PI * 2, rr = k % 2 ? s * 0.45 : s;
    c[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = 1.5 * u;
  c.strokeStyle = INK;
  c.stroke();
}
