// 소품 모델. 지금은 코드로 만든 임시 모델이고, 무료 3D 모델(glTF)이 정해지면
// 같은 이름으로 바꿔 끼운다(방 데이터는 이름만 가리키므로 그대로 둔다).
import * as THREE from 'three';

export interface Model {
  root: THREE.Group;
  /** 닦기 작업이 가리키는 표면. 평면(로컬 +z가 앞)이고 UV가 겹치지 않아야 한다 */
  surfaces: Record<string, THREE.Mesh>;
  /** 붙이기 작업의 조각. 맞춰진 상태가 로컬 원점·회전 0 */
  shards: THREE.Mesh[];
  /** 반응 연출에 쓰는 부품(시계 바늘, 전구 빛 등) */
  parts: Record<string, THREE.Object3D>;
}

const mat = (color: string, roughness = 0.75, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const WOOD = mat('#8a5a36', 0.7);
const DARK_WOOD = mat('#5a3a24', 0.65);
const BRASS = mat('#c9a04a', 0.35, 0.8);
const CREAM = mat('#efe6d2', 0.8);

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function cyl(rt: number, rb: number, h: number, m: THREE.Material, seg = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

const empty = (): Model => ({ root: new THREE.Group(), surfaces: {}, shards: [], parts: {} });

function counter(): Model {
  const m = empty();
  m.root.add(box(2.5, 0.92, 0.75, WOOD, 0, 0.46, 0));
  m.root.add(box(2.66, 0.08, 0.86, DARK_WOOD, 0, 0.96, 0));
  // 앞판 장식 줄
  for (let i = -1; i <= 1; i++) m.root.add(box(0.7, 0.55, 0.02, DARK_WOOD, i * 0.82, 0.46, 0.38));
  return m;
}

function shelf(): Model {
  const m = empty();
  m.root.add(box(0.06, 2.6, 0.42, DARK_WOOD, -1.13, 1.3, 0));
  m.root.add(box(0.06, 2.6, 0.42, DARK_WOOD, 1.13, 1.3, 0));
  for (const y of [0.85, 1.55, 2.25]) m.root.add(box(2.26, 0.05, 0.42, WOOD, 0, y, 0));
  // 늘 제자리에 있던 장식: 부품 통, 유리병
  const jar = cyl(0.07, 0.07, 0.18, new THREE.MeshStandardMaterial({ color: '#9fc3c0', roughness: 0.2, transparent: true, opacity: 0.7 }));
  jar.position.set(0.6, 0.965, 0);
  m.root.add(jar);
  const tin = cyl(0.09, 0.09, 0.12, mat('#a4482f', 0.5, 0.3));
  tin.position.set(0.85, 0.935, 0.02);
  m.root.add(tin);
  const tin2 = cyl(0.08, 0.08, 0.1, mat('#3f6b5a', 0.5, 0.3));
  tin2.position.set(0.3, 1.625, 0.05);
  m.root.add(tin2);
  return m;
}

function stool(): Model {
  const m = empty();
  const seat = cyl(0.22, 0.22, 0.06, WOOD);
  seat.position.y = 0.62;
  m.root.add(seat);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = cyl(0.025, 0.03, 0.6, DARK_WOOD, 8);
    leg.position.set(Math.cos(a) * 0.15, 0.3, Math.sin(a) * 0.15);
    m.root.add(leg);
  }
  return m;
}

function clockFaceTexture() {
  return canvasTexture(512, 512, (c) => {
    c.fillStyle = '#f3ead6';
    c.fillRect(0, 0, 512, 512);
    c.strokeStyle = '#3b2a1d';
    c.fillStyle = '#3b2a1d';
    c.lineWidth = 6;
    c.beginPath();
    c.arc(256, 256, 236, 0, Math.PI * 2);
    c.stroke();
    c.font = '600 54px Georgia, serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const roman = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      c.save();
      c.translate(256 + Math.cos(a) * 180, 256 + Math.sin(a) * 180);
      c.font = `600 ${i % 3 === 0 ? 50 : 40}px Georgia, serif`;
      c.fillText(roman[i], 0, 0);
      c.restore();
      c.fillRect(256 + Math.cos(a) * 222 - 3, 256 + Math.sin(a) * 222 - 3, 6, 6);
    }
    c.font = 'italic 26px Georgia, serif';
    c.fillText('since 1968', 256, 330);
  });
}

function wallClock(): Model {
  const m = empty();
  const caseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 40), DARK_WOOD);
  caseMesh.rotation.x = Math.PI / 2;
  caseMesh.castShadow = true;
  m.root.add(caseMesh);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.025, 12, 48), BRASS);
  rim.position.z = 0.045;
  m.root.add(rim);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.34, 48), new THREE.MeshStandardMaterial({ map: clockFaceTexture(), roughness: 0.6 }));
  face.position.z = 0.042;
  m.root.add(face);
  m.surfaces.face = face;
  // 바늘(작업을 끝내면 움직이기 시작한다)
  const hand = (len: number, w: number, color: string, z: number) => {
    const pivot = new THREE.Group();
    const h = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.006), mat(color, 0.4, 0.5));
    h.position.y = len / 2 - 0.03;
    pivot.add(h);
    pivot.position.z = z;
    m.root.add(pivot);
    return pivot;
  };
  m.parts.hour = hand(0.17, 0.022, '#2a1c10', 0.05);
  m.parts.minute = hand(0.26, 0.016, '#2a1c10', 0.055);
  m.parts.second = hand(0.28, 0.006, '#a4482f', 0.06);
  m.parts.hour.rotation.z = -2.1;
  m.parts.minute.rotation.z = 0.7;
  // 아래 추 상자
  const pend = box(0.34, 0.5, 0.08, DARK_WOOD, 0, -0.62, 0);
  m.root.add(pend);
  const bob = cyl(0.06, 0.06, 0.02, BRASS);
  bob.rotation.x = Math.PI / 2;
  bob.position.set(0, -0.7, 0.05);
  m.root.add(bob);
  m.parts.bob = bob;
  return m;
}

function photoTexture() {
  return canvasTexture(512, 400, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 400);
    g.addColorStop(0, '#e9d7b4');
    g.addColorStop(1, '#b89466');
    c.fillStyle = g;
    c.fillRect(0, 0, 512, 400);
    // 가게 앞면
    c.fillStyle = '#7d5a3a';
    c.fillRect(60, 90, 392, 250);
    c.fillStyle = '#c8ab7e';
    c.fillRect(90, 160, 150, 120);
    c.fillRect(280, 160, 70, 180);
    // 줄무늬 차양
    for (let i = 0; i < 10; i++) {
      c.fillStyle = i % 2 ? '#efe0c2' : '#8f4a32';
      c.fillRect(60 + i * 39.2, 70, 39.2, 40);
    }
    c.fillStyle = '#3b2a1d';
    c.font = 'bold 30px Georgia, serif';
    c.textAlign = 'center';
    c.fillText('시계방 · CLOCKS', 256, 55);
    // 할아버지와 손녀 실루엣
    c.fillStyle = '#4a3322';
    c.beginPath();
    c.arc(390, 200, 22, 0, Math.PI * 2);
    c.fill();
    c.fillRect(368, 222, 44, 110);
    c.beginPath();
    c.arc(435, 255, 15, 0, Math.PI * 2);
    c.fill();
    c.fillRect(421, 270, 28, 62);
    c.fillStyle = '#6d5a44';
    c.fillRect(0, 340, 512, 60);
    // 빛바랜 가장자리
    const v = c.createRadialGradient(256, 200, 120, 256, 200, 320);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(60,40,20,0.45)');
    c.fillStyle = v;
    c.fillRect(0, 0, 512, 400);
  });
}

function frame(): Model {
  const m = empty();
  const w = 0.78, h = 0.62, t = 0.06;
  m.root.add(box(w + t * 2, t, 0.05, DARK_WOOD, 0, h / 2 + t / 2, 0));
  m.root.add(box(w + t * 2, t, 0.05, DARK_WOOD, 0, -h / 2 - t / 2, 0));
  m.root.add(box(t, h, 0.05, DARK_WOOD, w / 2 + t / 2, 0, 0));
  m.root.add(box(t, h, 0.05, DARK_WOOD, -w / 2 - t / 2, 0, 0));
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: photoTexture(), roughness: 0.9 }));
  photo.position.z = 0.005;
  m.root.add(photo);
  m.surfaces.photo = photo;
  return m;
}

function outsideTexture() {
  return canvasTexture(256, 320, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 320);
    g.addColorStop(0, '#8fc3e6');
    g.addColorStop(0.7, '#f6e2b8');
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 320);
    c.fillStyle = '#b7a48d';
    c.fillRect(0, 190, 90, 130);
    c.fillRect(150, 160, 106, 160);
    c.fillStyle = '#8e7a64';
    c.fillRect(20, 210, 20, 24);
    c.fillRect(55, 210, 20, 24);
    c.fillRect(170, 185, 22, 26);
    c.fillRect(210, 185, 22, 26);
    c.fillStyle = '#5f8a4e';
    c.beginPath();
    c.arc(118, 215, 46, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#6b4a30';
    c.fillRect(112, 240, 12, 80);
  });
}

function windowModel(): Model {
  const m = empty();
  const w = 1.0, h = 1.2, t = 0.07;
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: outsideTexture() }));
  outside.position.z = -0.005;
  m.root.add(outside);
  m.parts.outside = outside;
  m.root.add(box(w + t * 2, t, 0.08, CREAM, 0, h / 2 + t / 2, 0.02));
  m.root.add(box(w + t * 2, t * 1.4, 0.16, CREAM, 0, -h / 2 - t * 0.7, 0.05));
  m.root.add(box(t, h, 0.08, CREAM, w / 2 + t / 2, 0, 0.02));
  m.root.add(box(t, h, 0.08, CREAM, -w / 2 - t / 2, 0, 0.02));
  m.root.add(box(0.035, h, 0.04, CREAM, 0, 0, 0.03));
  m.root.add(box(w, 0.035, 0.04, CREAM, 0, 0.1, 0.03));
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ color: '#dff0ff', roughness: 0.05, transparent: true, opacity: 0.12 }),
  );
  glass.position.z = 0.012;
  m.root.add(glass);
  m.surfaces.glass = glass;
  return m;
}

function displayCase(): Model {
  const m = empty();
  const w = 1.0, h = 0.32, d = 0.46;
  m.root.add(box(w, 0.04, d, DARK_WOOD, 0, 0.02, 0));
  m.root.add(box(w, 0.03, d, DARK_WOOD, 0, h + 0.015, 0));
  for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) m.root.add(box(0.04, h, d, DARK_WOOD, x, h / 2, 0));
  m.root.add(box(w, h, 0.02, DARK_WOOD, 0, h / 2, -d / 2 + 0.01));
  // 안에 든 손목시계들
  const velvet = box(w - 0.08, 0.02, d - 0.06, mat('#5b2230', 0.9), 0, 0.05, 0);
  m.root.add(velvet);
  for (let i = 0; i < 4; i++) {
    const watch = cyl(0.055, 0.055, 0.02, i % 2 ? BRASS : mat('#cfd3d6', 0.3, 0.9));
    watch.position.set(-0.33 + i * 0.22, 0.075, 0.02);
    m.root.add(watch);
    const strap = box(0.05, 0.012, 0.22, mat('#3b2a1d', 0.8), -0.33 + i * 0.22, 0.068, 0.02);
    m.root.add(strap);
  }
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.08, h - 0.02),
    new THREE.MeshStandardMaterial({ color: '#e6f4ff', roughness: 0.05, transparent: true, opacity: 0.15 }),
  );
  glass.position.set(0, h / 2, d / 2);
  m.root.add(glass);
  m.surfaces.glass = glass;
  return m;
}

function mantleClock(): Model {
  const m = empty();
  m.root.add(box(0.36, 0.06, 0.18, DARK_WOOD, 0, 0.03, 0));
  m.root.add(box(0.3, 0.3, 0.16, WOOD, 0, 0.21, 0));
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.16, 24, 1, false, -Math.PI / 2, Math.PI), WOOD);
  top.rotation.x = Math.PI / 2;
  top.rotation.z = 0;
  top.position.set(0, 0.36, 0);
  top.castShadow = true;
  m.root.add(top);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), new THREE.MeshStandardMaterial({ map: clockFaceTexture(), roughness: 0.6 }));
  face.position.set(0, 0.25, 0.081);
  m.root.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 32), BRASS);
  rim.position.set(0, 0.25, 0.082);
  m.root.add(rim);
  return m;
}

function bookModel(color: string): () => Model {
  return () => {
    const m = empty();
    m.root.add(box(0.07, 0.3, 0.22, mat(color, 0.85), 0, 0.15, 0));
    m.root.add(box(0.074, 0.02, 0.16, BRASS, 0, 0.24, 0.0));
    return m;
  };
}

function deskLamp(): Model {
  const m = empty();
  const base = cyl(0.13, 0.15, 0.04, BRASS);
  base.position.y = 0.02;
  m.root.add(base);
  const arm = cyl(0.015, 0.015, 0.68, BRASS, 8);
  arm.position.set(0, 0.36, 0);
  m.root.add(arm);
  const arm2 = cyl(0.015, 0.015, 0.22, BRASS, 8);
  arm2.rotation.x = Math.PI / 2;
  arm2.position.set(0, 0.69, 0.1);
  m.root.add(arm2);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.14, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#3f6b5a', roughness: 0.5, side: THREE.DoubleSide }));
  shade.position.set(0, 0.67, 0.18);
  shade.castShadow = true;
  m.root.add(shade);
  return m;
}

function bulb(): Model {
  const m = empty();
  const glassMat = new THREE.MeshStandardMaterial({ color: '#fff6dc', roughness: 0.2, emissive: '#000000' });
  const g = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 14), glassMat);
  g.castShadow = true;
  m.root.add(g);
  const base = cyl(0.028, 0.028, 0.05, BRASS, 12);
  base.position.y = 0.055;
  m.root.add(base);
  m.parts.glass = g;
  return m;
}

const PLATE_R = 0.22;
// 금 이음매: 반사할 주변 환경이 없어 금속 재질은 검게 보이므로 스스로 빛나게 한다
const SEAM = new THREE.MeshStandardMaterial({ color: '#e8b64e', emissive: '#c8902a', emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.2 });

function plate(): Model {
  const m = empty();
  // 받침대
  const stand = box(0.3, 0.03, 0.12, DARK_WOOD, 0, -0.235, 0.0);
  m.root.add(stand);
  const back = box(0.04, 0.26, 0.03, DARK_WOOD, 0, -0.12, -0.06);
  back.rotation.x = -0.15;
  m.root.add(back);
  // 그림이 있는 접시를 세 조각으로
  const tex = canvasTexture(256, 256, (c) => {
    c.fillStyle = '#f7f2e8';
    c.fillRect(0, 0, 256, 256);
    c.strokeStyle = '#2f5d8a';
    c.lineWidth = 8;
    c.beginPath();
    c.arc(128, 128, 112, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 3;
    c.beginPath();
    c.arc(128, 128, 92, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#2f5d8a';
    c.font = 'bold 28px Georgia, serif';
    c.textAlign = 'center';
    c.fillText('30', 128, 118);
    c.font = '18px Georgia, serif';
    c.fillText('1968 — 1998', 128, 150);
  });
  // 원판 윗면 UV는 그림이 옆으로 누워 있어 바로 세운다
  tex.center.set(0.5, 0.5);
  tex.rotation = Math.PI / 2;
  const pieces = 3;
  for (let i = 0; i < pieces; i++) {
    const start = (i / pieces) * Math.PI * 2 + 0.3;
    const geo = new THREE.CylinderGeometry(PLATE_R, PLATE_R * 0.9, 0.025, 32, 1, false, start, (Math.PI * 2) / pieces);
    geo.rotateX(Math.PI / 2);
    const shard = new THREE.Mesh(geo, [
      new THREE.MeshStandardMaterial({ color: '#f1ebdf', roughness: 0.35 }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.4 }),
    ]);
    shard.castShadow = true;
    shard.userData.mid = start + Math.PI / pieces;
    m.root.add(shard);
    m.shards.push(shard);
  }
  // 금 이음매(다 붙이면 보인다)
  const seams = new THREE.Group();
  for (let i = 0; i < pieces; i++) {
    const a = (i / pieces) * Math.PI * 2 + 0.3;
    const s = box(0.012, PLATE_R, 0.03, SEAM, 0, 0, 0);
    s.geometry.translate(0, PLATE_R / 2, 0);
    // 실린더의 theta 방향은 (sinθ, cosθ)이고 rotateX(π/2) 뒤에는 (sinθ, −cosθ)가 된다.
    // +y를 향한 막대를 z축으로 φ 돌리면 (−sinφ, cosφ)이므로 φ = θ + π
    s.rotation.z = a + Math.PI;
    s.position.z = 0.002;
    seams.add(s);
  }
  seams.visible = false;
  m.root.add(seams);
  m.parts.seams = seams;
  return m;
}

const BUILDERS: Record<string, () => Model> = {
  counter,
  shelf,
  stool,
  wallClock,
  frame,
  window: windowModel,
  displayCase,
  mantleClock,
  book: bookModel('#2f4f6b'),
  bookRed: bookModel('#8f3b2b'),
  deskLamp,
  bulb,
  plate,
};

export const MODEL_NAMES = Object.keys(BUILDERS);

export function buildModel(name: string): Model {
  const b = BUILDERS[name];
  if (!b) throw new Error(`알 수 없는 모델: ${name}`);
  return b();
}
