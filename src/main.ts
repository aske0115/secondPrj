// 미니어처 섬 지키기 프로토타입(결정 032). 드래그로 이동, 공격은 자동, 게이지가 차면 쓸어내기로 적을 섬 밖으로 민다.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { L } from './i18n';
import * as sfx from './audio';
import * as R from './game/rules';

const $ = (id: string) => document.getElementById(id)!;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ───────── 장면: 미니어처 느낌은 모델보다 조명·그림자·위아래 흐림에서 나온다 ─────────
const SKY = 0xbfe6f5;
const renderer = new THREE.WebGLRenderer({ powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.info.autoReset = false; // 후처리 패스까지 합친 그리기 횟수를 보려고 직접 초기화한다
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 58, 86);
const camera = new THREE.PerspectiveCamera(26, 1, 10, 200); // 좁은 화각으로 멀리서 봐야 모형처럼 보인다
const CAM_DIR = new THREE.Vector3(0, 0.8, 0.6).normalize();
let camDist = 50;
const camTarget = new THREE.Vector3();

scene.add(new THREE.HemisphereLight(0xffffff, 0x8fb0c8, 1.25));
const sun = new THREE.DirectionalLight(0xfff0d2, 2.3);
sun.position.set(10, 22, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
sun.shadow.normalBias = 0.03;
scene.add(sun);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
const tilt = new ShaderPass(VerticalTiltShiftShader);
tilt.uniforms.r.value = 0.5;
composer.addPass(tilt);
composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight, t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  camDist = Math.max(9.5 / (2 * t * camera.aspect), 15 / (2 * t)); // 가로 9.5칸은 항상 보이게
  tilt.uniforms.v.value = 2.4 / h;
}
addEventListener('resize', resize);
resize();

// ───────── 모양: 색을 꼭짓점에 구워 한 덩어리로 합친다(그리기 횟수 절약) ─────────
const flat = (color: number, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
const painted = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
function part(geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0) {
  const c = new THREE.Color(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  return geo.translate(x, y, z).setAttribute('color', new THREE.BufferAttribute(a, 3));
}
function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, max: number, shadow = false) {
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.frustumCulled = false; // 인스턴스가 계속 움직여 경계 구가 맞지 않는다
  m.castShadow = shadow;
  m.count = 0;
  scene.add(m);
  return m;
}
const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
function put(mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx) {
  M.compose(P.set(x, y, z), Q.setFromAxisAngle(UP, yaw), S.set(sx, sy, sz));
  mesh.setMatrixAt(i, M);
}

// 섬과 장식(장식은 부딪히지 않는다)
const grass = new THREE.Mesh(new THREE.CylinderGeometry(R.ISLAND_R, R.ISLAND_R - 0.5, 1, 40), flat(0x86c46a));
grass.position.y = -0.5;
grass.receiveShadow = true;
const cliff = new THREE.Mesh(new THREE.CylinderGeometry(R.ISLAND_R - 0.6, 3, 9, 11, 2), flat(0xb89468));
cliff.position.y = -5.5;
scene.add(grass, cliff);

const trees = instanced(
  mergeGeometries([
    part(new THREE.CylinderGeometry(0.16, 0.24, 0.9, 6), 0x8a5a3c, 0, 0.45),
    part(new THREE.ConeGeometry(0.95, 1.5, 7), 0x4fae62, 0, 1.5),
    part(new THREE.ConeGeometry(0.7, 1.2, 7), 0x67c474, 0, 2.3),
  ]),
  painted, 9, true,
);
const stones = instanced(new THREE.DodecahedronGeometry(0.5), flat(0xb9bfc9), 10, true);
const flowers = instanced(new THREE.SphereGeometry(0.09, 6, 4), flat(0xffffff), 70);
const onIsland = (min: number, max: number) => {
  const a = rnd(0, Math.PI * 2), d = R.ISLAND_R * rnd(min, max);
  return [Math.cos(a) * d, Math.sin(a) * d] as const;
};
for (let i = 0; i < 9; i++) put(trees, i, ...insert(onIsland(0.82, 0.96)), rnd(0, 6), rnd(0.8, 1.3)); // 가장자리에만 둬서 싸움터를 가리지 않는다
for (let i = 0; i < 10; i++) put(stones, i, ...insert(onIsland(0.3, 0.95), 0.1), rnd(0, 6), rnd(0.5, 1.2), rnd(0.4, 0.8));
for (let i = 0; i < 70; i++) {
  put(flowers, i, ...insert(onIsland(0.05, 0.97), 0.08));
  flowers.setColorAt(i, new THREE.Color([0xffffff, 0xffe27a, 0xff9fb8][i % 3]));
}
trees.count = 9;
stones.count = 10;
flowers.count = 70;
function insert([x, z]: readonly [number, number], y = 0) {
  return [x, y, z] as const;
}
const clouds = instanced(new THREE.IcosahedronGeometry(1, 1), flat(0xffffff), 9);
for (let i = 0; i < 9; i++) put(clouds, i, rnd(-24, 24), rnd(-13, -6), rnd(-26, 14), 0, rnd(3, 6), rnd(1.2, 2), rnd(2.5, 4));
clouds.count = 9;

// 주인공(임시 모양, 에셋으로 바꿀 자리). +z를 본다
const hero = new THREE.Mesh(
  mergeGeometries([
    part(new THREE.CylinderGeometry(0.22, 0.34, 0.6, 8), 0x4f7de0, 0, 0.3),
    part(new THREE.SphereGeometry(0.28, 10, 8), 0xffd9b5, 0, 0.82),
    part(new THREE.ConeGeometry(0.3, 0.42, 8), 0xe2574c, 0, 1.22),
    part(new THREE.SphereGeometry(0.05, 6, 4), 0x2a2233, 0.1, 0.86, 0.25),
    part(new THREE.SphereGeometry(0.05, 6, 4), 0x2a2233, -0.1, 0.86, 0.25),
  ]),
  painted,
);
hero.castShadow = true;
scene.add(hero);

// 적: 눈이 달린 말랑한 덩어리. 몸은 흰색으로 굽고 인스턴스 색을 곱해 종류·피격 번쩍임을 낸다
const enemyMesh = instanced(
  mergeGeometries([
    part(new THREE.SphereGeometry(0.5, 12, 8).scale(1, 0.8, 1), 0xffffff, 0, 0.4),
    part(new THREE.SphereGeometry(0.09, 6, 4), 0x1c1626, 0.17, 0.5, 0.42),
    part(new THREE.SphereGeometry(0.09, 6, 4), 0x1c1626, -0.17, 0.5, 0.42),
  ]),
  painted, R.MAX_ENEMIES, true,
);
const C_SMALL = new THREE.Color(0xff8fa3), C_BIG = new THREE.Color(0x8a7cf5), C_FLASH = new THREE.Color(3, 3, 3);
const shotMesh = instanced(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff1a0 }), 64);
const gemMesh = instanced(new THREE.OctahedronGeometry(0.2), flat(0x55e6d6, { emissive: 0x55e6d6, emissiveIntensity: 0.7 }), 400);
const bladeMesh = instanced(new THREE.BoxGeometry(0.6, 0.08, 0.18), flat(0xf4f7ff), 6, true);
const bitMesh = instanced(new THREE.BoxGeometry(0.16, 0.16, 0.16), flat(0xffffff), 256);
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }),
);
ring.position.y = 0.06;
ring.visible = false;
scene.add(ring);

// ───────── 상태 ─────────
type Enemy = { x: number; z: number; y: number; vy: number; kx: number; kz: number; hp: number; big: boolean; out: boolean; flash: number; hop: number; age: number; bladeCd: number };
type Shot = { x: number; z: number; dx: number; dz: number; life: number };
type Gem = { x: number; z: number; xp: number };
type Bit = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: THREE.Color };
const newGame = () => ({
  t: 0, px: 0, pz: 0, face: 0, hp: R.MAX_HP, inv: 0, level: 0, xp: 0, picks: 0, charge: 0, kills: 0, falls: 0,
  lv: R.startLevels(), enemies: [] as Enemy[], shots: [] as Shot[], gems: [] as Gem[], bits: [] as Bit[],
  shotCd: 0.4, spawnCd: 0.6, shake: 0, stop: 0, ringT: 1, ringR: 1, orbitA: 0, moving: false,
});
let g = newGame();
let mode: 'title' | 'play' | 'pick' | 'over' = 'title';
const eScale = (e: Enemy) => (e.big ? 1.6 : 0.9);
const eRadius = (e: Enemy) => 0.45 * eScale(e);

// ───────── 입력: 화면 어디든 누른 자리가 조이스틱 원점 ─────────
let joyId = -1, jox = 0, joy = 0, jx = 0, jz = 0;
const keys = new Set<string>();
const stick = $('stick');
renderer.domElement.addEventListener('pointerdown', (e) => {
  sfx.unlockAudio();
  if (joyId >= 0) return;
  joyId = e.pointerId;
  jox = e.clientX;
  joy = e.clientY;
  stick.style.cssText = `display:block;left:${jox}px;top:${joy}px`;
});
addEventListener('pointermove', (e) => {
  if (e.pointerId !== joyId) return;
  let dx = e.clientX - jox, dy = e.clientY - joy;
  const d = Math.hypot(dx, dy);
  if (d < 4) return;
  if (d > 56) { // 손가락이 원 밖으로 나가면 원점이 따라와서 방향 전환이 바로 먹힌다
    jox += (dx / d) * (d - 56);
    joy += (dy / d) * (d - 56);
    dx = e.clientX - jox;
    dy = e.clientY - joy;
    stick.style.left = `${jox}px`;
    stick.style.top = `${joy}px`;
  }
  const m = Math.min(1, d / 40);
  jx = (dx / d) * m;
  jz = (dy / d) * m;
});
const release = (e: PointerEvent) => {
  if (e.pointerId !== joyId) return;
  joyId = -1;
  jx = jz = 0;
  stick.style.display = 'none';
};
addEventListener('pointerup', release);
addEventListener('pointercancel', release);
addEventListener('keydown', (e) => (e.code === 'Space' ? sweep() : keys.add(e.code)));
addEventListener('keyup', (e) => keys.delete(e.code));
$('sweep').addEventListener('pointerdown', () => sweep());

// ───────── 규칙 ─────────
function spawn() {
  let a = 0;
  for (let tries = 0; tries < 6; tries++) { // 주인공 코앞에서는 올라오지 않게
    a = rnd(0, Math.PI * 2);
    if (Math.hypot(Math.cos(a) * R.ISLAND_R - g.px, Math.sin(a) * R.ISLAND_R - g.pz) > 5) break;
  }
  const big = Math.random() < R.bigChance(g.t), d = R.ISLAND_R - 0.8;
  g.enemies.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 0, vy: 0, kx: 0, kz: 0, hp: R.enemyHp(g.t, big), big, out: false, flash: 0, hop: rnd(0, 6), age: 0, bladeCd: 0 });
}

function burst(x: number, z: number, color: THREE.Color, n: number) {
  for (let i = 0; i < n && g.bits.length < 256; i++)
    g.bits.push({ x, y: 0.4, z, vx: rnd(-4, 4), vy: rnd(3, 8), vz: rnd(-4, 4), life: rnd(0.35, 0.6), color });
}

let lastPop = 0, combo = 0;
function reward(e: Enemy) {
  g.kills++;
  g.charge = Math.min(R.sweepCost(g.lv.sweep), g.charge + 1);
  const now = performance.now();
  if (now - lastPop > 45) { // 한꺼번에 죽을 때 소리가 뭉개지지 않게, 이어 죽이면 음이 올라간다
    combo = now - lastPop < 500 ? combo + 1 : 0;
    lastPop = now;
    sfx.pling(combo % 11);
  }
}
// 뒤에서 앞으로 도는 반복문 안에서만 부른다(마지막 칸을 당겨 와 지운다)
function drop(i: number) {
  g.enemies[i] = g.enemies[g.enemies.length - 1];
  g.enemies.pop();
}
function hit(i: number, dmg: number, kx: number, kz: number) {
  const e = g.enemies[i];
  e.hp -= dmg;
  e.flash = 0.1;
  e.kx += kx;
  e.kz += kz;
  if (e.hp > 0) return;
  reward(e);
  g.gems.push({ x: e.x, z: e.z, xp: e.big ? 3 : 1 });
  if (g.gems.length > 400) gainXp(g.gems.shift()!.xp);
  burst(e.x, e.z, e.big ? C_BIG : C_SMALL, e.big ? 12 : 6);
  drop(i);
}

function gainXp(n: number) {
  g.xp += n;
  while (g.xp >= R.xpNeed(g.level)) {
    g.xp -= R.xpNeed(g.level);
    g.level++;
    g.picks++;
  }
  if (g.picks && mode === 'play') showPick();
}

function hurt() {
  g.hp--;
  g.inv = 1.2;
  g.shake = 0.6;
  sfx.thud();
  sfx.buzz(30);
  for (const e of g.enemies) { // 맞은 직후 숨 쉴 틈
    const dx = e.x - g.px, dz = e.z - g.pz, d = Math.hypot(dx, dz) || 1;
    if (d < 3.5) { e.kx += (dx / d) * 9; e.kz += (dz / d) * 9; }
  }
  if (g.hp <= 0) end(false);
}

function sweep() {
  if (mode !== 'play' || g.charge < R.sweepCost(g.lv.sweep)) return;
  g.charge = 0;
  const rad = R.sweepRadius(g.lv.sweep);
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];
    const dx = e.x - g.px, dz = e.z - g.pz, d = Math.hypot(dx, dz) || 1;
    if (e.out || d > rad) continue;
    const k = (24 * (1 - (d / rad) * 0.5)) / (e.big ? 1.5 : 1);
    hit(i, 6, (dx / d) * k, (dz / d) * k);
  }
  g.ringT = 0;
  g.ringR = rad;
  g.shake = 0.7;
  g.stop = 0.07; // 짧게 멈춰 타격감을 준다
  sfx.thud();
  sfx.splash();
  sfx.buzz(30);
}

function update(dt: number) {
  g.t += dt;
  if (g.t >= R.RUN_SECONDS) return end(true);
  g.inv -= dt;

  // 주인공
  let mx = jx, mz = jz;
  if (joyId < 0) {
    mx = +(keys.has('KeyD') || keys.has('ArrowRight')) - +(keys.has('KeyA') || keys.has('ArrowLeft'));
    mz = +(keys.has('KeyS') || keys.has('ArrowDown')) - +(keys.has('KeyW') || keys.has('ArrowUp'));
    const m = Math.hypot(mx, mz) || 1;
    mx /= m;
    mz /= m;
  }
  g.moving = Math.hypot(mx, mz) > 0.05;
  if (g.moving) {
    const sp = R.moveSpeed(g.lv.speed);
    g.px += mx * sp * dt;
    g.pz += mz * sp * dt;
    g.face = Math.atan2(mx, mz);
    const d = Math.hypot(g.px, g.pz), lim = R.ISLAND_R - 0.7;
    if (d > lim) { g.px *= lim / d; g.pz *= lim / d; }
  }

  // 적이 올라온다
  g.spawnCd -= dt;
  if (g.spawnCd <= 0) {
    g.spawnCd = R.spawnInterval(g.t);
    for (let i = R.spawnBatch(g.t); i > 0 && g.enemies.length < R.MAX_ENEMIES; i--) spawn();
  }

  // 적 이동·낙하·접촉
  const decay = Math.exp(-4.5 * dt);
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];
    e.age += dt;
    e.flash -= dt;
    e.bladeCd -= dt;
    if (e.out) {
      e.vy -= 30 * dt;
      e.y += e.vy * dt;
      e.x += e.kx * dt;
      e.z += e.kz * dt;
      if (e.y < -16) drop(i);
      continue;
    }
    const dx = g.px - e.x, dz = g.pz - e.z, d = Math.hypot(dx, dz) || 1;
    const sp = e.big ? 1.4 : 2.2 + g.t * 0.006;
    e.x += ((dx / d) * sp + e.kx) * dt;
    e.z += ((dz / d) * sp + e.kz) * dt;
    e.kx *= decay;
    e.kz *= decay;
    e.hop += dt * (e.big ? 6 : 9);
    const off = Math.hypot(e.x, e.z);
    if (off > R.ISLAND_R && Math.hypot(e.kx, e.kz) < 2) { // 자기들끼리 밀려서는 떨어지지 않는다
      e.x *= R.ISLAND_R / off;
      e.z *= R.ISLAND_R / off;
    } else if (off > R.ISLAND_R) { // 맞아서 섬 밖으로 밀리면 떨어진다. 보석을 못 남기니 경험치는 바로 준다
      e.out = true;
      g.falls++;
      reward(e);
      gainXp(e.big ? 3 : 1);
    } else if (d < 0.35 + eRadius(e) && g.inv <= 0) hurt();
  }
  // 서로 겹치지 않게 밀어낸다
  // shortcut: 모든 쌍을 비교한다(300마리면 4.5만 쌍), 적 상한을 올리면 격자 나누기로 바꾼다
  const es = g.enemies;
  for (let i = 0; i < es.length; i++) {
    const a = es[i];
    if (a.out) continue;
    for (let j = i + 1; j < es.length; j++) {
      const b = es[j];
      const dx = b.x - a.x, dz = b.z - a.z, min = eRadius(a) + eRadius(b);
      if (b.out || Math.abs(dx) > min || Math.abs(dz) > min) continue;
      const d = Math.hypot(dx, dz) || 0.01;
      if (d >= min) continue;
      const push = ((min - d) / d) * 0.5;
      a.x -= dx * push;
      a.z -= dz * push;
      b.x += dx * push;
      b.z += dz * push;
    }
  }

  // 돌팔매: 가장 가까운 적에게
  g.shotCd -= dt;
  if (g.shotCd <= 0) {
    let best: Enemy | null = null, bd = 10;
    for (const e of es) {
      const d = Math.hypot(e.x - g.px, e.z - g.pz);
      if (!e.out && d < bd) { bd = d; best = e; }
    }
    if (best) {
      g.shotCd = R.shotCooldown(g.lv.shot);
      const base = Math.atan2(best.x - g.px, best.z - g.pz), n = R.shotCount(g.lv.shot);
      for (let k = 0; k < n; k++) {
        const a = base + (k - (n - 1) / 2) * 0.2;
        g.shots.push({ x: g.px, z: g.pz, dx: Math.sin(a), dz: Math.cos(a), life: 0.75 });
      }
      sfx.tick(false);
    }
  }
  for (let s = g.shots.length - 1; s >= 0; s--) {
    const b = g.shots[s];
    b.x += b.dx * 17 * dt;
    b.z += b.dz * 17 * dt;
    b.life -= dt;
    let gone = b.life <= 0;
    for (let i = es.length - 1; i >= 0 && !gone; i--) {
      const e = es[i];
      if (e.out || Math.hypot(e.x - b.x, e.z - b.z) > eRadius(e) + 0.2) continue;
      hit(i, 10, b.dx * 3, b.dz * 3);
      gone = true;
    }
    if (gone) g.shots.splice(s, 1);
  }

  // 회전 칼날
  g.orbitA += dt * 3.4;
  const blades = R.orbitCount(g.lv.orbit);
  for (let k = 0; k < blades; k++) {
    const a = g.orbitA + (k / blades) * Math.PI * 2, bx = g.px + Math.sin(a) * 1.9, bz = g.pz + Math.cos(a) * 1.9;
    for (let i = es.length - 1; i >= 0; i--) {
      const e = es[i];
      if (e.out || e.bladeCd > 0 || Math.hypot(e.x - bx, e.z - bz) > eRadius(e) + 0.35) continue;
      e.bladeCd = 0.35;
      const dx = e.x - g.px, dz = e.z - g.pz, d = Math.hypot(dx, dz) || 1;
      hit(i, 7, (dx / d) * 5, (dz / d) * 5);
    }
  }

  // 보석: 가까우면 끌려온다
  const mag = R.magnetRadius(g.lv.magnet);
  for (let i = g.gems.length - 1; i >= 0; i--) {
    const m = g.gems[i];
    const dx = g.px - m.x, dz = g.pz - m.z, d = Math.hypot(dx, dz) || 0.01;
    if (d < 0.5) {
      g.gems.splice(i, 1);
      sfx.tick(true);
      gainXp(m.xp);
    } else if (d < mag) {
      m.x += (dx / d) * 14 * dt;
      m.z += (dz / d) * 14 * dt;
    }
  }

  for (let i = g.bits.length - 1; i >= 0; i--) {
    const b = g.bits[i];
    b.vy -= 24 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    if ((b.life -= dt) <= 0) g.bits.splice(i, 1);
  }
}

// ───────── 그리기 ─────────
function sync(mesh: THREE.InstancedMesh, n: number) {
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}
function draw(dt: number, now: number) {
  hero.position.set(g.px, g.moving ? Math.abs(Math.sin(now * 0.014)) * 0.14 : 0, g.pz);
  hero.rotation.y = g.face;
  hero.visible = g.inv <= 0 || Math.floor(g.inv * 14) % 2 === 0;

  g.enemies.forEach((e, i) => {
    const hop = e.out ? 0 : Math.abs(Math.sin(e.hop)), sc = eScale(e) * Math.min(1, e.age * 4), wide = sc * (1.12 - hop * 0.2);
    put(enemyMesh, i, e.x, e.y + hop * 0.28, e.z, Math.atan2(g.px - e.x, g.pz - e.z), wide, sc * (0.82 + hop * 0.34), wide);
    enemyMesh.setColorAt(i, e.flash > 0 ? C_FLASH : e.big ? C_BIG : C_SMALL);
  });
  sync(enemyMesh, g.enemies.length);
  g.shots.forEach((b, i) => put(shotMesh, i, b.x, 0.6, b.z));
  sync(shotMesh, Math.min(64, g.shots.length));
  g.gems.forEach((m, i) => put(gemMesh, i, m.x, 0.35 + Math.sin(now * 0.005 + i) * 0.08, m.z, now * 0.003 + i));
  sync(gemMesh, g.gems.length);
  const blades = R.orbitCount(g.lv.orbit);
  for (let k = 0; k < blades; k++) {
    const a = g.orbitA + (k / blades) * Math.PI * 2;
    put(bladeMesh, k, g.px + Math.sin(a) * 1.9, 0.5, g.pz + Math.cos(a) * 1.9, a * 4);
  }
  sync(bladeMesh, blades);
  g.bits.forEach((b, i) => {
    put(bitMesh, i, b.x, b.y, b.z, b.life * 20, Math.min(1, b.life * 4));
    bitMesh.setColorAt(i, b.color);
  });
  sync(bitMesh, g.bits.length);

  g.ringT = Math.min(1, g.ringT + dt * 3.2);
  ring.visible = g.ringT < 1;
  ring.position.set(g.px, 0.06, g.pz);
  ring.scale.setScalar(0.5 + g.ringR * g.ringT);
  (ring.material as THREE.MeshBasicMaterial).opacity = 1 - g.ringT;

  g.shake = Math.max(0, g.shake - dt * 3);
  camTarget.lerp(P.set(g.px, 0, g.pz), 1 - Math.exp(-6 * dt));
  camera.position.copy(camTarget).addScaledVector(CAM_DIR, camDist);
  camera.position.x += rnd(-1, 1) * g.shake * 0.5;
  camera.position.y += rnd(-1, 1) * g.shake * 0.5;
  camera.lookAt(camTarget);
}

// ───────── 화면 글자 ─────────
const overlay = $('overlay');
const UP_TEXT: Record<R.UpgradeId | 'heart', [string, string]> = {
  shot: [L('돌팔매', 'Sling'), L('더 빨리, 더 많이 던집니다', 'Throws faster and more')],
  orbit: [L('회전 칼날', 'Orbit blades'), L('주위를 도는 칼날이 하나 늘어납니다', 'One more blade circles you')],
  sweep: [L('쓸어내기', 'Sweep'), L('더 넓게 쓸고 더 빨리 찹니다', 'Wider sweep, charges faster')],
  speed: [L('가벼운 신발', 'Light boots'), L('더 빨리 움직입니다', 'Move faster')],
  magnet: [L('자석', 'Magnet'), L('보석을 더 멀리서 끌어옵니다', 'Pull gems from farther away')],
  heart: [L('회복', 'Heal'), L('체력을 하나 채웁니다', 'Restore one heart')],
};
function show(html: string) {
  overlay.innerHTML = html;
  overlay.hidden = false;
}
function showPick() {
  const picks = R.pickUpgrades(g.lv, g.hp >= R.MAX_HP);
  if (!picks.length) return void (g.picks = 0);
  mode = 'pick';
  sfx.sparkle();
  show(
    `<h2>${L('레벨 업!', 'Level up!')}</h2>` +
      picks
        .map((id) => {
          const pips = id === 'heart' ? '' : `<i>${'●'.repeat(g.lv[id])}${'○'.repeat(R.MAX_LEVEL - g.lv[id])}</i>`;
          return `<button class="card" data-id="${id}"><b>${UP_TEXT[id][0]}</b>${pips}<span>${UP_TEXT[id][1]}</span></button>`;
        })
        .join(''),
  );
}
overlay.addEventListener('click', (ev) => {
  const btn = (ev.target as HTMLElement).closest('button');
  if (!btn) return;
  sfx.unlockAudio();
  sfx.click();
  const id = btn.dataset.id as R.UpgradeId | 'heart' | undefined;
  if (!id) { // 시작·다시 하기
    g = newGame();
    camTarget.set(0, 0, 0);
  } else if (id === 'heart') g.hp++;
  else g.lv[id]++;
  overlay.hidden = true;
  mode = 'play';
  g.inv = Math.max(g.inv, 0.6);
  if (id && --g.picks > 0) showPick();
});
function end(win: boolean) {
  mode = 'over';
  win ? sfx.finale() : sfx.fail();
  const sec = Math.floor(g.t);
  show(
    `<h1>${win ? L('섬을 지켰습니다!', 'Island defended!') : L('섬을 빼앗겼습니다', 'The island fell')}</h1>` +
      `<p>${L('버틴 시간', 'Survived')} <b>${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</b><br>` +
      `${L('처치', 'Defeated')} <b>${g.kills}</b> · ${L('떨어뜨림', 'Knocked off')} <b>${g.falls}</b> · ${L('레벨', 'Level')} <b>${g.level + 1}</b></p>` +
      `<button class="go">${L('한 번 더', 'Once more')}</button>`,
  );
}
show(
  `<h1>${L('섬 지키기', 'Hold the Isle')}</h1>` +
    `<p>${L('끌어서 이동 · 공격은 자동<br>게이지가 차면 <b>쓸어!</b>로 섬 밖으로 밀어내기', 'Drag to move · attacks are automatic<br>When the gauge fills, <b>Sweep!</b> them off the isle')}</p>` +
    `<button class="go">${L('시작', 'Start')}</button>`,
);
$('sweep').querySelector('span')!.textContent = L('쓸어!', 'Sweep!');

const hud = { hearts: $('hearts'), time: $('time'), xp: $('xp').firstElementChild as HTMLElement, fill: $('sweep').firstElementChild as HTMLElement, dev: $('dev') };
const DEV = import.meta.env.MODE !== 'release'; // 실기기 성능을 눈으로 보려고 출시 빌드가 아니면 프레임 수를 띄운다
let last = performance.now(), frames = 0, fpsAt = last, fps = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (mode === 'play') {
    if (g.stop > 0) g.stop -= dt;
    else update(dt);
  }
  draw(dt, now);
  renderer.info.reset();
  composer.render();

  const left = Math.max(0, Math.ceil(R.RUN_SECONDS - g.t)), cost = R.sweepCost(g.lv.sweep);
  hud.hearts.textContent = '♥'.repeat(Math.max(0, g.hp)) + '♡'.repeat(R.MAX_HP - Math.max(0, g.hp));
  hud.time.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  hud.xp.style.width = `${(g.xp / R.xpNeed(g.level)) * 100}%`;
  hud.fill.style.height = `${(g.charge / cost) * 100}%`;
  $('sweep').classList.toggle('ready', g.charge >= cost);
  frames++;
  if (DEV && now - fpsAt >= 500) {
    fps = Math.round((frames * 1000) / (now - fpsAt));
    frames = 0;
    fpsAt = now;
    hud.dev.textContent = `${fps}fps · ${g.enemies.length} · ${renderer.info.render.calls}dc`;
  }
}
requestAnimationFrame(frame);

// 개발 훅: 콘솔에서 상태 확인·부하 시험(__demo.stress(300))
if (DEV)
  Object.assign(window, {
    __demo: {
      get g() { return g; },
      stats: () => ({ fps, mode, enemies: g.enemies.length, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
      stress: (n = R.MAX_ENEMIES) => { while (g.enemies.length < n) spawn(); },
      charge: () => (g.charge = 99),
      sweep,
      // 화면이 가려져 프레임이 안 돌 때도 규칙을 시험하려고 시간을 직접 흘린다
      step: (sec: number, mx = 0, mz = 0) => {
        jx = mx;
        jz = mz;
        joyId = 99;
        for (let i = 0; i < sec * 60 && mode === 'play'; i++) update(1 / 60);
        joyId = -1;
        jx = jz = 0;
      },
    },
  });
