// 미니어처 섬 지키기 프로토타입(결정 032). 드래그로 이동, 공격은 자동, 게이지가 차면 쓸어내기로 적을 섬 밖으로 민다.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { L } from './i18n';
import * as sfx from './audio';
import * as R from './game/rules';
import * as MT from './game/meta';

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

const hemi = new THREE.HemisphereLight(0xffffff, 0x8fb0c8, 1.25);
scene.add(hemi);
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
  tilt.uniforms.v.value = 3.2 / h;
}
addEventListener('resize', resize);
resize();

// ───────── 모양 ─────────
const flat = (color: number, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, max: number, shadow = false) {
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.frustumCulled = false; // 인스턴스가 계속 움직여 경계 구가 맞지 않는다
  m.castShadow = shadow;
  m.count = 0;
  scene.add(m);
  return m;
}
const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
const EUL = new THREE.Euler(0, 0, 0, 'YXZ');
function put(mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, pitch = 0) {
  M.compose(P.set(x, y, z), Q.setFromEuler(EUL.set(pitch, yaw, 0)), S.set(sx, sy, sz));
  mesh.setMatrixAt(i, M);
}

// 섬과 장식(장식은 부딪히지 않는다)
const grass = new THREE.Mesh(new THREE.CylinderGeometry(R.ISLAND_R, R.ISLAND_R - 0.5, 1, 40), flat(0x86c46a));
grass.position.y = -0.5;
grass.receiveShadow = true;
const cliff = new THREE.Mesh(new THREE.CylinderGeometry(R.ISLAND_R - 0.6, 3, 9, 11, 2), flat(0xb89468));
cliff.position.y = -5.5;
scene.add(grass, cliff);

// 모델(Kenney CC0, public/models). 여러 조각을 한 덩어리로 구워 인스턴스로 그린다
const loader = new GLTFLoader();
const model = (path: string) => loader.loadAsync(`${import.meta.env.BASE_URL}models/${path}.glb`);
/** 바닥 가운데를 원점으로 옮기고 높이를 맞춘다 */
function fit(geo: THREE.BufferGeometry, height: number) {
  geo.computeBoundingBox();
  const b = geo.boundingBox!, k = height / (b.max.y - b.min.y);
  return geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2).scale(k, k, k);
}
async function bake(path: string, height: number) {
  const { scene: root } = await model(path);
  root.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  let map: THREE.Texture | null = null;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const geo = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'uv']) geo.setAttribute(k, o.geometry.attributes[k]);
    geo.setIndex(o.geometry.index);
    parts.push(geo.applyMatrix4(o.matrixWorld));
    map ??= (o.material as THREE.MeshStandardMaterial).map;
  });
  return { geo: fit(mergeGeometries(parts), height), mat: new THREE.MeshLambertMaterial({ map }) };
}
type Prop = { m: THREE.InstancedMesh; i: number; x: number; z: number; yaw: number; s: number; y: number; vy: number };
const props: Prop[] = [];
function place(p: Prop) {
  put(p.m, p.i, p.x, p.y, p.z, p.yaw, p.s, p.s, p.s, p.y * -0.08);
  p.m.instanceMatrix.needsUpdate = true;
}
function prop(b: { geo: THREE.BufferGeometry; mat: THREE.Material }, n: number, min: number, max: number, s0: number, s1: number) {
  const m = instanced(b.geo, b.mat, n, true);
  for (let i = 0; i < n; i++) {
    const [x, z] = onIsland(min, max), p = { m, i, x, z, yaw: rnd(0, 6), s: rnd(s0, s1), y: 0, vy: 0 };
    props.push(p);
    place(p);
  }
  m.count = n;
}
const onIsland = (min: number, max: number) => {
  const a = rnd(0, Math.PI * 2), d = R.ISLAND_R * rnd(min, max);
  return [Math.cos(a) * d, Math.sin(a) * d] as const;
};
function insert([x, z]: readonly [number, number], y = 0) {
  return [x, y, z] as const;
}
const [pine, pine2, rocks, rocksTall, trunk, pumpkin, skel, zombie, heroGltf] = await Promise.all([
  bake('graveyard/pine', 3.2), bake('graveyard/pine-crooked', 3), bake('graveyard/rocks', 0.6), bake('graveyard/rocks-tall', 1.1),
  bake('graveyard/trunk', 0.5), bake('graveyard/pumpkin', 0.5), bake('graveyard/character-skeleton', 1.05),
  bake('graveyard/character-zombie', 1.05), model('dungeon/character-human'),
]);
// 나무는 가장자리에만 둬서 싸움터를 가리지 않는다
prop(pine, 6, 0.82, 0.96, 0.8, 1.2);
prop(pine2, 4, 0.8, 0.96, 0.8, 1.2);
prop(rocks, 6, 0.45, 0.95, 0.6, 1);
prop(rocksTall, 3, 0.75, 0.95, 0.8, 1.2);
prop(trunk, 3, 0.4, 0.9, 1, 1.3);
prop(pumpkin, 5, 0.3, 0.95, 0.8, 1.3);
const flowers = instanced(new THREE.SphereGeometry(0.09, 6, 4), flat(0xffffff), 70);
for (let i = 0; i < 70; i++) {
  put(flowers, i, ...insert(onIsland(0.05, 0.74), 0.08));
  flowers.setColorAt(i, new THREE.Color([0xffffff, 0xffe27a, 0xff9fb8][i % 3]));
}
flowers.count = 70;
const clouds = instanced(new THREE.IcosahedronGeometry(1, 1), flat(0xffffff), 9);
for (let i = 0; i < 9; i++) put(clouds, i, rnd(-24, 24), rnd(-13, -6), rnd(-26, 14), 0, rnd(3, 6), rnd(1.2, 2), rnd(2.5, 4));
clouds.count = 9;

// 주인공: 한 명뿐이라 뼈대 애니메이션을 그대로 쓴다. +z를 본다
const hero = heroGltf.scene;
hero.scale.setScalar(1.25 / new THREE.Box3().setFromObject(hero).getSize(P).y);
hero.traverse((o) => (o.castShadow = true));
scene.add(hero);
const mixer = new THREE.AnimationMixer(hero);
const clip = (name: string) => mixer.clipAction(THREE.AnimationClip.findByName(heroGltf.animations, name)!);
const heroIdle = clip('idle'), heroWalk = clip('sprint');
heroIdle.play();
heroWalk.play().setEffectiveWeight(0);

// 적: 작은 놈은 해골, 큰 놈은 좀비. 인스턴스 색을 곱해 피격 번쩍임을 낸다
const smallMesh = instanced(skel.geo, skel.mat, R.MAX_ENEMIES, true);
const bigMesh = instanced(zombie.geo, zombie.mat, R.MAX_ENEMIES, true);
const C_PLAIN = new THREE.Color(1, 1, 1), C_FLASH = new THREE.Color(3, 3, 3);
const C_SMALL = new THREE.Color(0xe9e4d4), C_BIG = new THREE.Color(0x7fae6a), C_DIRT = new THREE.Color(0x9c7550); // 터질 때 조각 색
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
let warnRings: THREE.Mesh[] = [];
function buildWarnRings(cs: readonly R.Crumble[]) {
  for (const m of warnRings) { scene.remove(m); m.geometry.dispose(); }
  warnRings = cs.map((c, k) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(c.r, k ? cs[k - 1].r : R.ISLAND_R, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, depthWrite: false }),
    );
    m.position.y = 0.03;
    m.visible = false;
    scene.add(m);
    return m;
  });
}
let islandVis: number = R.ISLAND_R; // 보이는 반지름은 실제 값을 부드럽게 따라간다

// ───────── 판 사이에 남는 것 ─────────
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* 저장 실패 시 이번 실행에서만 */ } },
};
let meta = MT.loadMeta(store.get('meta'), R.STAGES.length);
const saveMeta = () => store.set('meta', JSON.stringify(meta));
let stageIdx = Math.min(meta.cleared, R.STAGES.length - 1);
const stage = () => R.STAGES[stageIdx];
function applyStage() {
  const st = stage(), night = stageIdx === 2;
  (grass.material as THREE.MeshLambertMaterial).color.set(st.grass);
  (cliff.material as THREE.MeshLambertMaterial).color.set(st.cliff);
  (scene.background as THREE.Color).set(st.sky);
  scene.fog!.color.set(st.sky);
  sun.color.set(st.sun);
  hemi.intensity = night ? 0.8 : 1.25;
  document.body.style.background = `#${st.sky.toString(16).padStart(6, '0')}`;
  buildWarnRings(st.crumbles);
}

// ───────── 상태 ─────────
type Enemy = { x: number; z: number; y: number; vy: number; kx: number; kz: number; hp: number; big: boolean; out: boolean; flash: number; hop: number; age: number; bladeCd: number };
type Shot = { x: number; z: number; dx: number; dz: number; life: number };
type Gem = { x: number; z: number; xp: number };
type Bit = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: THREE.Color };
const newGame = () => ({
  t: 0, px: 0, pz: 0, face: 0, hp: MT.maxHp(meta), maxHp: MT.maxHp(meta), inv: 0, level: 0, xp: 0, picks: 0,
  charge: Math.floor(MT.startChargeFrac(meta) * R.sweepCost(0)), kills: 0, falls: 0,
  lv: R.startLevels(), enemies: [] as Enemy[], shots: [] as Shot[], gems: [] as Gem[], bits: [] as Bit[],
  shotCd: 0.4, spawnCd: 0.6, shake: 0, stop: 0, ringT: 1, ringR: 1, orbitA: 0, moving: false,
  isl: R.ISLAND_R as number, chain: 0, chainT: 0, // 이어서 떨어뜨린 수와 남은 시간
});
let g = newGame();
let mode: 'title' | 'play' | 'pick' | 'over' = 'title';
const eScale = (e: Enemy) => (e.big ? 1.5 : 1);
const eRadius = (e: Enemy) => 0.45 * eScale(e);
function resetIsland() {
  islandVis = R.ISLAND_R;
  for (const p of props) { p.y = p.vy = 0; place(p); }
}

// ───────── 입력: 화면 어디든 누른 자리가 조이스틱 원점 ─────────
let joyId = -1, jox = 0, joy = 0, jx = 0, jz = 0;
const keys = new Set<string>();
const stick = $('stick'), knob = stick.firstElementChild as HTMLElement;
renderer.domElement.addEventListener('pointerdown', (e) => {
  sfx.unlockAudio();
  if (joyId >= 0) return;
  joyId = e.pointerId;
  jox = e.clientX;
  joy = e.clientY;
  stick.style.cssText = `display:block;left:${jox}px;top:${joy}px`;
  knob.style.cssText = '';
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
  knob.style.setProperty('--kx', `${jx * 28}px`);
  knob.style.setProperty('--ky', `${jz * 28}px`);
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
    if (Math.hypot(Math.cos(a) * g.isl - g.px, Math.sin(a) * g.isl - g.pz) > 5) break;
  }
  const st = stage(), big = Math.random() < Math.min(0.6, R.bigChance(g.t) * st.big), d = g.isl - 0.8;
  g.enemies.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 0, vy: 0, kx: 0, kz: 0, hp: R.enemyHp(g.t, big) * st.hp, big, out: false, flash: 0, hop: rnd(0, 6), age: 0, bladeCd: 0 });
}

function burst(x: number, z: number, color: THREE.Color, n: number) {
  for (let i = 0; i < n && g.bits.length < 256; i++)
    g.bits.push({ x, y: 0.4, z, vx: rnd(-4, 4), vy: rnd(3, 8), vz: rnd(-4, 4), life: rnd(0.35, 0.6), color });
}

let lastPop = 0, combo = 0;
function reward(charge: number) {
  g.kills++;
  g.charge = Math.min(R.sweepCost(g.lv.sweep), g.charge + charge);
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
  const km = R.knockMul(g.lv.knock) * MT.shoveMul(meta);
  e.kx += kx * km;
  e.kz += kz * km;
  if (e.hp > 0) return;
  reward(R.KILL_CHARGE);
  g.gems.push({ x: e.x, z: e.z, xp: R.killXp(e.big) });
  if (g.gems.length > 400) gainXp(g.gems.shift()!.xp);
  burst(e.x, e.z, e.big ? C_BIG : C_SMALL, e.big ? 12 : 6);
  drop(i);
}

let lastFallSfx = 0;
function fall(e: Enemy) {
  e.out = true;
  e.vy = 4; // 살짝 튀었다가 떨어진다
  g.falls++;
  g.chain = g.chainT > 0 ? g.chain + 1 : 1;
  g.chainT = 1.2;
  reward(R.FALL_CHARGE);
  gainXp(R.fallXp(e.big));
  const now = performance.now();
  if (now - lastFallSfx > 70) {
    lastFallSfx = now;
    sfx.whoosh();
  }
}

function crumble(r: number) {
  g.isl = r;
  g.shake = 1;
  g.stop = 0.1;
  sfx.rumble();
  sfx.buzz(40);
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    burst(Math.cos(a) * (r + 0.8), Math.sin(a) * (r + 0.8), C_DIRT, 3);
  }
  for (const e of g.enemies) if (!e.out && Math.hypot(e.x, e.z) > r) fall(e); // 무너진 땅 위의 적은 같이 떨어진다
}

function gainXp(n: number) {
  g.xp += n * MT.xpMul(meta);
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
  g.chainT -= dt;
  const isl = R.islandRadius(g.t, stage().crumbles);
  if (isl < g.isl) crumble(isl);

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
    const d = Math.hypot(g.px, g.pz), lim = g.isl - 0.7;
    if (d > lim) { g.px *= lim / d; g.pz *= lim / d; }
  }

  // 적이 올라온다
  g.spawnCd -= dt;
  if (g.spawnCd <= 0) {
    g.spawnCd = R.spawnInterval(g.t) / stage().spawn;
    for (let i = Math.round(R.spawnBatch(g.t) * stage().spawn); i > 0 && g.enemies.length < R.MAX_ENEMIES; i--) spawn();
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
    const sp = (e.big ? 1.4 : 2.2 + g.t * 0.006) * stage().speed;
    e.x += ((dx / d) * sp + e.kx) * dt;
    e.z += ((dz / d) * sp + e.kz) * dt;
    e.kx *= decay;
    e.kz *= decay;
    e.hop += dt * (e.big ? 6 : 9);
    const off = Math.hypot(e.x, e.z);
    if (off > g.isl && Math.hypot(e.kx, e.kz) < 2) { // 자기들끼리 밀려서는 떨어지지 않는다
      e.x *= g.isl / off;
      e.z *= g.isl / off;
    } else if (off > g.isl) fall(e); // 맞아서 섬 밖으로 밀리면 떨어진다. 보석을 못 남기니 경험치는 바로 준다
    else if (d < 0.35 + eRadius(e) && g.inv <= 0) hurt();
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
  const w = heroWalk.getEffectiveWeight() + (g.moving ? dt : -dt) * 8, ww = Math.min(1, Math.max(0, w));
  heroWalk.setEffectiveWeight(ww);
  heroIdle.setEffectiveWeight(1 - ww);
  mixer.update(mode === 'play' && g.stop <= 0 ? dt : 0);
  hero.position.set(g.px, 0, g.pz);
  hero.rotation.y = g.face;
  hero.visible = g.inv <= 0 || Math.floor(g.inv * 14) % 2 === 0;

  let ns = 0, nb = 0;
  for (const e of g.enemies) {
    const hop = e.out ? 0 : Math.abs(Math.sin(e.hop)), sc = eScale(e) * Math.min(1, e.age * 4);
    const mesh = e.big ? bigMesh : smallMesh, i = e.big ? nb++ : ns++;
    const roll = e.out ? Math.min(2.6, -e.y * 0.35 + 0.6) : 0; // 떨어질 때 뒤로 넘어가며 구른다
    put(mesh, i, e.x, e.y + hop * 0.22, e.z, Math.atan2(g.px - e.x, g.pz - e.z), sc * (1.04 - hop * 0.08), sc * (0.94 + hop * 0.12), sc * (1.04 - hop * 0.08), -roll);
    mesh.setColorAt(i, e.flash > 0 ? C_FLASH : C_PLAIN);
  }
  sync(smallMesh, ns);
  sync(bigMesh, nb);
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

  islandVis += (g.isl - islandVis) * Math.min(1, dt * 5);
  const k = islandVis / R.ISLAND_R;
  grass.scale.set(k, 1, k);
  cliff.scale.set(k, 1, k);
  for (const p of props) {
    if (p.y < -30 || Math.hypot(p.x, p.z) < g.isl - 0.3) continue;
    p.vy -= 25 * dt;
    p.y += p.vy * dt;
    place(p);
  }
  const warn = mode === 'play' ? R.crumbleWarning(g.t, stage().crumbles) : -1;
  warnRings.forEach((m, i) => {
    m.visible = i === warn;
    if (m.visible) (m.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.3 * Math.abs(Math.sin(now * 0.008));
  });

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
const ICON: Record<R.UpgradeId | 'heart', string> = {
  shot: '<circle cx="15" cy="12" r="5.5"/><path d="M3 8h6M2 12h6M3 16h6"/>',
  orbit: '<circle cx="12" cy="12" r="3"/><path d="M12 3a9 9 0 0 1 9 9M12 21a9 9 0 0 1-9-9"/>',
  sweep: '<path d="M5 12a7 7 0 0 1 14 0M2 12a10 10 0 0 1 20 0M9 12a3 3 0 0 1 6 0"/>',
  knock: '<path d="M3 12h11M10 6l6 6-6 6M20 5v14"/>',
  speed: '<path d="M5 6l6 6-6 6M12 6l6 6-6 6"/>',
  magnet: '<path d="M6 4v8a6 6 0 0 0 12 0V4M6 8h4M14 8h4"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
};
const UPS: Record<R.UpgradeId | 'heart', [string, string, string]> = {
  shot: [L('돌팔매', 'Sling'), L('더 빨리, 더 많이 던집니다', 'Throws faster and more'), '#f0a24a'],
  orbit: [L('회전 칼날', 'Orbit blades'), L('주위를 도는 칼날이 하나 늘어납니다', 'One more blade circles you'), '#7d8cf0'],
  sweep: [L('쓸어내기', 'Sweep'), L('더 넓게 쓸고 더 빨리 찹니다', 'Wider sweep, charges faster'), '#ff8a4c'],
  knock: [L('밀치기', 'Shove'), L('모든 공격이 적을 더 멀리 밀어냅니다', 'Every hit knocks enemies farther'), '#b06ee8'],
  speed: [L('가벼운 신발', 'Light boots'), L('더 빨리 움직입니다', 'Move faster'), '#3fc1a5'],
  magnet: [L('자석', 'Magnet'), L('보석을 더 멀리서 끌어옵니다', 'Pull gems from farther away'), '#e2577a'],
  heart: [L('회복', 'Heal'), L('체력을 하나 채웁니다', 'Restore one heart'), '#ff5a6e'],
};
const svg = (body: string, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}">${body}</svg>`;
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
function show(html: string, cls = '') {
  overlay.className = cls;
  overlay.innerHTML = html;
  overlay.hidden = false;
}
function showPick() {
  const picks = R.pickUpgrades(g.lv, g.hp >= g.maxHp);
  if (!picks.length) return void (g.picks = 0);
  mode = 'pick';
  sfx.sparkle();
  const cards = picks.map((id) => {
    const [name, desc, c] = UPS[id], lv = id === 'heart' ? 0 : g.lv[id];
    const tag = id === 'heart' ? '' : lv ? `<em>Lv ${lv} → ${lv + 1}</em>` : `<em class="new">NEW</em>`;
    return `<button class="card" data-id="${id}" style="--c:${c}"><div class="ico">${svg(ICON[id])}</div><b>${name}</b>${tag}<span>${desc}</span></button>`;
  });
  show(`<h2 class="big-title" style="font-size:34px">${L('레벨 업!', 'Level up!')}</h2><p class="tag">${L('하나를 고르세요', 'Pick one')}</p><div class="cards">${cards.join('')}</div>`);
}
const PERK_UI: Record<MT.Perk, [string, string, string, string]> = {
  vigor: [L('튼튼한 몸', 'Sturdy'), L('시작 체력 +1', 'Start with +1 heart'), '#ff5a6e', ICON.heart],
  shove: [L('묵직한 손', 'Heavy hands'), L('모든 넉백 +12%', 'All knockback +12%'), '#b06ee8', ICON.knock],
  charge: [L('미리 충전', 'Head start'), L('쓸어! 게이지 15%를 채우고 시작', 'Start with 15% Sweep charge'), '#ff8a4c', ICON.sweep],
  wisdom: [L('지혜', 'Wisdom'), L('경험치 +10%', 'XP +10%'), '#35b9ab', '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'],
};
const coinPill = () => `<div class="coins"><i></i>${meta.coins.toLocaleString()}</div>`;
const stageName = (i: number) => L(...R.STAGES[i].name);

function startRun() {
  g = newGame();
  camTarget.set(0, 0, 0);
  resetIsland();
  shown.hp = -1;
  overlay.hidden = true;
  mode = 'play';
  g.inv = 0.6;
}
function showTitle() {
  mode = 'title';
  applyStage();
  resetIsland();
  const locked = stageIdx > meta.cleared;
  show(
    `<div class="top">${coinPill()}<h1 class="big-title">${L('섬 지키기', 'Hold<br>the Isle')}</h1><p class="tag">${L('몰려오는 적을 섬 밖으로 쓸어버리세요', 'Sweep the horde off your tiny island')}</p></div>` +
      `<div style="display:grid;gap:12px;justify-items:center;width:100%">` +
      `<div class="stage"><button data-act="prev" ${stageIdx ? '' : 'disabled'} aria-label="${L('이전 섬', 'Previous isle')}">‹</button>` +
      `<div><small>${L('섬', 'Isle')} ${stageIdx + 1} / ${R.STAGES.length}</small><b>${locked ? '🔒 ' : ''}${stageName(stageIdx)}</b></div>` +
      `<button data-act="next" ${stageIdx < R.STAGES.length - 1 ? '' : 'disabled'} aria-label="${L('다음 섬', 'Next isle')}">›</button></div>` +
      (locked ? `<p class="best">${L(`${stageName(stageIdx - 1)}을 지키면 열립니다`, `Defend ${stageName(stageIdx - 1)} to unlock`)}</p>` : bestLine()) +
      `<button class="go" data-act="start" ${locked ? 'disabled' : ''}>${L('시작', 'Start')}</button>` +
      `<button class="sub" data-act="shop">${L('강화 상점', 'Upgrades')}</button></div>`,
    'title',
  );
}
function showShop() {
  mode = 'title';
  const cards = MT.PERKS.map((id) => {
    const [name, desc, c, ico] = PERK_UI[id], lv = meta.perks[id], max = MT.PERK_MAX[id], cost = MT.perkCost(id, lv);
    const btn = lv >= max ? `<button class="buy" disabled>MAX</button>` : `<button class="buy" data-act="buy" data-perk="${id}" ${meta.coins < cost ? 'disabled' : ''}><i></i>${cost}</button>`;
    return `<div class="card perk" style="--c:${c}"><div class="ico">${svg(ico)}</div><b>${name}</b><em>${'●'.repeat(lv)}${'○'.repeat(max - lv)}</em><span>${desc}</span>${btn}</div>`;
  });
  show(`<h2 class="big-title" style="font-size:32px">${L('강화 상점', 'Upgrades')}</h2>${coinPill()}<div class="cards">${cards.join('')}</div><button class="sub" data-act="title">${L('돌아가기', 'Back')}</button>`, 'shop');
}
overlay.addEventListener('click', (ev) => {
  const btn = (ev.target as HTMLElement).closest('button');
  if (!btn || btn.disabled) return;
  sfx.unlockAudio();
  sfx.click();
  const act = btn.dataset.act, id = btn.dataset.id as R.UpgradeId | 'heart' | undefined;
  if (act === 'start') return startRun();
  if (act === 'shop') return showShop();
  if (act === 'title') return showTitle();
  if (act === 'prev' || act === 'next') {
    stageIdx = Math.max(0, Math.min(R.STAGES.length - 1, stageIdx + (act === 'next' ? 1 : -1)));
    return showTitle();
  }
  if (act === 'nextIsle') {
    stageIdx++;
    applyStage();
    return startRun();
  }
  if (act === 'buy') {
    const next = MT.buy(meta, btn.dataset.perk as MT.Perk);
    if (next) { meta = next; saveMeta(); sfx.coin(); }
    return showShop();
  }
  if (!id) return;
  if (id === 'heart') g.hp = Math.min(g.maxHp, g.hp + 1);
  else g.lv[id]++;
  overlay.hidden = true;
  mode = 'play';
  g.inv = Math.max(g.inv, 0.6);
  if (--g.picks > 0) showPick();
});

// 섬마다 최고 기록(기기에만 저장)
type Best = { time: number; kills: number; falls: number };
const loadBest = (): Best => {
  try { return { time: 0, kills: 0, falls: 0, ...JSON.parse(store.get(`best-${stageIdx}`) ?? '{}') }; } catch { return { time: 0, kills: 0, falls: 0 }; }
};
const bestLine = () => {
  const b = loadBest();
  return b.kills ? `<p class="best">${L('최고 기록', 'Best')} · ${clock(b.time)} · ${L('처치', 'KOs')} ${b.kills}</p>` : '';
};
function end(win: boolean) {
  mode = 'over';
  win ? sfx.finale() : sfx.fail();
  const sec = Math.floor(g.t), score = { time: sec, kills: g.kills, falls: g.falls }, best = loadBest();
  const isBest = score.time > best.time || (score.time === best.time && score.kills > best.kills);
  if (isBest) store.set(`best-${stageIdx}`, JSON.stringify(score));
  const coins = MT.coinsFor(g.kills, g.falls, win, stageIdx);
  const unlocked = win && stageIdx === meta.cleared && stageIdx < R.STAGES.length;
  meta = { ...meta, coins: meta.coins + coins, cleared: unlocked ? stageIdx + 1 : meta.cleared };
  saveMeta();
  const hasNext = win && stageIdx + 1 < R.STAGES.length;
  const cell = (label: string, v: string | number, hi = false) => `<div class="${hi ? 'hi' : ''}"><small>${label}</small><strong>${v}</strong></div>`;
  show(
    `<h1 class="big-title" style="font-size:36px">${win ? L('섬을 지켰다!', 'Isle defended!') : L('섬을 빼앗겼다', 'The isle fell')}</h1>` +
      `<div class="panel"><div class="stats">` +
      cell(L('버틴 시간', 'Survived'), clock(sec)) + cell(L('레벨', 'Level'), g.level + 1) +
      cell(L('처치', 'KOs'), g.kills) + cell(L('떨어뜨림', 'Knocked off'), g.falls, true) +
      `</div><div class="earn"><i></i>+${coins}</div>` +
      (unlocked && hasNext ? `<span class="badge">${L(`새 섬: ${stageName(stageIdx + 1)}`, `New isle: ${stageName(stageIdx + 1)}`)}</span>` : '') +
      (isBest ? `<span class="badge">${L('최고 기록!', 'New best!')}</span>` : '') + `</div>` +
      (hasNext ? `<button class="go" data-act="nextIsle">${L('다음 섬으로', 'Next isle')}</button><button class="sub" data-act="start">${L('한 번 더', 'Once more')}</button>`
        : `<button class="go" data-act="start">${L('한 번 더', 'Once more')}</button>`) +
      `<div class="row"><button class="sub" data-act="shop">${L('강화 상점', 'Upgrades')}</button><button class="sub" data-act="title">${L('처음으로', 'Home')}</button></div>`,
  );
}
$('sweep').querySelector('span')!.textContent = L('쓸어!', 'Sweep!');

// 바뀔 때만 DOM을 고친다(매 프레임 innerHTML을 쓰면 폰에서 느려진다)
const hud = { toast: $('toast'), warn: $('warn'), hearts: $('hearts'), time: $('time'), lvl: $('lvl'), xp: $('xp').querySelector('i')!, falls: $('falls'), sweep: $('sweep'), dev: $('dev') };
const shown = { hp: -1, left: -1, level: -1, xp: -1, falls: -1, p: -1, mode: '', warn: -1 };
const HEART = '<path d="M12 21s-8-5-8-11.5A4.5 4.5 0 0 1 12 6.6a4.5 4.5 0 0 1 8 2.9C20 16 12 21 12 21z"/>';
function drawHud() {
  if (shown.mode !== mode) document.body.dataset.mode = shown.mode = mode;
  if (shown.hp !== g.hp) {
    hud.hearts.innerHTML = Array.from({ length: g.maxHp }, (_, i) => svg(HEART, i < g.hp ? '' : i < shown.hp ? 'empty lost' : 'empty')).join('');
    shown.hp = g.hp;
  }
  const left = Math.max(0, Math.ceil(R.RUN_SECONDS - g.t));
  if (shown.left !== left) {
    hud.time.textContent = clock(left);
    hud.time.classList.toggle('hurry', left <= 10);
    shown.left = left;
  }
  if (shown.level !== g.level) {
    hud.lvl.textContent = String(g.level + 1);
    hud.lvl.classList.remove('up');
    if (shown.level >= 0) void hud.lvl.offsetWidth, hud.lvl.classList.add('up'); // 애니메이션 다시 틀기
    shown.level = g.level;
  }
  const xp = Math.round((g.xp / R.xpNeed(g.level)) * 100);
  if (shown.xp !== xp) hud.xp.style.width = `${(shown.xp = xp)}%`;
  if (shown.falls !== g.falls) {
    hud.falls.innerHTML = `${L('떨어뜨림', 'Knocked off')} <b>${(shown.falls = g.falls)}</b>`;
    if (g.chain >= 2) { // 이어서 떨어뜨리면 가운데에 크게
      hud.toast.textContent = L(`낙하 ×${g.chain}!`, `Drop ×${g.chain}!`);
      hud.toast.className = '';
      void hud.toast.offsetWidth;
      hud.toast.className = 'pop';
    }
  }
  const warn = mode === 'play' ? R.crumbleWarning(g.t, stage().crumbles) : -1;
  if (shown.warn !== warn) {
    shown.warn = warn;
    hud.warn.hidden = warn < 0;
    hud.warn.textContent = L('가장자리가 무너집니다!', 'The edge is crumbling!');
  }
  const p = Math.round((g.charge / R.sweepCost(g.lv.sweep)) * 100);
  if (shown.p !== p) {
    hud.sweep.style.setProperty('--p', String((shown.p = p)));
    hud.sweep.classList.toggle('ready', p >= 100);
  }
}

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
  drawHud();
  frames++;
  if (DEV && now - fpsAt >= 500) {
    fps = Math.round((frames * 1000) / (now - fpsAt));
    frames = 0;
    fpsAt = now;
    hud.dev.textContent = `${fps}fps · ${g.enemies.length} · ${renderer.info.render.calls}dc`;
  }
}
showTitle();
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
      // 그리기 한 번(후처리 포함)에 드는 평균 시간(ms). 창이 가려져 fps가 안 맞을 때 쓴다
      bench: (n = 30) => {
        const gl = renderer.getContext(), t0 = performance.now();
        for (let i = 0; i < n; i++) { draw(1 / 60, t0 + i * 16); composer.render(); }
        gl.finish();
        return +((performance.now() - t0) / n).toFixed(2);
      },
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
