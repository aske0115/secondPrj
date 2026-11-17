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
const C_PUMPKIN = new THREE.Color(0xf08a2a);
const C_SMALL = new THREE.Color(0xe9e4d4), C_BIG = new THREE.Color(0x7fae6a), C_DIRT = new THREE.Color(0x9c7550); // 터질 때 조각 색
// 망치 휘두름: 부채꼴이 잠깐 번쩍인다. 레벨마다 각도가 달라 그때그때 만든다
const swing = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, depthWrite: false }));
swing.position.y = 0.08;
scene.add(swing);
let swingArc = -1, ringAtHero = true;
const logMesh = instanced(
  mergeGeometries([
    new THREE.CylinderGeometry(0.36, 0.36, 3.2, 9).rotateZ(Math.PI / 2),
  ]),
  flat(0x8a5a3c), 4, true,
);
const pumpkinMesh = instanced(pumpkin.geo, pumpkin.mat, 12, true);
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
type Log = { x: number; z: number; dx: number; dz: number; left: number; roll: number };
type Pumpkin = { x0: number; z0: number; x: number; z: number; tx: number; tz: number; t: number; y: number };
type Bit = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: THREE.Color };
const newGame = () => ({
  t: 0, px: 0, pz: 0, face: 0, hp: MT.maxHp(meta), maxHp: MT.maxHp(meta), inv: 0, level: 0, xp: 0, picks: 0,
  charge: Math.floor(MT.startChargeFrac(meta) * R.sweepCost(0)), kills: 0, falls: 0,
  lv: R.startLevels(), enemies: [] as Enemy[], logs: [] as Log[], pumpkins: [] as Pumpkin[], bits: [] as Bit[],
  hammerCd: 0.5, logCd: 2, pumpkinCd: 1.5, swingT: 1, swingYaw: 0, spawnCd: 0.6, shake: 0, stop: 0, ringT: 1, ringR: 1, moving: false,
  vx: 0, vz: 0, bt: 0, bonusDone: false, bonusFalls: 0, // 박치기 보너스
  isl: R.ISLAND_R as number, chain: 0, chainT: 0, // 이어서 떨어뜨린 수와 남은 시간
});
let g = newGame();
let mode: 'title' | 'play' | 'bonus' | 'pick' | 'over' = 'title';
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
// iPhone 웹뷰에서는 터치 이벤트가 가장 확실하다(포인터 이벤트는 떼는 신호를 놓치면 조이스틱이 옛 손가락에 묶였다).
// 새 손가락은 항상 조이스틱을 넘겨받는다. 데스크톱은 마우스 포인터로 받는다
function inputStart(id: number, x: number, y: number) {
  sfx.unlockAudio();
  joyId = id;
  jox = x;
  joy = y;
  jx = jz = 0;
  stick.style.cssText = `display:block;left:${jox}px;top:${joy}px`;
  knob.style.cssText = '';
}
function inputMove(id: number, x: number, y: number) {
  if (id !== joyId) return;
  let dx = x - jox, dy = y - joy, d = Math.hypot(dx, dy);
  if (d < 4) return;
  if (d > 56 && mode !== 'bonus') { // 손가락이 원 밖으로 나가면 원점이 따라와서 방향 전환이 바로 먹힌다(보너스는 튕긴 길이를 재야 해서 제외)
    jox += (dx / d) * (d - 56);
    joy += (dy / d) * (d - 56);
    dx = x - jox;
    dy = y - joy;
    d = 56;
    stick.style.left = `${jox}px`;
    stick.style.top = `${joy}px`;
  }
  const m = Math.min(1, d / 40);
  jx = (dx / d) * m;
  jz = (dy / d) * m;
  knob.style.setProperty('--kx', `${jx * 28}px`);
  knob.style.setProperty('--ky', `${jz * 28}px`);
}
function inputEnd(id: number, x: number, y: number) {
  if (id !== joyId) return;
  if (mode === 'bonus') dash(x - jox, y - joy);
  resetInput();
}
function resetInput() {
  joyId = -1;
  jx = jz = 0;
  stick.style.display = 'none';
}
const canvas = renderer.domElement, opts = { passive: false } as const;
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.changedTouches[e.changedTouches.length - 1];
  inputStart(t.identifier, t.clientX, t.clientY);
}, opts);
addEventListener('touchmove', (e) => {
  if (joyId === -1) return;
  e.preventDefault(); // 웹뷰가 끌기를 스크롤·제스처로 가로채지 않게
  for (const t of e.changedTouches) inputMove(t.identifier, t.clientX, t.clientY);
}, opts);
const touchEnd = (e: TouchEvent) => { for (const t of e.changedTouches) inputEnd(t.identifier, t.clientX, t.clientY); };
addEventListener('touchend', touchEnd);
addEventListener('touchcancel', touchEnd);
canvas.addEventListener('pointerdown', (e) => e.pointerType === 'mouse' && inputStart(-2, e.clientX, e.clientY));
addEventListener('pointermove', (e) => e.pointerType === 'mouse' && inputMove(-2, e.clientX, e.clientY));
addEventListener('pointerup', (e) => e.pointerType === 'mouse' && inputEnd(-2, e.clientX, e.clientY));
// 앱이 뒤로 가거나 창이 흐려지면 손을 뗀 것으로 본다
addEventListener('blur', resetInput);
document.addEventListener('visibilitychange', resetInput);
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
  gainXp(R.killXp(e.big));
  burst(e.x, e.z, e.big ? C_BIG : C_SMALL, e.big ? 12 : 6);
  drop(i);
}

let lastFallSfx = 0;
function fall(e: Enemy) {
  e.out = true;
  e.vy = 4; // 살짝 튀었다가 떨어진다
  g.falls++;
  if (mode === 'bonus') g.bonusFalls++;
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
  ringAtHero = true;
  g.shake = 0.7;
  g.stop = 0.07; // 짧게 멈춰 타격감을 준다
  sfx.thud();
  sfx.splash();
  sfx.buzz(30);
}

// ───────── 박치기 보너스(판 중간 미니게임) ─────────
function dash(dx: number, dy: number) {
  const len = Math.hypot(dx, dy), sp = R.dashSpeed(len);
  if (!sp) return;
  g.vx = (dx / len) * sp;
  g.vz = (dy / len) * sp;
  sfx.snap();
  sfx.buzz(12);
}
/** 볼링핀처럼 세모로 모인 해골 무리 */
function spawnPins() {
  const [cx, cz] = onIsland(0.25, 0.6);
  if (Math.hypot(cx - g.px, cz - g.pz) < 3) return;
  const a = Math.atan2(cx - g.px, cz - g.pz);
  for (let row = 0; row < 3; row++)
    for (let k = 0; k <= row; k++) {
      const side = (k - row / 2) * 1, back = row * 0.9;
      const x = cx + Math.sin(a) * back + Math.cos(a) * side, z = cz + Math.cos(a) * back - Math.sin(a) * side;
      g.enemies.push({ x, z, y: 0, vy: 0, kx: 0, kz: 0, hp: 1e9, big: false, out: false, flash: 0, hop: rnd(0, 6), age: 0, bladeCd: 0 });
    }
}
function startBonus() {
  mode = 'bonus';
  resetInput();
  g.bt = R.BONUS_SECONDS;
  g.bonusFalls = 0;
  for (const e of g.enemies) if (!e.out) { e.out = true; e.vy = 6; e.kx = e.x * 0.3; e.kz = e.z * 0.3; } // 싸우던 적은 치운다(보상 없음)
  g.logs.length = g.pumpkins.length = 0;
  for (let i = 0; i < 3; i++) spawnPins();
  toast(L('보너스! 튕겨서 박치기', 'Bonus! Flick to ram'));
  sfx.sparkle();
}
function endBonus() {
  for (const e of g.enemies) if (!e.out) { e.out = true; e.vy = 6; }
  g.bonusDone = true;
  g.vx = g.vz = 0;
  resetInput();
  mode = 'play';
  toast(L(`보너스 끝! +${g.bonusFalls * R.BONUS_COIN} 코인`, `Bonus over! +${g.bonusFalls * R.BONUS_COIN} coins`));
  g.inv = 1;
  if (g.picks) showPick();
}

function nearest(maxD: number, minD = 0) {
  let best: Enemy | null = null, bd = maxD;
  for (const e of g.enemies) {
    const d = Math.hypot(e.x - g.px, e.z - g.pz);
    if (!e.out && d < bd && d >= minD) { bd = d; best = e; }
  }
  return best;
}
function weapons(dt: number) {
  const es = g.enemies;
  // 망치: 가까운 적 쪽으로 부채꼴
  g.hammerCd -= dt;
  const rad = R.hammerRadius(g.lv.hammer), target = g.hammerCd <= 0 ? nearest(rad + 0.6) : null;
  if (target) {
    g.hammerCd = R.hammerCooldown(g.lv.hammer);
    const yaw = Math.atan2(target.x - g.px, target.z - g.pz), half = R.hammerArc(g.lv.hammer) / 2;
    for (let i = es.length - 1; i >= 0; i--) {
      const e = es[i], dx = e.x - g.px, dz = e.z - g.pz, d = Math.hypot(dx, dz) || 1;
      let da = Math.atan2(dx, dz) - yaw;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (e.out || d > rad + eRadius(e) || Math.abs(da) > half) continue;
      hit(i, 14, (dx / d) * 9, (dz / d) * 9);
    }
    g.swingT = 0;
    g.swingYaw = yaw;
    g.face = yaw;
    sfx.snap();
  }
  // 통나무: 주인공 근처를 지나가게 섬 끝에서 굴려 보낸다
  if (g.lv.log) {
    g.logCd -= dt;
    if (g.logCd <= 0) {
      g.logCd = R.logInterval(g.lv.log);
      for (let k = 0; k < R.logCount(g.lv.log); k++) {
        const a = rnd(0, Math.PI * 2), dx = Math.sin(a), dz = Math.cos(a), off = rnd(-1.5, 1.5) + k * 3;
        const sx = g.px - dx * (g.isl + 2) + dz * off, sz = g.pz - dz * (g.isl + 2) - dx * off;
        g.logs.push({ x: sx, z: sz, dx, dz, left: (g.isl + 2) * 2 + 4, roll: 0 });
      }
      sfx.rumble();
    }
  }
  for (let k = g.logs.length - 1; k >= 0; k--) {
    const L1 = g.logs[k], step = 10 * dt;
    L1.x += L1.dx * step;
    L1.z += L1.dz * step;
    L1.roll += step / 0.36;
    if ((L1.left -= step) <= 0) { g.logs.splice(k, 1); continue; }
    for (let i = es.length - 1; i >= 0; i--) {
      const e = es[i], rx = e.x - L1.x, rz = e.z - L1.z;
      const along = rx * L1.dx + rz * L1.dz, side = rx * L1.dz - rz * L1.dx;
      if (e.out || e.bladeCd > 0 || Math.abs(along) > 0.4 + eRadius(e) || Math.abs(side) > 1.7) continue;
      e.bladeCd = 0.4;
      hit(i, 8, L1.dx * 13, L1.dz * 13);
    }
  }
  // 호박 폭탄: 조금 떨어진 적에게 던진다
  if (g.lv.pumpkin) {
    g.pumpkinCd -= dt;
    if (g.pumpkinCd <= 0) {
      g.pumpkinCd = R.pumpkinInterval(g.lv.pumpkin);
      for (let k = 0; k < R.pumpkinCount(g.lv.pumpkin); k++) {
        const t = nearest(9, 2.5 + k * 1.5) ?? nearest(9);
        if (t) g.pumpkins.push({ x0: g.px, z0: g.pz, x: g.px, z: g.pz, tx: t.x + rnd(-0.5, 0.5), tz: t.z + rnd(-0.5, 0.5), t: 0, y: 0 });
      }
    }
  }
  for (let k = g.pumpkins.length - 1; k >= 0; k--) {
    const pk = g.pumpkins[k];
    pk.t = Math.min(1, pk.t + dt / 0.6);
    pk.x = pk.x0 + (pk.tx - pk.x0) * pk.t;
    pk.z = pk.z0 + (pk.tz - pk.z0) * pk.t;
    pk.y = Math.sin(pk.t * Math.PI) * 2.6;
    if (pk.t < 1) continue;
    g.pumpkins.splice(k, 1);
    const rad = R.pumpkinRadius(g.lv.pumpkin);
    for (let i = es.length - 1; i >= 0; i--) {
      const e = es[i], dx = e.x - pk.x, dz = e.z - pk.z, d = Math.hypot(dx, dz) || 1;
      if (e.out || d > rad) continue;
      const kk = 11 * (1 - (d / rad) * 0.5);
      hit(i, 12, (dx / d) * kk, (dz / d) * kk);
    }
    burst(pk.x, pk.z, C_PUMPKIN, 10);
    g.ringT = 0.35;
    g.ringR = rad;
    ring.position.set(pk.x, 0.06, pk.z);
    ringAtHero = false;
    g.shake = Math.max(g.shake, 0.25);
    sfx.thud();
  }
}

function update(dt: number) {
  const bonus = mode === 'bonus';
  if (bonus) {
    g.bt -= dt;
    if (g.bt <= 0) return endBonus();
  } else {
    g.t += dt;
    if (g.t >= R.RUN_SECONDS) return end(true);
    if (g.t >= R.BONUS_AT && !g.bonusDone) return startBonus();
  }
  g.inv -= dt;
  g.chainT -= dt;
  const isl = R.islandRadius(g.t, stage().crumbles);
  if (isl < g.isl) crumble(isl);

  if (bonus) { // 돌진: 미끄러지다 멈추고, 가장자리에서는 튕겨 나온다
    g.px += g.vx * dt;
    g.pz += g.vz * dt;
    const f = Math.exp(-2.4 * dt);
    g.vx *= f;
    g.vz *= f;
    const d = Math.hypot(g.px, g.pz), lim = g.isl - 0.7;
    if (d > lim) {
      const nx = g.px / d, nz = g.pz / d, dot = g.vx * nx + g.vz * nz;
      g.px = nx * lim;
      g.pz = nz * lim;
      if (dot > 0) { g.vx -= 1.6 * dot * nx; g.vz -= 1.6 * dot * nz; }
    }
    g.moving = Math.hypot(g.vx, g.vz) > 1;
    if (g.moving) g.face = Math.atan2(g.vx, g.vz);
    if (g.enemies.filter((e) => !e.out).length < 6) spawnPins();
  }

  // 주인공
  let mx = jx, mz = jz;
  if (joyId === -1) {
    mx = +(keys.has('KeyD') || keys.has('ArrowRight')) - +(keys.has('KeyA') || keys.has('ArrowLeft'));
    mz = +(keys.has('KeyS') || keys.has('ArrowDown')) - +(keys.has('KeyW') || keys.has('ArrowUp'));
    const m = Math.hypot(mx, mz) || 1;
    mx /= m;
    mz /= m;
  }
  if (!bonus) g.moving = Math.hypot(mx, mz) > 0.05;
  if (!bonus && g.moving) {
    const sp = R.moveSpeed(g.lv.speed);
    g.px += mx * sp * dt;
    g.pz += mz * sp * dt;
    g.face = Math.atan2(mx, mz);
    const d = Math.hypot(g.px, g.pz), lim = g.isl - 0.7;
    if (d > lim) { g.px *= lim / d; g.pz *= lim / d; }
  }

  // 적이 올라온다
  g.spawnCd -= dt;
  if (!bonus && g.spawnCd <= 0) {
    g.spawnCd = R.spawnInterval(g.t) / stage().spawn;
    for (let i = Math.round(R.spawnBatch(g.t) * stage().spawn); i > 0 && g.enemies.length < R.MAX_ENEMIES; i--) spawn();
  }

  // 적 이동·낙하·접촉
  const decay = Math.exp((bonus ? -1.4 : -4.5) * dt); // 보너스 판은 볼링 레인처럼 멀리 미끄러진다
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
    const sp = bonus ? 0 : (e.big ? 1.4 : 2.2 + g.t * 0.006) * stage().speed;
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
    else if (bonus) {
      // 돌진한 몸에 부딪히면 그 힘을 받아 날아간다
      const hs = Math.hypot(g.vx, g.vz);
      if (hs > 2 && d < 0.4 + eRadius(e)) {
        e.kx += g.vx * 1.15 + (-dx / d) * 3;
        e.kz += g.vz * 1.15 + (-dz / d) * 3;
        e.flash = 0.1;
        g.vx *= 0.75;
        g.vz *= 0.75;
        sfx.thud();
      }
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
      const ka = Math.hypot(a.kx, a.kz), kb = Math.hypot(b.kx, b.kz);
      if (ka > 3 && ka > kb * 1.5) { b.kx += a.kx * 0.7; b.kz += a.kz * 0.7; a.kx *= 0.55; a.kz *= 0.55; b.flash = 0.1; }
      else if (kb > 3 && kb > ka * 1.5) { a.kx += b.kx * 0.7; a.kz += b.kz * 0.7; b.kx *= 0.55; b.kz *= 0.55; a.flash = 0.1; }
      a.x -= dx * push;
      a.z -= dz * push;
      b.x += dx * push;
      b.z += dz * push;
    }
  }

  if (!bonus) weapons(dt);

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
  mixer.update((mode === 'play' || mode === 'bonus') && g.stop <= 0 ? dt : 0);
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
  g.logs.forEach((l, i) => put(logMesh, i, l.x, 0.36, l.z, Math.atan2(l.dx, l.dz), 1, 1, 1, l.roll));
  sync(logMesh, g.logs.length);
  g.pumpkins.forEach((pk, i) => put(pumpkinMesh, i, pk.x, pk.y, pk.z, pk.t * 9, 1.1));
  sync(pumpkinMesh, g.pumpkins.length);
  g.swingT = Math.min(1, g.swingT + dt * 6);
  swing.visible = g.swingT < 1;
  if (swing.visible) {
    const arc = R.hammerArc(g.lv.hammer);
    if (arc !== swingArc) { // 부채꼴은 +z 쪽 가운데로 만든다
      swing.geometry.dispose();
      swing.geometry = new THREE.RingGeometry(0.4, 1, 24, 1, Math.PI / 2 - arc / 2, arc).rotateX(-Math.PI / 2);
      swingArc = arc;
    }
    swing.position.set(g.px, 0.08, g.pz);
    swing.rotation.y = g.swingYaw;
    swing.scale.setScalar(R.hammerRadius(g.lv.hammer) * (0.7 + g.swingT * 0.3));
    (swing.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - g.swingT);
  }
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
  if (ringAtHero) ring.position.set(g.px, 0.06, g.pz);
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
  hammer: '<path d="M5 19l8-8M9 5l6-1 5 5-1 6-4-4-2 2-4-4 2-2z"/>',
  log: '<rect x="2" y="9" width="17" height="6" rx="3"/><ellipse cx="19" cy="12" rx="2.5" ry="3"/>',
  pumpkin: '<path d="M12 7c-5 0-8 3-8 7s3 6 8 6 8-2 8-6-3-7-8-7zM12 7V4M12 7c-1.5 3-1.5 9 0 13"/>',
  sweep: '<path d="M5 12a7 7 0 0 1 14 0M2 12a10 10 0 0 1 20 0M9 12a3 3 0 0 1 6 0"/>',
  knock: '<path d="M3 12h11M10 6l6 6-6 6M20 5v14"/>',
  speed: '<path d="M5 6l6 6-6 6M12 6l6 6-6 6"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
};
const UPS: Record<R.UpgradeId | 'heart', [string, string, string]> = {
  hammer: [L('망치', 'Mallet'), L('더 자주, 더 넓게 휘두릅니다', 'Swings faster and wider'), '#f0a24a'],
  log: [L('굴러가는 통나무', 'Rolling log'), L('통나무가 섬을 가로질러 적을 쓸어냅니다', 'A log rolls across the isle, sweeping foes'), '#a0703f'],
  pumpkin: [L('호박 폭탄', 'Pumpkin bomb'), L('던진 호박이 터지며 둥글게 밀어냅니다', 'Thrown pumpkins burst and push foes away'), '#f08a2a'],
  sweep: [L('쓸어내기', 'Sweep'), L('더 넓게 쓸고 더 빨리 찹니다', 'Wider sweep, charges faster'), '#ff8a4c'],
  knock: [L('밀치기', 'Shove'), L('모든 공격이 적을 더 멀리 밀어냅니다', 'Every hit knocks enemies farther'), '#b06ee8'],
  speed: [L('가벼운 신발', 'Light boots'), L('더 빨리 움직입니다', 'Move faster'), '#3fc1a5'],
  heart: [L('회복', 'Heal'), L('체력을 하나 채웁니다', 'Restore one heart'), '#ff5a6e'],
};
const svg = (body: string, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}">${body}</svg>`;
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
function toast(text: string) {
  const el = $('toast');
  el.textContent = text;
  el.className = '';
  void el.offsetWidth;
  el.className = 'pop';
}
function show(html: string, cls = '') {
  overlay.className = cls;
  overlay.innerHTML = html;
  overlay.hidden = false;
}
function showPick() {
  const picks = R.pickUpgrades(g.lv, g.hp >= g.maxHp);
  if (!picks.length) return void (g.picks = 0);
  mode = 'pick';
  resetInput();
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
  resetInput();
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
  const coins = MT.coinsFor(g.kills, g.falls, win, stageIdx) + g.bonusFalls * R.BONUS_COIN;
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
  const left = Math.max(0, Math.ceil(mode === 'bonus' ? g.bt : R.RUN_SECONDS - g.t));
  if (shown.left !== left) {
    hud.time.textContent = clock(left);
    hud.time.classList.toggle('hurry', mode !== 'bonus' && left <= 10);
    hud.time.classList.toggle('bonus', mode === 'bonus');
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
    if (g.chain >= 2) toast(L(`낙하 ×${g.chain}!`, `Drop ×${g.chain}!`)); // 이어서 떨어뜨리면 가운데에 크게
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
  if (mode === 'play' || mode === 'bonus') {
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
    hud.dev.textContent = `${fps}fps · ${g.enemies.length} · ${renderer.info.render.calls}dc · in ${joyId === -1 ? '-' : `${jx.toFixed(1)},${jz.toFixed(1)}`}`;
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
      // 방향(mx, mz)을 주면 그 방향으로 민 것처럼, 안 주면 지금 입력 그대로 시간을 흘린다
      step: (sec: number, mx?: number, mz?: number) => {
        const fake = mx !== undefined;
        if (fake) { jx = mx; jz = mz ?? 0; joyId = 99; }
        for (let i = 0; i < sec * 60 && (mode === 'play' || mode === 'bonus'); i++) update(1 / 60);
        if (fake) resetInput();
      },
    },
  });
