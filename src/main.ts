// 망치섬 / Tumble Isle(결정 032·054). 드래그로 이동, 공격은 자동, 게이지가 차면 쾅!(땅 내려찍기)으로 적을 섬 밖으로 민다(쓸어킬과 겹치지 않게 '쓸어!'에서 바꿈, 결정 056).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { L } from './i18n';
import * as sfx from './audio';
import * as R from './game/rules';
import * as MT from './game/meta';
import * as MS from './game/missions';

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
type Prop = { m: THREE.InstancedMesh; i: number; bx: number; bz: number; x: number; z: number; yaw: number; s: number; y: number; vy: number };
const props: Prop[] = [];
function place(p: Prop) {
  put(p.m, p.i, p.x, p.y, p.z, p.yaw, p.s, p.s, p.s, p.y * -0.08);
  p.m.instanceMatrix.needsUpdate = true;
}
function prop(b: { geo: THREE.BufferGeometry; mat: THREE.Material }, n: number, min: number, max: number, s0: number, s1: number) {
  const m = instanced(b.geo, b.mat, n, true);
  for (let i = 0; i < n; i++) {
    const [x, z] = onIsland(min, max), p = { m, i, bx: x, bz: z, x, z, yaw: rnd(0, 6), s: rnd(s0, s1), y: 0, vy: 0 };
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
const [pine, pine2, rocks, rocksTall, trunk, pumpkin, skel, zombie, keeper, barrel, lantern] = await Promise.all([
  bake('graveyard/pine', 3.2), bake('graveyard/pine-crooked', 3), bake('graveyard/rocks', 0.6), bake('graveyard/rocks-tall', 1.1),
  bake('graveyard/trunk', 0.5), bake('graveyard/pumpkin', 0.5), bake('graveyard/character-skeleton', 1.05),
  bake('graveyard/character-zombie', 1.05), bake('graveyard/character-keeper', 1.15),
  bake('dungeon/barrel', 0.8), bake('graveyard/lantern-candle', 1.3),
]);
// 나무는 가장자리에만 둬서 싸움터를 가리지 않는다
prop(pine, 6, 0.82, 0.96, 0.8, 1.2);
prop(pine2, 4, 0.8, 0.96, 0.8, 1.2);
prop(rocks, 6, 0.45, 0.95, 0.6, 1);
prop(rocksTall, 3, 0.75, 0.95, 0.8, 1.2);
prop(trunk, 3, 0.4, 0.9, 1, 1.3);
prop(pumpkin, 5, 0.3, 0.95, 0.8, 1.3);
const flowers = instanced(new THREE.SphereGeometry(0.09, 6, 4), flat(0xffffff), 70);
const flowerAt = Array.from({ length: 70 }, () => onIsland(0.05, 0.9));
for (let i = 0; i < 70; i++) {
  put(flowers, i, ...insert(flowerAt[i], 0.08));
  flowers.setColorAt(i, new THREE.Color([0xffffff, 0xffe27a, 0xff9fb8][i % 3]));
}
flowers.count = 70;
const clouds = instanced(new THREE.IcosahedronGeometry(1, 1), flat(0xffffff), 9);
for (let i = 0; i < 9; i++) put(clouds, i, rnd(-24, 24), rnd(-13, -6), rnd(-26, 14), 0, rnd(3, 6), rnd(1.2, 2), rnd(2.5, 4));
clouds.count = 9;

// 주인공: 한 명뿐이라 뼈대 애니메이션을 그대로 쓴다. +z를 본다
// 주인공은 고른 캐릭터(결정 061). 모두 Kenney 모델이고 같은 이름의 애니메이션(idle·sprint)을 가진다
const HERO_PATH: Record<MT.CharId, string> = {
  human: 'dungeon/character-human', orc: 'dungeon/character-orc', keeper: 'graveyard/character-keeper',
  vampire: 'graveyard/character-vampire', ghost: 'graveyard/character-ghost',
};
const heroModels = Object.fromEntries(await Promise.all(MT.CHARS.map(async (c) => [c, await model(HERO_PATH[c])] as const))) as Record<MT.CharId, GLTF>;
for (const gl of Object.values(heroModels)) {
  gl.scene.scale.setScalar(1.25 / new THREE.Box3().setFromObject(gl.scene).getSize(P).y);
  gl.scene.traverse((o) => (o.castShadow = true));
}
let hero: THREE.Object3D = new THREE.Object3D(), mixer = new THREE.AnimationMixer(hero);
let heroIdle: THREE.AnimationAction, heroWalk: THREE.AnimationAction;
function setHero(id: MT.CharId) {
  scene.remove(hero);
  const gl = heroModels[id];
  hero = gl.scene;
  scene.add(hero);
  mixer = new THREE.AnimationMixer(hero);
  const clip = (name: string) => mixer.clipAction(THREE.AnimationClip.findByName(gl.animations, name)!);
  heroIdle = clip('idle');
  heroWalk = clip('sprint');
  heroIdle.play();
  heroWalk.play().setEffectiveWeight(0);
}

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
const hammerMat = flat(0x9aa3b0);
const hammer = new THREE.Group();
const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.55), flat(0x8a5a3c));
const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.36).translate(0, 0, 1.15), hammerMat);
handle.castShadow = head.castShadow = true;
hammer.add(handle, head);
scene.add(hammer);
const logMesh = instanced(
  mergeGeometries([
    new THREE.CylinderGeometry(0.36, 0.36, 3.2, 9).rotateZ(Math.PI / 2),
  ]),
  flat(0x8a5a3c), 4, true,
);
const pumpkinMesh = instanced(pumpkin.geo, pumpkin.mat, 12, true);
// 새 적 장식(결정 058): 풍선 해골의 풍선, 폭탄 해골의 머리 위 폭탄, 방패 좀비의 방패
const balloonMesh = instanced(mergeGeometries([new THREE.SphereGeometry(0.32, 12, 8), new THREE.CylinderGeometry(0.01, 0.01, 0.5, 3).translate(0, -0.55, 0)]), flat(0xff5a6e), 80, true);
const bombMesh = instanced(mergeGeometries([new THREE.SphereGeometry(0.22, 10, 8), new THREE.CylinderGeometry(0.03, 0.03, 0.18, 5).translate(0, 0.24, 0)]), flat(0x2a2a33), 80, true);
const shieldMesh = instanced(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 10).rotateX(Math.PI / 2), flat(0xb8bcc8), 80, true);
// 섬 장치(결정 059): 스프링 버섯(흰 줄기 + 빨간 갓), 통, 유령 등불(+ 끌어당기는 빛 고리)
const tint = (geo: THREE.BufferGeometry, hex: number) => {
  const c = new THREE.Color(hex), a = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) c.toArray(a, i);
  return geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
};
const springMesh = instanced(
  mergeGeometries([
    tint(new THREE.CylinderGeometry(0.16, 0.2, 0.35, 8).translate(0, 0.17, 0), 0xf3eadb),
    tint(new THREE.SphereGeometry(0.42, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1).translate(0, 0.33, 0), 0xe5484d),
    tint(new THREE.SphereGeometry(0.07, 6, 4).translate(0.18, 0.55, 0.12), 0xffffff),
    tint(new THREE.SphereGeometry(0.06, 6, 4).translate(-0.15, 0.56, -0.1), 0xffffff),
  ]),
  new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), R.GADGET_COUNT, true,
);
const barrelMesh = instanced(barrel.geo, barrel.mat, R.GADGET_COUNT, true);
const lanternMesh = instanced(lantern.geo, lantern.mat, R.GADGET_COUNT, true);
const pullRing = instanced(new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.5, depthWrite: false }), R.GADGET_COUNT);
// 날씨 줄무늬(바람에 날리는 흰 선)
const streakMesh = instanced(new THREE.BoxGeometry(0.04, 0.04, 1.4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }), 40);
// 내 섬 트로피(결정 060): 떨어뜨린 왕좀비는 금 동상, 미션 3개마다 금 호박. 시작 화면에서만 보인다
const goldMat = flat(0xffc94d, { emissive: 0x5a3a00 });
const statueMesh = instanced(zombie.geo, goldMat, 3, true);
const goldPumpkinMesh = instanced(pumpkin.geo, goldMat, 8, true);
const STATUE_AT = [[-2.6, -3.4], [2.8, -3.2], [0, -5]] as const;
// 왕좀비: 좀비 모양을 크게, 초록빛 + 금관
const bossMat = new THREE.MeshLambertMaterial({ map: (zombie.mat as THREE.MeshLambertMaterial).map, color: 0xd8ffc0 });
const bossFlash = new THREE.MeshLambertMaterial({ map: (zombie.mat as THREE.MeshLambertMaterial).map, color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 });
const bossBody = new THREE.Mesh(zombie.geo, bossMat);
const crown = new THREE.Mesh(
  mergeGeometries([0, 1, 2, 3, 4].map((k): THREE.BufferGeometry => new THREE.ConeGeometry(0.07, 0.16, 4).translate(Math.sin((k / 5) * Math.PI * 2) * 0.17, 0.12, Math.cos((k / 5) * Math.PI * 2) * 0.17)).concat([new THREE.CylinderGeometry(0.2, 0.2, 0.1, 10)])),
  flat(0xffd23f, { emissive: 0x6a4a00 }),
);
crown.position.y = 1.08;
const bossMesh = new THREE.Group();
bossMesh.add(bossBody, crown);
bossBody.castShadow = crown.castShadow = true;
bossMesh.visible = false;
scene.add(bossMesh);
const DROP_COLOR: Record<R.DropId, number> = { heart: 0xff5a6e, charge: 0xffb84d, golden: 0xffd23f, helper: 0x7d8cf0 };
const dropViews = Array.from({ length: 3 }, () => {
  const box = new THREE.Group();
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), flat(0xb07a45));
  crate.position.y = 0.3;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.14, 0.74), flat(0xffffff));
  band.position.y = 0.3;
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), flat(0xffffff, { side: THREE.DoubleSide }));
  canopy.position.y = 2.1;
  const lines = new THREE.Mesh(new THREE.ConeGeometry(1, 1.5, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }));
  lines.position.y = 1.35;
  lines.rotation.x = Math.PI;
  box.add(crate, band, canopy, lines);
  for (const m of [crate, band, canopy]) m.castShadow = true;
  const mark = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
  mark.position.y = 0.04;
  box.visible = mark.visible = false;
  scene.add(box, mark);
  return { box, band, canopy, lines, mark };
});
const arrowShape = new THREE.Shape([
  new THREE.Vector2(-0.12, 0), new THREE.Vector2(0.12, 0), new THREE.Vector2(0.12, 0.72),
  new THREE.Vector2(0.3, 0.72), new THREE.Vector2(0, 1), new THREE.Vector2(-0.3, 0.72), new THREE.Vector2(-0.12, 0.72),
]);
const aim = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffb84d, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
aim.visible = false;
scene.add(aim);
const helperMesh = new THREE.Mesh(keeper.geo, keeper.mat);
helperMesh.castShadow = true;
helperMesh.visible = false;
scene.add(helperMesh);
const bitMesh = instanced(new THREE.BoxGeometry(0.16, 0.16, 0.16), flat(0xffffff), 256);
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }),
);
ring.position.y = 0.06;
ring.visible = false;
scene.add(ring);
let warnRings: THREE.Mesh[] = [];
function buildWarnRings(st: R.Stage) {
  const cs = st.crumbles;
  for (const m of warnRings) { scene.remove(m); m.geometry.dispose(); }
  warnRings = cs.map((c, k) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(c.r, k ? cs[k - 1].r : st.r, 64).rotateX(-Math.PI / 2),
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
meta.missions = MS.fillMissions(meta.missions);
setHero(meta.hero);
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
  buildWarnRings(st);
}

// ───────── 상태 ─────────
type Enemy = { x: number; z: number; y: number; vy: number; kx: number; kz: number; hp: number; big: boolean; out: boolean; flash: number; hop: number; age: number; bladeCd: number; kind: R.Kind };
type Drop = { x: number; z: number; y: number; type: R.DropId; life: number };
type Helper = { x: number; z: number; t: number; cd: number; face: number; hop: number };
type Gadget = { x: number; z: number; hx: number; hz: number; cd: number; squash: number; vx: number; vz: number; left: number; gone: number; on: number };
type Log = { x: number; z: number; dx: number; dz: number; left: number; roll: number };
type Pumpkin = { x0: number; z0: number; x: number; z: number; tx: number; tz: number; t: number; y: number };
type Bit = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: THREE.Color };
const newGame = () => ({
  t: 0, px: 0, pz: 0, face: 0, hp: MT.maxHp(meta), maxHp: MT.maxHp(meta), inv: 0, level: 0, xp: 0, picks: 0,
  charge: Math.floor(MT.startChargeFrac(meta) * R.sweepCost(0)), kills: 0, falls: 0,
  lv: R.startLevels(), enemies: [] as Enemy[], logs: [] as Log[], pumpkins: [] as Pumpkin[], bits: [] as Bit[],
  hammerCd: 0.5, logCd: 2, pumpkinCd: 1.5, swingT: 1, swingYaw: 0, spawnCd: 0.6, shake: 0, stop: 0, ringT: 1, ringR: 1, moving: false,
  vx: 0, vz: 0, bt: 0, bonusDone: false, bonusFalls: 0, // 박치기 보너스
  swings: 0, misses: 0, sweepLock: 0, helperUsed: false,
  gadgets: [] as Gadget[], weather: '' as R.Weather | '', wt: 0, wx: 0, wz: 0, weatherDone: false,
  opened: 0, slams: 0, done: [] as string[], bestChain: 0, // 미션(결정 060)·베스트 컷
  bossSpawned: false, bossDown: false, endIn: 0, extra: 0, strikes: 0, juggles: 0, // 왕좀비·STRIKE·저글(결정 057·058)
  drops: [] as Drop[], dropCd: R.FIRST_DROP as number, golden: 0, helper: null as Helper | null,
  isl: stage().r, chain: 0, chainT: 0, // 이어서 떨어뜨린 수와 남은 시간
});
let g = newGame();
let mode: 'title' | 'play' | 'bonusIntro' | 'bonus' | 'pick' | 'over' = 'title';
const eScale = (e: Enemy) => (e.kind === 'boss' ? R.BOSS_SCALE : e.big ? 1.5 : 1);
const eRadius = (e: Enemy) => 0.45 * eScale(e);
function resetIsland() {
  const r = stage().r, k = r / R.ISLAND_R;
  islandVis = r;
  for (const p of props) { p.x = p.bx * k; p.z = p.bz * k; p.y = p.vy = 0; place(p); }
  flowerAt.forEach(([x, z], i) => put(flowers, i, x * k, 0.08, z * k));
  flowers.instanceMatrix.needsUpdate = true;
}

// ───────── 입력: 화면 어디든 누른 자리가 조이스틱 원점 ─────────
let joyId = -1, jox = 0, joy = 0, jx = 0, jz = 0, jdx = 0, jdy = 0;
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
  jdx = dx;
  jdy = dy;
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
  jx = jz = jdx = jdy = 0;
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
  const st = stage(), big = Math.random() < Math.min(0.6, R.bigChance(g.t) * st.big), d = g.isl - 0.8, kind = R.pickKind(g.t, big);
  g.enemies.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 0, vy: 0, kx: 0, kz: 0, hp: R.enemyHp(g.t, big) * st.hp * R.KIND_HP[kind], big, out: false, flash: 0, hop: rnd(0, 6), age: 0, bladeCd: 0, kind });
}

function burst(x: number, z: number, color: THREE.Color, n: number) {
  for (let i = 0; i < n && g.bits.length < 256; i++)
    g.bits.push({ x, y: 0.4, z, vx: rnd(-4, 4), vy: rnd(3, 8), vz: rnd(-4, 4), life: rnd(0.35, 0.6), color });
}

let lastPop = 0, combo = 0;
function reward(charge: number) {
  g.kills++;
  const he = MT.healEvery(meta);
  if (he && g.kills % he === 0) g.hp = Math.min(g.maxHp, g.hp + 1); // 흡혈귀
  if (g.sweepLock <= 0) g.charge = Math.min(R.sweepCost(g.lv.sweep), g.charge + charge);
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
function hit(i: number, dmg: number, kx: number, kz: number, byHammer = false) {
  const e = g.enemies[i];
  if (e.kind === 'shield' && byHammer) { dmg *= R.SHIELD_BLOCK; kx *= R.SHIELD_BLOCK; kz *= R.SHIELD_BLOCK; } // 정면 망치는 방패가 막는다
  e.hp -= dmg;
  e.flash = 0.1;
  sfx.bonk();
  let km = R.knockMul(g.lv.knock) * MT.shoveMul(meta) * R.KIND_KNOCK[e.kind] * (e.kind === 'boss' && e.age < 2.5 ? 0 : 1); // 왕좀비는 등장 2.5초 동안 안 밀림
  if (e.y > 0.3 && e.kind !== 'boss') { // 공중에 뜬 적을 또 치면 더 세게
    km *= R.JUGGLE_KNOCK;
    g.juggles++;
    toast(L('공중 콤보!', 'Air combo!'));
  }
  e.kx += kx * km;
  e.kz += kz * km;
  if (e.kind !== 'boss' && Math.hypot(kx, kz) * km > 7 && e.y <= 0.01) e.vy = 4.5; // 세게 맞으면 살짝 떠오른다
  if (e.hp > 0) return;
  if (e.kind === 'bomb') blast(e.x, e.z);
  reward(R.KILL_CHARGE);
  gainXp(R.killXp(e.big));
  burst(e.x, e.z, e.big ? C_BIG : C_SMALL, e.big ? 12 : 6);
  drop(i);
}

/** 폭탄 해골이 터짐: 둘레를 밀어낸다(연쇄 낙하) */
function blast(x: number, z: number) {
  for (const o of g.enemies) {
    const dx = o.x - x, dz = o.z - z, d = Math.hypot(dx, dz) || 1;
    if (o.out || d > R.BOMB_RADIUS) continue;
    const k = R.BOMB_KNOCK * (1 - d / R.BOMB_RADIUS * 0.5) * R.KIND_KNOCK[o.kind];
    o.kx += (dx / d) * k;
    o.kz += (dz / d) * k;
    o.flash = 0.1;
  }
  burst(x, z, C_PUMPKIN, 14);
  g.ringT = 0.3;
  g.ringR = R.BOMB_RADIUS;
  ring.position.set(x, 0.06, z);
  ringAtHero = false;
  g.shake = Math.max(g.shake, 0.35);
  sfx.squish();
}
function spawnBoss() {
  g.bossSpawned = true;
  const a = Math.atan2(g.pz, g.px) + Math.PI, d = g.isl * 0.45; // 주인공 반대편, 섬 안쪽에서(가장자리에서 나오면 바로 휩쓸려 떨어졌다)
  g.enemies.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 0, vy: 0, kx: 0, kz: 0, hp: Infinity, big: true, out: false, flash: 0, hop: 0, age: 0, bladeCd: 0, kind: 'boss' });
  toast(L('왕좀비 등장! 밀어서 떨어뜨려라', 'King zombie! Knock it off!'));
  sfx.rumble();
  g.shake = 0.8;
}

let lastFallSfx = 0;
function fall(e: Enemy, byCrumble = false) {
  e.out = true;
  e.vy = 4; // 살짝 튀었다가 떨어진다
  g.falls++;
  if (mode === 'bonus') g.bonusFalls++;
  g.chain = g.chainT > 0 ? g.chain + 1 : 1;
  g.chainT = 1.2;
  if (g.chain >= 3 && g.chain > g.bestChain && performance.now() - lastShotAt > 300) { g.bestChain = g.chain; wantShot = true; }
  if (g.chain === R.STRIKE_CHAIN) { g.extra += R.STRIKE_COINS; g.strikes++; sfx.fanfare(); }
  if (e.kind === 'bomb') blast(e.x, e.z);
  if (e.kind === 'boss' && !g.bossDown) { // 왕좀비를 떨어뜨리면 그 자리에서 클리어
    g.bossDown = true;
    g.extra += R.bossCoins(stageIdx);
    g.endIn = 1.8;
    g.stop = 0.45;
    g.shake = 1.2;
    toast(L('왕좀비를 떨어뜨렸다!', 'King zombie down!'));
    sfx.fanfare();
    sfx.rumble();
  }
  reward(byCrumble ? 0 : R.FALL_CHARGE); // 무너짐으로 한꺼번에 떨어진 적은 게이지를 채우지 않는다
  gainXp(byCrumble ? R.killXp(e.big) : R.fallXp(e.big));
  const now = performance.now();
  if (now - lastFallSfx > 70) {
    lastFallSfx = now;
    sfx.fall();
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
  for (const e of g.enemies) if (!e.out && e.kind !== 'boss' && Math.hypot(e.x, e.z) > r) fall(e, true); // 왕좀비는 무너짐에 휩쓸리지 않는다 // 무너진 땅 위의 적은 같이 떨어진다
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

function hurt(dmg: number) {
  g.hp = Math.max(0, g.hp - dmg);
  g.inv = R.HURT_INV;
  g.shake = 0.6;
  sfx.clang();
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
  g.sweepLock = R.SWEEP_LOCK;
  g.slams++;
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
  sfx.swish(true);
  sfx.squish(0.6);
  sfx.buzz(30);
}

// ───────── 박치기 보너스(판 중간 미니게임) ─────────
function dash(dx: number, dy: number) {
  const len = Math.hypot(dx, dy), sp = R.dashSpeed(len);
  if (!sp) return;
  g.vx = (dx / len) * sp;
  g.vz = (dy / len) * sp;
  sfx.swish();
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
      g.enemies.push({ x, z, y: 0, vy: 0, kx: 0, kz: 0, hp: 1e9, big: false, out: false, flash: 0, hop: rnd(0, 6), age: 0, bladeCd: 0, kind: '' });
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
  sfx.fanfare();
  // 처음 보는 규칙이라 시간을 멈추고 할 일을 먼저 보여 준다(사용자: "뭘 어쩌라는 건지 모르다가 끝났다")
  mode = 'bonusIntro';
  show(
    `<h2 class="big-title" style="font-size:34px">${L('보너스 판!', 'Bonus round!')}</h2>` +
      `<div class="panel bonus-how">` +
      `<svg viewBox="0 0 200 110" aria-hidden="true"><circle cx="40" cy="60" r="14" fill="#f08a2a"/>` +
      `<path d="M58 60 H150" stroke="#ffb84d" stroke-width="8" stroke-linecap="round" stroke-dasharray="2 14"/><path d="M146 44 L170 60 L146 76 Z" fill="#ffb84d"/>` +
      `<g class="finger"><circle cx="60" cy="88" r="9" fill="#ffffff" stroke="#2f3a4a" stroke-width="3"/></g></svg>` +
      `<p><b>1</b> ${L('화면을 누른 채 가고 싶은 쪽으로 끌고', 'Press and drag toward where you want to go')}</p>` +
      `<p><b>2</b> ${L('손을 놓으면 그쪽으로 몸통 돌진!', 'Release to dash that way!')}</p>` +
      `<p><b>3</b> ${L(`해골을 섬 밖으로 날리면 한 마리당 ${R.BONUS_COIN}코인`, `${R.BONUS_COIN} coins per skeleton knocked off`)}</p>` +
      `</div><button class="go" data-act="bonusGo">${L(`시작! (${R.BONUS_SECONDS}초)`, `Go! (${R.BONUS_SECONDS}s)`)}</button>`,
  );
}
function endBonus() {
  for (const e of g.enemies) if (!e.out) { e.out = true; e.vy = 6; }
  g.bonusDone = true;
  sfx.setMusicFast(false);
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
  const gold = g.golden > 0, rad = R.hammerRadius(g.lv.hammer) + (gold ? 1.2 : 0);
  // 실제로 맞는 거리(망치 길이 + 적 몸)에 들어왔을 때만 휘두른다. 예전엔 조금 먼 적에도 헛스윙하고 쿨다운을 통째로 기다렸다
  const near = g.hammerCd <= 0 ? nearest(rad + 0.7) : null;
  const target = near && Math.hypot(near.x - g.px, near.z - g.pz) <= rad + eRadius(near) ? near : null;
  if (target) {
    g.hammerCd = R.hammerCooldown(g.lv.hammer) * (gold ? 0.35 : 1);
    const yaw = Math.atan2(target.x - g.px, target.z - g.pz), half = R.hammerArc(g.lv.hammer) / 2;
    let hits = 0;
    for (let i = es.length - 1; i >= 0; i--) {
      const e = es[i], dx = e.x - g.px, dz = e.z - g.pz, d = Math.hypot(dx, dz) || 1;
      let da = Math.atan2(dx, dz) - yaw;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (e.out || d > rad + eRadius(e) || Math.abs(da) > half) continue;
      hit(i, gold ? 24 : 14, (dx / d) * (gold ? 12 : 9), (dz / d) * (gold ? 12 : 9), true);
      hits++;
    }
    g.swingT = 0;
    g.swingYaw = yaw;
    if (stage().gadget === 'barrel')
      for (const b of g.gadgets) { // 휘두른 부채꼴 안의 통은 굴러간다
        const dx = b.x - g.px, dz = b.z - g.pz, d = Math.hypot(dx, dz) || 1;
        let da = Math.atan2(dx, dz) - yaw;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (b.gone > 0 || b.left > 0 || d > rad + 0.5 || Math.abs(da) > half) continue;
        b.vx = (dx / d) * R.BARREL_SPEED;
        b.vz = (dz / d) * R.BARREL_SPEED;
        b.left = R.BARREL_RANGE;
        sfx.whack();
      }
    g.face = yaw;
    g.swings++;
    if (!hits) { g.misses++; g.hammerCd = 0.2; } // 헛치면 금방 다시 휘두른다
    hits ? sfx.whack() : sfx.swish();
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
      sfx.creak();
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
    sfx.squish();
  }
}

const DROP_NAME: Record<R.DropId, string> = {
  heart: L('회복!', 'Heal!'), charge: L('쾅! 충전!', 'Slam charged!'), golden: L('황금 망치!', 'Golden mallet!'), helper: L('묘지기가 도와줍니다!', 'The keeper joins you!'),
};
function openDrop(d: Drop) {
  g.opened++;
  if (d.type === 'heart') g.hp = Math.min(g.maxHp, g.hp + R.HEAL);
  else if (d.type === 'charge') g.charge = R.sweepCost(g.lv.sweep);
  else if (d.type === 'golden') g.golden = R.GOLDEN_SECONDS;
  else g.helper = { x: g.px + 1.2, z: g.pz, t: R.HELPER_SECONDS, cd: 0.4, face: 0, hop: 0 };
  burst(d.x, d.z, new THREE.Color(DROP_COLOR[d.type]), 14);
  toast(DROP_NAME[d.type]);
  sfx.coins();
  sfx.chime();
  sfx.buzz(15);
}
function supplies(dt: number) {
  g.dropCd -= dt;
  if (g.dropCd <= 0 && g.drops.length < dropViews.length) {
    g.dropCd = R.DROP_INTERVAL;
    const a = rnd(0, Math.PI * 2), r = rnd(0.15, 0.65) * g.isl;
    g.drops.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: 12, type: R.pickDrop(g.hp >= g.maxHp, Math.random, g.helperUsed), life: R.DROP_LIFE });
    if (g.drops[g.drops.length - 1].type === 'helper') g.helperUsed = true;
  }
  for (let k = g.drops.length - 1; k >= 0; k--) {
    const d = g.drops[k];
    if (d.y > 0) {
      d.y = Math.max(0, d.y - (12 / R.DROP_FALL) * dt);
      if (d.y === 0) sfx.squish(0.7);
      continue;
    }
    d.life -= dt;
    const gone = d.life <= 0 || Math.hypot(d.x, d.z) > g.isl;
    if (!gone && Math.hypot(d.x - g.px, d.z - g.pz) < 1.1) openDrop(d);
    if (gone || Math.hypot(d.x - g.px, d.z - g.pz) < 1.1) g.drops.splice(k, 1);
  }
  g.golden -= dt;
  // 도우미: 가까운 적에게 달려가 둘레를 밀어낸다
  const h = g.helper;
  if (!h) return;
  if ((h.t -= dt) <= 0) {
    burst(h.x, h.z, new THREE.Color(0xffffff), 10);
    g.helper = null;
    return;
  }
  let tgt: Enemy | null = null, bd = 99;
  for (const e of g.enemies) {
    const dd = Math.hypot(e.x - h.x, e.z - h.z);
    if (!e.out && dd < bd) { bd = dd; tgt = e; }
  }
  const gx = tgt ? tgt.x : g.px + 1.2, gz = tgt ? tgt.z : g.pz, dx = gx - h.x, dz = gz - h.z, dist = Math.hypot(dx, dz) || 1;
  if (dist > 1.1) {
    h.x += (dx / dist) * 6.5 * dt;
    h.z += (dz / dist) * 6.5 * dt;
    h.face = Math.atan2(dx, dz);
    h.hop += dt * 12;
  }
  const lim = g.isl - 0.7, hd = Math.hypot(h.x, h.z);
  if (hd > lim) { h.x *= lim / hd; h.z *= lim / hd; }
  h.cd -= dt;
  if (tgt && bd < 1.5 && h.cd <= 0) {
    h.cd = 0.8;
    for (let i = g.enemies.length - 1; i >= 0; i--) {
      const e = g.enemies[i], ex = e.x - h.x, ez = e.z - h.z, ed = Math.hypot(ex, ez) || 1;
      if (!e.out && ed < 1.7 + eRadius(e)) hit(i, 8, (ex / ed) * 10, (ez / ed) * 10);
    }
    sfx.whack();
  }
}

function gadgets(dt: number) {
  const kind = stage().gadget;
  for (const b of g.gadgets) {
    b.squash = Math.max(0, b.squash - dt * 4);
    b.cd -= dt;
    if (kind === 'spring') {
      if (b.cd > 0) continue;
      for (const e of g.enemies) { // 밟은 적을 섬 바깥쪽으로 튕겨 낸다
        if (e.out || e.kind === 'boss' || Math.hypot(e.x - b.x, e.z - b.z) > 0.75) continue;
        const d = Math.hypot(e.x, e.z) || 1;
        e.kx += (e.x / d) * R.SPRING_LAUNCH;
        e.kz += (e.z / d) * R.SPRING_LAUNCH;
        e.vy = 7;
        b.cd = R.SPRING_CD;
        b.squash = 1;
        sfx.pop();
        break;
      }
    } else if (kind === 'barrel') {
      if (b.gone > 0) {
        if ((b.gone -= dt) <= 0) { b.x = b.hx; b.z = b.hz; b.squash = 1; }
        continue;
      }
      if (b.left <= 0) continue;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.left -= R.BARREL_SPEED * dt;
      const touch = g.enemies.some((e) => !e.out && Math.hypot(e.x - b.x, e.z - b.z) < 0.5 + eRadius(e));
      if (touch || b.left <= 0 || Math.hypot(b.x, b.z) > g.isl) {
        blast(b.x, b.z);
        b.left = 0;
        b.gone = R.BARREL_RESPAWN;
      }
    } else {
      b.on -= dt;
      if (b.cd <= 0) { b.cd = R.LANTERN_EVERY; b.on = R.LANTERN_ON; }
      if (b.on <= 0) continue;
      for (const e of g.enemies) { // 켜진 동안 둘레의 적을 한데 끌어모은다
        const dx = b.x - e.x, dz = b.z - e.z, d = Math.hypot(dx, dz) || 1;
        if (e.out || e.kind === 'boss' || d > R.LANTERN_PULL || d < 0.6) continue;
        e.x += (dx / d) * R.LANTERN_FORCE * dt * 0.35;
        e.z += (dz / d) * R.LANTERN_FORCE * dt * 0.35;
      }
    }
  }
}
function weather(dt: number) {
  if (!g.weatherDone && g.t >= R.WEATHER_AT) {
    g.weatherDone = true;
    g.weather = Math.random() < 0.5 ? 'wind' : 'quake';
    g.wt = R.WEATHER_SECONDS;
    const a = rnd(0, Math.PI * 2);
    g.wx = Math.cos(a);
    g.wz = Math.sin(a);
    toast(g.weather === 'wind' ? L('강풍! 한쪽으로 날려 간다', 'Gale! Everything slides') : L('지진! 섬이 기운다', 'Quake! The isle tilts'));
    sfx.rumble();
  }
  if (!g.weather) return;
  if ((g.wt -= dt) <= 0) { g.weather = ''; return; }
  for (const e of g.enemies) { // 넉백으로 쌓여 바람 쪽 가장자리의 적은 떨어진다
    if (e.out || e.kind === 'boss') continue;
    e.kx += g.wx * R.WEATHER_PUSH * dt;
    e.kz += g.wz * R.WEATHER_PUSH * dt;
  }
  g.px += g.wx * 1.2 * dt; // 주인공도 살짝 밀린다
  g.pz += g.wz * 1.2 * dt;
  if (g.weather === 'quake') g.shake = Math.max(g.shake, 0.25);
}

const runStats = (): MS.RunStats => ({
  falls: g.falls, kills: g.kills, strikes: g.strikes, juggles: g.juggles, opened: g.opened, slams: g.slams,
  time: Math.floor(g.t), boss: g.bossDown ? 1 : 0, level: g.level + 1,
});
let missionCheck = 0;
function checkMissions() {
  const st = runStats();
  for (const id of meta.missions)
    if (!g.done.includes(id) && MS.isDone(id, st)) {
      g.done.push(id);
      const m = MS.missionById(id)!;
      toast(L(`미션 완료! ${m.ko}`, `Mission done! ${m.en}`));
      sfx.chime();
    }
}

function update(dt: number) {
  if ((missionCheck += dt) > 0.5 && mode === 'play') { missionCheck = 0; checkMissions(); }
  const bonus = mode === 'bonus';
  if (bonus) {
    g.bt -= dt;
    if (g.bt <= 0) return endBonus();
  } else {
    g.t += dt;
    if (g.endIn > 0 && (g.endIn -= dt) <= 0) return end(true);
    if (g.t >= R.RUN_SECONDS && !g.bossDown) return end(true);
    if (!g.bossSpawned && g.t >= R.BOSS_AT) spawnBoss();
    if (g.t >= R.BONUS_AT && !g.bonusDone) return startBonus();
  }
  g.inv -= dt;
  g.chainT -= dt;
  g.sweepLock -= dt;
  const isl = R.islandRadius(g.t, stage());
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
    const sp = R.moveSpeed(g.lv.speed) * MT.speedMul(meta);
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
    if (e.y > 0 || e.vy > 0) { // 맞아서 살짝 뜬 적(저글 기회)
      e.vy -= 22 * dt;
      e.y = Math.max(0, e.y + e.vy * dt);
      if (e.y === 0) e.vy = 0;
    }
    const dx = g.px - e.x, dz = g.pz - e.z, d = Math.hypot(dx, dz) || 1;
    const sp = bonus ? 0 : (e.kind === 'boss' ? 0.9 : R.enemySpeed(g.t, e.big) * (e.kind === 'balloon' ? 1.15 : 1)) * stage().speed;
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
        sfx.bonk();
      }
    } else if (d < 0.35 + eRadius(e) && g.inv <= 0 && e.y < 0.3) hurt((e.kind === 'boss' ? R.BOSS_DMG : R.enemyDamage(e.big)) * stage().dmg);
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
      if (ka > 3 && ka > kb * 1.5) { const t = 0.7 * R.KIND_KNOCK[b.kind]; b.kx += a.kx * t; b.kz += a.kz * t; a.kx *= 0.55; a.kz *= 0.55; b.flash = 0.1; }
      else if (kb > 3 && kb > ka * 1.5) { const t = 0.7 * R.KIND_KNOCK[a.kind]; a.kx += b.kx * t; a.kz += b.kz * t; b.kx *= 0.55; b.kz *= 0.55; a.flash = 0.1; }
      a.x -= dx * push;
      a.z -= dz * push;
      b.x += dx * push;
      b.z += dz * push;
    }
  }

  if (!bonus) { weapons(dt); supplies(dt); gadgets(dt); weather(dt); }

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

  let ns = 0, nb = 0, nBal = 0, nBomb = 0, nSh = 0;
  bossMesh.visible = false;
  for (const e of g.enemies) {
    const yaw = Math.atan2(g.px - e.x, g.pz - e.z);
    if (e.kind === 'boss') {
      const roll = e.out ? Math.min(2.6, -e.y * 0.35 + 0.6) : 0;
      bossMesh.visible = true;
      bossMesh.position.set(e.x, e.y + Math.abs(Math.sin(now * 0.004)) * 0.15, e.z);
      bossMesh.rotation.set(-roll, yaw, 0, 'YXZ');
      bossMesh.scale.setScalar(R.BOSS_SCALE * Math.min(1, e.age * 2));
      bossBody.material = e.flash > 0 ? bossFlash : bossMat;
      continue;
    }
    const top = (e.big ? 1.05 * 1.5 : 1.05) + e.y;
    if (e.kind === 'balloon') put(balloonMesh, nBal++, e.x, top + 0.55, e.z, 0, 1, 1.15, 1);
    if (e.kind === 'bomb') put(bombMesh, nBomb++, e.x, top + 0.12, e.z, yaw);
    if (e.kind === 'shield') put(shieldMesh, nSh++, e.x + Math.sin(yaw) * 0.75, e.y + 0.75, e.z + Math.cos(yaw) * 0.75, yaw);
    const hop = e.out ? 0 : Math.abs(Math.sin(e.hop)), sc = eScale(e) * Math.min(1, e.age * 4);
    const mesh = e.big ? bigMesh : smallMesh, i = e.big ? nb++ : ns++;
    const roll = e.out ? Math.min(2.6, -e.y * 0.35 + 0.6) : 0; // 떨어질 때 뒤로 넘어가며 구른다
    put(mesh, i, e.x, e.y + hop * 0.22, e.z, Math.atan2(g.px - e.x, g.pz - e.z), sc * (1.04 - hop * 0.08), sc * (0.94 + hop * 0.12), sc * (1.04 - hop * 0.08), -roll);
    mesh.setColorAt(i, e.flash > 0 ? C_FLASH : C_PLAIN);
  }
  sync(smallMesh, ns);
  sync(bigMesh, nb);
  sync(balloonMesh, nBal);
  sync(bombMesh, nBomb);
  sync(shieldMesh, nSh);
  dropViews.forEach((v, i) => {
    const d = g.drops[i];
    v.box.visible = v.mark.visible = !!d;
    if (!d) return;
    const blink = d.y <= 0 && d.life < 3 && Math.floor(now / 120) % 2 === 0;
    v.box.visible = !blink;
    v.box.position.set(d.x + (d.y > 0 ? Math.sin(now * 0.004 + i) * 0.3 : 0), d.y + (d.y <= 0 ? Math.abs(Math.sin(now * 0.006)) * 0.12 : 0), d.z);
    v.box.rotation.z = d.y > 0 ? Math.sin(now * 0.003 + i) * 0.15 : 0;
    v.canopy.visible = v.lines.visible = d.y > 0;
    (v.canopy.material as THREE.MeshLambertMaterial).color.setHex(DROP_COLOR[d.type]);
    (v.band.material as THREE.MeshLambertMaterial).color.setHex(DROP_COLOR[d.type]);
    v.mark.position.set(d.x, 0.04, d.z);
    const mm = v.mark.material as THREE.MeshBasicMaterial;
    mm.color.setHex(DROP_COLOR[d.type]);
    mm.opacity = 0.45 + 0.35 * Math.sin(now * 0.008);
  });
  // 보너스 중 끌고 있으면 돌진 방향·세기를 바닥에 보여 준다(화면 아래 = +z)
  const pull = Math.hypot(jdx, jdy), power = R.dashSpeed(pull);
  aim.visible = mode === 'bonus' && joyId !== -1 && power > 0;
  if (aim.visible) {
    aim.position.set(g.px, 0.07, g.pz);
    aim.rotation.y = Math.atan2(jdx, jdy);
    aim.scale.set(1.2, 1, 0.8 + (power / 24) * 4.2);
  }
  const h = g.helper;
  helperMesh.visible = !!h && (h.t > 2 || Math.floor(now / 110) % 2 === 0);
  if (h) {
    helperMesh.position.set(h.x, Math.abs(Math.sin(h.hop)) * 0.18, h.z);
    helperMesh.rotation.y = h.face;
  }
  (swing.material as THREE.MeshBasicMaterial).color.setHex(g.golden > 0 ? 0xffd23f : 0xfff3c4);
  hammerMat.color.setHex(g.golden > 0 ? 0xffd23f : 0x9aa3b0);
  const sw = Math.min(1, g.swingT * 1.6), swinging = sw < 1;
  const half = R.hammerArc(g.lv.hammer) / 2 + 0.3;
  const ha = swinging ? g.swingYaw + half - 2 * half * (1 - (1 - sw) ** 2) : g.face + 2.4; // 처음 빠르게, 끝에 느리게
  hammer.visible = mode !== 'bonus';
  hammer.position.set(g.px + Math.sin(ha) * 0.25, swinging ? 0.55 : 0.75, g.pz + Math.cos(ha) * 0.25);
  hammer.rotation.set(swinging ? 0.25 : -0.9, ha, 0, 'YXZ');
  hammer.scale.setScalar((g.golden > 0 ? 1.35 : 1) * (0.9 + 0.08 * g.lv.hammer));
  const gk = stage().gadget, inPlay = mode !== 'title' && mode !== 'over';
  let nSp = 0, nBa = 0, nLa = 0, nRing = 0;
  if (inPlay)
    g.gadgets.forEach((b) => {
      if (gk === 'spring') put(springMesh, nSp++, b.x, 0, b.z, 0, 1 + b.squash * 0.25, 1 - b.squash * 0.45, 1 + b.squash * 0.25);
      else if (gk === 'barrel') {
        if (b.gone > 0) return;
        const roll = b.left > 0 ? (R.BARREL_RANGE - b.left) / 0.4 : 0;
        put(barrelMesh, nBa++, b.x, 0, b.z, Math.atan2(b.vx, b.vz) || 0, 1 + b.squash * 0.2, 1, 1, roll ? Math.PI / 2 + roll : 0);
      } else {
        put(lanternMesh, nLa++, b.x, 0, b.z, now * 0.001);
        if (b.on > 0) {
          const k = 1 - b.on / R.LANTERN_ON;
          put(pullRing, nRing++, b.x, 0.05, b.z, 0, R.LANTERN_PULL * (1 - k * 0.8));
        }
      }
    });
  sync(springMesh, nSp);
  const onTitle = mode === 'title';
  const statues = onTitle ? Math.min(3, meta.bossDowns) : 0, golds = onTitle ? Math.min(8, Math.floor(meta.missionsDone / 3)) : 0;
  for (let k = 0; k < statues; k++) put(statueMesh, k, STATUE_AT[k][0], 0, STATUE_AT[k][1], 0.3 - k * 0.3, 1.9);
  for (let k = 0; k < golds; k++) put(goldPumpkinMesh, k, Math.cos(k * 0.8 + 2) * 3.6, 0, Math.sin(k * 0.8 + 2) * 3.6 - 0.5, k, 1.3);
  sync(statueMesh, statues);
  sync(goldPumpkinMesh, golds);
  sync(barrelMesh, nBa);
  sync(lanternMesh, nLa);
  sync(pullRing, nRing);
  let nStreak = 0;
  if (g.weather === 'wind')
    for (let k = 0; k < 40; k++) { // 주인공 둘레로 바람 줄무늬가 흘러간다
      const ph = ((now * 0.0011 + k * 0.137) % 1) * 24 - 12, side = ((k * 7.31) % 1) * 20 - 10;
      put(streakMesh, nStreak++, g.px + g.wx * ph - g.wz * side, 0.6 + (k % 5) * 0.4, g.pz + g.wz * ph + g.wx * side, Math.atan2(g.wx, g.wz));
    }
  sync(streakMesh, nStreak);
  g.logs.forEach((l, i) => put(logMesh, i, l.x, 0.36, l.z, Math.atan2(l.dx, l.dz), 1, 1, 1, l.roll));
  sync(logMesh, g.logs.length);
  g.pumpkins.forEach((pk, i) => put(pumpkinMesh, i, pk.x, pk.y, pk.z, pk.t * 9, 1.1));
  sync(pumpkinMesh, g.pumpkins.length);
  g.swingT = Math.min(1, g.swingT + dt * 6);
  swing.visible = g.swingT < 1;
  if (swing.visible) {
    const arc = R.hammerArc(g.lv.hammer);
    if (arc !== swingArc) { // 부채꼴은 +z(주인공이 보는 쪽) 가운데로 만든다. 눕히면 xy평면의 -90°가 +z가 된다
      swing.geometry.dispose();
      swing.geometry = new THREE.RingGeometry(0.4, 1, 24, 1, -Math.PI / 2 - arc / 2, arc).rotateX(-Math.PI / 2);
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
  const warn = mode === 'play' ? R.crumbleWarning(g.t, stage()) : -1;
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
  log: [L('굴러가는 통나무', 'Rolling log'), L('통나무가 섬을 가로질러 적을 밀어냅니다', 'A log rolls across the isle, bowling foes over'), '#a0703f'],
  pumpkin: [L('호박 폭탄', 'Pumpkin bomb'), L('던진 호박이 터지며 둥글게 밀어냅니다', 'Thrown pumpkins burst and push foes away'), '#f08a2a'],
  sweep: [L('내려찍기', 'Ground slam'), L('쾅!이 더 넓게 퍼지고 더 빨리 찹니다', 'Wider slam, charges faster'), '#ff8a4c'],
  knock: [L('밀치기', 'Shove'), L('모든 공격이 적을 더 멀리 밀어냅니다', 'Every hit knocks enemies farther'), '#b06ee8'],
  speed: [L('가벼운 신발', 'Light boots'), L('더 빨리 움직입니다', 'Move faster'), '#3fc1a5'],
  heart: [L('회복', 'Heal'), L(`체력을 ${R.HEAL} 채웁니다`, `Restore ${R.HEAL} HP`), '#ff5a6e'],
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
  sfx.fanfare();
  const cards = picks.map((id) => {
    const [name, desc, c] = UPS[id], lv = id === 'heart' ? 0 : g.lv[id];
    const tag = id === 'heart' ? '' : lv ? `<em>Lv ${lv} → ${lv + 1}</em>` : `<em class="new">NEW</em>`;
    return `<button class="card" data-id="${id}" style="--c:${c}"><div class="ico">${svg(ICON[id])}</div><b>${name}</b>${tag}<span>${desc}</span></button>`;
  });
  show(`<h2 class="big-title" style="font-size:34px">${L('레벨 업!', 'Level up!')}</h2><p class="tag">${L('하나를 고르세요', 'Pick one')}</p><div class="cards">${cards.join('')}</div>`);
}
const PERK_UI: Record<MT.Perk, [string, string, string, string]> = {
  vigor: [L('튼튼한 몸', 'Sturdy'), L('최대 체력 +20', 'Max HP +20'), '#ff5a6e', ICON.heart],
  shove: [L('묵직한 손', 'Heavy hands'), L('모든 넉백 +12%', 'All knockback +12%'), '#b06ee8', ICON.knock],
  charge: [L('미리 충전', 'Head start'), L('쾅! 게이지 15%를 채우고 시작', 'Start with 15% Slam charge'), '#ff8a4c', ICON.sweep],
  wisdom: [L('지혜', 'Wisdom'), L('경험치 +10%', 'XP +10%'), '#35b9ab', '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'],
};
const coinPill = () => `<div class="coins"><i></i>${meta.coins.toLocaleString()}</div>`;
const stageName = (i: number) => L(...R.STAGES[i].name);

function placeGadgets() {
  g.gadgets = [];
  for (let k = 0; k < R.GADGET_COUNT; k++) { // 120도씩 벌려 놓는다
    const a = (k / R.GADGET_COUNT) * Math.PI * 2 + rnd(-0.4, 0.4), r = stage().r * rnd(0.38, 0.6);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    g.gadgets.push({ x, z, hx: x, hz: z, cd: 0, squash: 0, vx: 0, vz: 0, left: 0, gone: 0, on: 0 });
  }
}
// 오늘의 섬(결정 062): 그날의 씨앗으로 Math.random을 잠시 바꿔 적·상자·날씨를 모두 같게. 끝나면 되돌린다
const realRandom = Math.random;
let dailyRun = false, stageBeforeDaily = 0;
const today = () => R.dayNumber(Date.now());
const loadDaily = (): { day: number; best: number; cleared: boolean } => {
  try {
    const d = JSON.parse(store.get('daily') ?? '{}');
    return d.day === today() ? { day: d.day, best: +d.best || 0, cleared: !!d.cleared } : { day: today(), best: 0, cleared: false };
  } catch { return { day: today(), best: 0, cleared: false }; }
};
function startDaily() {
  stageBeforeDaily = stageIdx;
  stageIdx = R.dailyStage(today());
  applyStage();
  Math.random = R.seeded(today() * 7919);
  dailyRun = true;
  startRun();
}
// 베스트 컷(결정 062): 한 판에서 가장 크게 이어 떨어뜨린 순간을 그린 직후 찍어 둔다(글자 없이 게임 화면만)
let bestShot = '', wantShot = false, lastShotAt = 0;
/** 그린 직후에만 부른다(화면 버퍼가 지워지기 전) */
function captureShot() {
  if (!wantShot) return;
  wantShot = false;
  lastShotAt = performance.now();
  bestShot = renderer.domElement.toDataURL('image/jpeg', 0.75);
}
function startRun() {
  bestShot = '';
  resetInput();
  sfx.setMusicFast(false);
  g = newGame();
  camTarget.set(0, 0, 0);
  resetIsland();
  placeGadgets();
  shown.hp = -1;
  overlay.hidden = true;
  mode = 'play';
  g.inv = 0.6;
  toast(L(`${clock(R.RUN_SECONDS)} 버티기!`, `Survive ${clock(R.RUN_SECONDS)}!`));
}
/** 미션 목록: 달성한 것은 체크 표시와 함께 */
function missionList(ids: readonly string[], done: readonly string[] = []) {
  const rows = ids.map((id) => {
    const m = MS.missionById(id)!, ok = done.includes(id);
    return `<li class="${ok ? 'ok' : ''}"><i></i>${L(m.ko, m.en)}<b>+${m.coins}</b></li>`;
  });
  return `<ul class="missions">${rows.join('')}</ul>`;
}
async function shareShot() {
  if (!bestShot) return;
  const file = new File([await (await fetch(bestShot)).blob()], 'tumble-isle.jpg', { type: 'image/jpeg' });
  const text = L(`망치섬에서 한 번에 ${g.bestChain}마리 떨어뜨렸다!`, `Knocked off ${g.bestChain} in one go on Tumble Isle!`);
  try {
    if (navigator.canShare?.({ files: [file] })) return void (await navigator.share({ files: [file], text }));
  } catch { return; } // 사용자가 공유 창을 닫음
  const a = document.createElement('a'); // 공유를 못 하는 곳에서는 그림을 내려받는다
  a.href = bestShot;
  a.download = file.name;
  a.click();
}
function showTitle() {
  mode = 'title';
  applyStage();
  resetIsland();
  const locked = stageIdx > meta.cleared;
  show(
    `<div class="top">${coinPill()}<h1 class="big-title">${L('망치섬', 'Tumble<br>Isle')}</h1><p class="tag">${L('망치로 쳐서 섬 밖으로 날려 버리세요', 'Bonk the horde off your tiny island')}</p></div>` +
      `<div style="display:grid;gap:12px;justify-items:center;width:100%">` +
      `<div class="stage"><button data-act="prev" ${stageIdx ? '' : 'disabled'} aria-label="${L('이전 섬', 'Previous isle')}">‹</button>` +
      `<div><small>${L('섬', 'Isle')} ${stageIdx + 1} / ${R.STAGES.length}</small><b>${locked ? '🔒 ' : ''}${stageName(stageIdx)}</b></div>` +
      `<button data-act="next" ${stageIdx < R.STAGES.length - 1 ? '' : 'disabled'} aria-label="${L('다음 섬', 'Next isle')}">›</button></div>` +
      (locked ? `<p class="best">${L(`${stageName(stageIdx - 1)}을 지키면 열립니다`, `Defend ${stageName(stageIdx - 1)} to unlock`)}</p>` : bestLine()) +
      `<div class="goal"><i></i>${L(`${clock(R.RUN_SECONDS)} 버티면 섬을 지킨다`, `Survive ${clock(R.RUN_SECONDS)} to save the isle`)}</div>` +
      missionList(meta.missions) +
      `<button class="go" data-act="start" ${locked ? 'disabled' : ''}>${L('시작', 'Start')}</button>` +
      `<button class="sub daily" data-act="daily">${L('오늘의 섬', "Today's isle")} · ${stageName(R.dailyStage(today()))}${loadDaily().best ? L(` · 최고 ${loadDaily().best}마리`, ` · best ${loadDaily().best}`) : ''}</button>` +
      `<div class="row"><button class="sub" data-act="shop">${L('상점', 'Shop')}</button>` +
      `<button class="sub" data-act="music" aria-pressed="${sfx.isMusicOn()}">${sfx.isMusicOn() ? L('♪ 음악 켬', '♪ Music on') : L('♪ 음악 끔', '♪ Music off')}</button></div></div>`,
    'title',
  );
}
const CHAR_UI: Record<MT.CharId, [string, string]> = {
  human: [L('모험가', 'Adventurer'), L('기본', 'Basic')],
  orc: [L('오크', 'Orc'), L('최대 체력 +20', 'Max HP +20')],
  keeper: [L('묘지기', 'Keeper'), L('넉백 +15%', 'Knockback +15%')],
  vampire: [L('흡혈귀', 'Vampire'), L('4마리마다 체력 +1', '+1 HP per 4 KOs')],
  ghost: [L('유령', 'Ghost'), L('이동 속도 +12%', 'Move speed +12%')],
};
let capsuleNote = '';
function showShop() {
  mode = 'title';
  const cards = MT.PERKS.map((id) => {
    const [name, desc, c, ico] = PERK_UI[id], lv = meta.perks[id], max = MT.PERK_MAX[id], cost = MT.perkCost(id, lv);
    const btn = lv >= max ? `<button class="buy" disabled>MAX</button>` : `<button class="buy" data-act="buy" data-perk="${id}" ${meta.coins < cost ? 'disabled' : ''}><i></i>${cost}</button>`;
    return `<div class="card perk" style="--c:${c}"><div class="ico">${svg(ico)}</div><b>${name}</b><em>${'●'.repeat(lv)}${'○'.repeat(max - lv)}</em><span>${desc}</span>${btn}</div>`;
  });
  const chars = MT.CHARS.map((c) => {
    const [name, perk] = CHAR_UI[c], own = meta.chars.includes(c), on = meta.hero === c;
    return `<button class="char ${on ? 'on' : ''}" data-act="hero" data-char="${c}" ${own ? '' : 'disabled'}><b>${own ? name : '???'}</b><small>${own ? perk : L('캡슐에서', 'From capsules')}</small></button>`;
  });
  show(
    `<h2 class="big-title" style="font-size:30px">${L('상점', 'Shop')}</h2>${coinPill()}` +
      `<div class="capsule"><button class="buy" data-act="capsule" ${meta.coins < MT.CAPSULE_COST ? 'disabled' : ''}><i></i>${MT.CAPSULE_COST} ${L('캡슐 돌리기', 'Spin capsule')}</button>${capsuleNote}</div>` +
      `<div class="chars">${chars.join('')}</div><div class="cards">${cards.join('')}</div><button class="sub" data-act="title">${L('돌아가기', 'Back')}</button>`,
    'shop',
  );
  capsuleNote = '';
}
overlay.addEventListener('click', (ev) => {
  const btn = (ev.target as HTMLElement).closest('button');
  if (!btn || btn.disabled) return;
  sfx.unlockAudio();
  sfx.tap();
  const act = btn.dataset.act, id = btn.dataset.id as R.UpgradeId | 'heart' | undefined;
  if (act === 'start') return startRun();
  if (act === 'daily') return startDaily();
  if (act === 'share') return void shareShot();
  if (act === 'bonusGo') {
    overlay.hidden = true;
    mode = 'bonus';
    sfx.setMusicFast(true);
    return;
  }
  if (act === 'shop') return showShop();
  if (act === 'music') {
    sfx.toggleMusic();
    return showTitle();
  }
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
  if (act === 'capsule') {
    const r = MT.rollCapsule(meta);
    if (r) {
      meta = r.meta;
      saveMeta();
      capsuleNote = `<p class="capsule-note">${r.dup ? L(`이미 있는 ${CHAR_UI[r.got][0]} · +${MT.CAPSULE_REFUND} 코인`, `Duplicate ${CHAR_UI[r.got][0]} · +${MT.CAPSULE_REFUND} coins`) : L(`새 캐릭터: ${CHAR_UI[r.got][0]}!`, `New: ${CHAR_UI[r.got][0]}!`)}</p>`;
      r.dup ? sfx.coins() : sfx.fanfare();
    }
    return showShop();
  }
  if (act === 'hero') {
    meta = { ...meta, hero: btn.dataset.char as MT.CharId };
    saveMeta();
    setHero(meta.hero);
    return showShop();
  }
  if (act === 'buy') {
    const next = MT.buy(meta, btn.dataset.perk as MT.Perk);
    if (next) { meta = next; saveMeta(); sfx.coins(); }
    return showShop();
  }
  if (!id) return;
  if (id === 'heart') g.hp = Math.min(g.maxHp, g.hp + R.HEAL);
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
  const isBest = !dailyRun && (score.time > best.time || (score.time === best.time && score.kills > best.kills));
  if (isBest) store.set(`best-${stageIdx}`, JSON.stringify(score));
  let dailyNote = '';
  if (dailyRun) {
    Math.random = realRandom;
    dailyRun = false;
    const d = loadDaily(), firstClear = win && !d.cleared;
    store.set('daily', JSON.stringify({ day: d.day, best: Math.max(d.best, g.falls), cleared: d.cleared || win }));
    if (firstClear) g.extra += R.DAILY_COINS;
    dailyNote = `<span class="badge">${L('오늘의 섬', "Today's isle")}${firstClear ? ` +${R.DAILY_COINS}` : ''}${g.falls > d.best ? L(' · 오늘 최고!', ' · Today best!') : ''}</span>`;
    stageIdx = stageBeforeDaily; // 오늘의 섬은 섬 해금·기록과 따로 간다
  }
  checkMissions();
  const doneMs = g.done.map((id) => MS.missionById(id)!);
  const missionCoins = doneMs.reduce((a, m) => a + m.coins, 0);
  const coins = MT.coinsFor(g.kills, g.falls, win, stageIdx) + g.bonusFalls * R.BONUS_COIN + g.extra + missionCoins;
  const missionsNow = meta.missions;
  const unlocked = win && !dailyNote && stageIdx === meta.cleared && stageIdx < R.STAGES.length;
  meta = {
    ...meta, coins: meta.coins + coins, cleared: unlocked ? stageIdx + 1 : meta.cleared,
    missionsDone: meta.missionsDone + g.done.length, bossDowns: meta.bossDowns + (g.bossDown ? 1 : 0),
    missions: MS.fillMissions(meta.missions.filter((id) => !g.done.includes(id))), // 달성한 미션은 새 것으로
  };
  saveMeta();
  const hasNext = win && !dailyNote && stageIdx + 1 < R.STAGES.length;
  const cell = (label: string, v: string | number, hi = false) => `<div class="${hi ? 'hi' : ''}"><small>${label}</small><strong>${v}</strong></div>`;
  show(
    `<h1 class="big-title" style="font-size:36px">${g.bossDown ? L('왕좀비 격파!', 'King zombie down!') : win ? L('섬을 지켰다!', 'Isle defended!') : L('섬을 빼앗겼다', 'The isle fell')}</h1>` +
      `<div class="panel"><div class="stats">` +
      cell(L('버틴 시간', 'Survived'), clock(sec)) + cell(L('레벨', 'Level'), g.level + 1) +
      cell(L('처치', 'KOs'), g.kills) + cell(L('떨어뜨림', 'Knocked off'), g.falls, true) +
      `</div><div class="earn"><i></i>+${coins}</div>` +
      (unlocked && hasNext ? `<span class="badge">${L(`새 섬: ${stageName(stageIdx + 1)}`, `New isle: ${stageName(stageIdx + 1)}`)}</span>` : '') +
      (isBest ? `<span class="badge">${L('최고 기록!', 'New best!')}</span>` : '') +
      (g.strikes ? `<span class="badge">STRIKE ×${g.strikes}</span>` : '') + dailyNote + missionList(missionsNow, g.done) + `</div>` +
      (bestShot ? `<figure class="bestcut"><img src="${bestShot}" alt=""><figcaption><b>${L('베스트 컷', 'Best shot')}</b>${L(`낙하 ×${g.bestChain}`, `Drop ×${g.bestChain}`)}<button class="sub" data-act="share">${L('공유', 'Share')}</button></figcaption></figure>` : '') +
      (hasNext ? `<button class="go" data-act="nextIsle">${L('다음 섬으로', 'Next isle')}</button><button class="sub" data-act="start">${L('한 번 더', 'Once more')}</button>`
        : `<button class="go" data-act="start">${L('한 번 더', 'Once more')}</button>`) +
      `<div class="row"><button class="sub" data-act="shop">${L('상점', 'Shop')}</button><button class="sub" data-act="title">${L('처음으로', 'Home')}</button></div>`,
  );
}
$('sweep').querySelector('span')!.textContent = L('쾅!', 'SLAM!');

// 바뀔 때만 DOM을 고친다(매 프레임 innerHTML을 쓰면 폰에서 느려진다)
const hud = { hint: $('hint'), toast: $('toast'), warn: $('warn'), hearts: $('hearts'), time: $('time'), lvl: $('lvl'), xp: $('xp').querySelector('i')!, falls: $('falls'), sweep: $('sweep'), dev: $('dev') };
const shown = { hp: -1, left: -1, level: -1, xp: -1, falls: -1, p: -1, mode: '', warnText: '', hint: '' };
const hpFill = $('hpFill'), hpLag = $('hpLag'), hpText = $('hpText');
function drawHud() {
  if (shown.mode !== mode) document.body.dataset.mode = shown.mode = mode;
  if (shown.hp !== g.hp) { // 체력 게이지: 줄어든 만큼 흰 잔상이 남았다가 따라 줄어든다
    const pct = (g.hp / g.maxHp) * 100;
    hpFill.style.width = `${pct}%`;
    hpFill.classList.toggle('low', pct <= 30);
    hpText.textContent = `${Math.ceil(g.hp)}`;
    if (g.hp < shown.hp) {
      hud.hearts.classList.remove('hit');
      void hud.hearts.offsetWidth;
      hud.hearts.classList.add('hit');
      setTimeout(() => (hpLag.style.width = hpFill.style.width), 350);
    } else hpLag.style.width = `${pct}%`;
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
    if (g.chain >= R.STRIKE_CHAIN) toast(`STRIKE! ×${g.chain}`);
    else if (g.chain >= 2) toast(L(`낙하 ×${g.chain}!`, `Drop ×${g.chain}!`)); // 이어서 떨어뜨리면 가운데에 크게
  }
  const hint = mode === 'bonus' ? `${L('끌었다 놓으면 돌진!', 'Drag & release to dash!')} · ${L('떨어뜨림', 'Knocked')} ${g.bonusFalls} (+${g.bonusFalls * R.BONUS_COIN})` : '';
  if (shown.hint !== hint) {
    shown.hint = hint;
    hud.hint.hidden = !hint;
    hud.hint.textContent = hint;
  }
  const bossSoon = mode === 'play' && !g.bossSpawned && g.t >= R.BOSS_AT - R.BOSS_WARN;
  const warnText = bossSoon ? L('왕좀비가 온다!', 'The king zombie is coming!')
    : mode === 'play' && R.crumbleWarning(g.t, stage()) >= 0 ? L('가장자리가 무너집니다!', 'The edge is crumbling!') : '';
  if (shown.warnText !== warnText) {
    shown.warnText = warnText;
    hud.warn.hidden = !warnText;
    hud.warn.textContent = warnText;
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
  captureShot();
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
const boot = $('boot');
boot.classList.add('done');
setTimeout(() => boot.remove(), 500);

// 개발 훅: 콘솔에서 상태 확인·부하 시험(__demo.stress(300))
if (DEV)
  Object.assign(window, {
    __demo: {
      /** 촬영 모드: 연출 장면을 정해진 크기로 렌더해 docs/art/<kind>.png로 저장(개발 서버 vite.config.ts) */
      shot: async (kind: 'icon' | 'splash') => {
        const size = kind === 'icon' ? 1024 : 2732;
        stageIdx = 0;
        applyStage();
        startRun();
        mode = 'title'; // 시간을 멈춘다
        document.body.dataset.mode = 'shot';
        const sk = (x: number, z: number, big = false, out = false, y = 0) =>
          g.enemies.push({ x, z, y, vy: 0, kx: 0, kz: 0, hp: 1, big, out, flash: 0, hop: Math.random() * 6, age: 1, bladeCd: 0, kind: '' });
        g.enemies.length = 0;
        g.drops.length = 0;
        if (kind === 'icon') {
          g.golden = 1; // 금색 망치를 크게
          g.face = 1.1;
          g.swingT = 0.32;
          g.swingYaw = 1.1;
          sk(1.9, 0.9, false, true, 1.3); // 망치에 맞아 날아가는 해골
          sk(1.5, -1.2);
          sk(-1.6, -0.9, true);
        } else {
          g.face = 0.4;
          for (let k = 0; k < 14; k++) {
            const a = (k / 14) * Math.PI * 2 + 0.3, r = 2.6 + (k % 3) * 1.6;
            sk(Math.sin(a) * r, Math.cos(a) * r, k % 5 === 0);
          }
          sk(11.4, 3, false, true, -1.5);
          sk(-10.8, -4.5, false, true, -2.5);
        }
        g.inv = 0;
        draw(0, performance.now());
        const fog = scene.fog;
        scene.fog = null;
        renderer.setPixelRatio(1);
        renderer.setSize(size, size, false);
        composer.setSize(size, size);
        camera.aspect = 1;
        camera.near = 1; // 가까이 찍을 때 주인공이 잘리지 않게
        camera.updateProjectionMatrix();
        tilt.uniforms.v.value = 5 / size;
        const target = new THREE.Vector3(0, kind === 'icon' ? 0.55 : 0, 0);
        camera.position.copy(target).addScaledVector(CAM_DIR, kind === 'icon' ? 9 : 52);
        camera.lookAt(target);
        composer.render();
        const blob = await new Promise<Blob | null>((ok) => renderer.domElement.toBlob(ok, 'image/png'));
        scene.fog = fog;
        camera.near = 10;
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        resize();
        showTitle();
        if (!blob) return 'no image';
        return (await fetch(`/__shot?name=${kind}`, { method: 'POST', body: blob })).text();
      },
      get g() { return g; },
      stats: () => ({ fps, mode, aim: aim.visible, enemies: g.enemies.length, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
      stress: (n = R.MAX_ENEMIES) => { while (g.enemies.length < n) spawn(); },
      charge: () => (g.charge = 99),
      /** 밸런스 봇(결정 043·045): 망치 거리를 지키며 싸우고 상자를 줍고 공격 스킬을 고른다.
       *  sloppy(0~1)가 클수록 반응이 늦고 가끔 멈칫한다(사람형 0.6). 강화는 지금 저장된 그대로 쓴다 */
      bot: async (runs = 10, sloppy = 0.6, stageNo = 0) => {
        const out: { win: boolean; t: number; falls: number; kills: number; swings: number; misses: number; lv: number; boss: boolean; strikes: number }[] = [];
        for (let r = 0; r < runs; r++) {
          stageIdx = stageNo;
          applyStage();
          startRun();
          let lag = [0, 0];
          for (;;) {
            if (mode === 'pick') {
              const picks = [...overlay.querySelectorAll<HTMLButtonElement>('.card')];
              (picks.find((c) => c.dataset.id === 'heart' && g.hp <= g.maxHp * 0.5) ?? picks.find((c) => R.ATTACKS.includes(c.dataset.id as R.UpgradeId)) ?? picks[0]).click();
              continue;
            }
            if (mode === 'bonusIntro') { overlay.querySelector<HTMLButtonElement>('[data-act="bonusGo"]')!.click(); continue; }
            if (mode === 'bonus') { for (let i = 0; i < 30; i++) update(1 / 60); continue; }
            if (mode !== 'play') break;
            let mx = 0, mz = 0, near: Enemy | null = null, nd = 99;
            for (const e of g.enemies) {
              if (e.out) continue;
              const dx = g.px - e.x, dz = g.pz - e.z, d = Math.hypot(dx, dz);
              if (d < nd) { nd = d; near = e; }
              const avoid = e.kind === 'boss' ? 4.5 : 2.2, w = e.kind === 'boss' ? 4 : 1; // 사람은 큰 왕좀비를 멀리서부터 피한다
              if (d < avoid) { mx += (dx / (d * d)) * w; mz += (dz / (d * d)) * w; }
            }
            if (near && nd > 3) { mx -= ((g.px - near.x) / nd) * 0.3; mz -= ((g.pz - near.z) / nd) * 0.3; }
            const rr = Math.hypot(g.px, g.pz) / g.isl;
            mx -= g.px * rr * rr * 0.15;
            mz -= g.pz * rr * rr * 0.15;
            const box = g.drops.find((d) => d.y <= 0);
            if (box) { const dx = box.x - g.px, dz = box.z - g.pz, d = Math.hypot(dx, dz) || 1; mx += (dx / d) * 0.4; mz += (dz / d) * 0.4; }
            const n = Math.hypot(mx, mz);
            let dir = n > 0.01 ? [mx / n, mz / n] : [0, 0];
            dir = [lag[0] * sloppy + dir[0] * (1 - sloppy), lag[1] * sloppy + dir[1] * (1 - sloppy)];
            lag = dir;
            if (Math.random() < sloppy * 0.3) dir = [0, 0];
            if (g.charge >= R.sweepCost(g.lv.sweep) && g.enemies.filter((e) => !e.out && Math.hypot(e.x - g.px, e.z - g.pz) < 5).length >= 8) sweep();
            jx = dir[0];
            jz = dir[1];
            joyId = 99;
            for (let i = 0; i < 6 && mode === 'play'; i++) update(1 / 60);
            resetInput();
          }
          out.push({ win: g.t >= R.RUN_SECONDS - 0.1 || g.bossDown, t: g.t, falls: g.falls, kills: g.kills, swings: g.swings, misses: g.misses, lv: g.level + 1, boss: g.bossDown, strikes: g.strikes });
          await new Promise((res) => setTimeout(res, 0));
        }
        const avg = (f: (x: (typeof out)[number]) => number) => +(out.reduce((a, x) => a + f(x), 0) / runs).toFixed(2);
        showTitle();
        return { wins: `${out.filter((x) => x.win).length}/${runs}`, avgT: avg((x) => x.t), avgLv: avg((x) => x.lv), fallShare: avg((x) => x.falls / Math.max(1, x.kills)), missShare: avg((x) => x.misses / Math.max(1, x.swings)), bossDowns: out.filter((x) => x.boss).length, strikes: avg((x) => x.strikes) };
      },
      sweep,
      /** 그리기 한 번 + 베스트 컷 찍기(화면 갱신이 멈춘 미리보기에서 시험용) */
      renderOnce: () => { draw(1 / 60, performance.now()); composer.render(); captureShot(); return bestShot.length; },
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
