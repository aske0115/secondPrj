// 망치섬 / Tumble Isle(결정 032·054). 드래그로 이동, 공격은 자동, 게이지가 차면 쾅!(땅 내려찍기)으로 적을 섬 밖으로 민다(쓸어킬과 겹치지 않게 '쓸어!'에서 바꿈, 결정 056).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { App } from '@capacitor/app';
import * as CH from './game/chapters';
import { L, lang, setLang } from './i18n';
import * as sfx from './audio';
import * as ads from './ads';
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
const CAM_PULL_X = 0.8, CAM_PULL_Z = 0.7; // 카메라가 주인공을 따라가는 정도(1이면 그대로). 가로는 폰 화면이 좁아 0.7이면 동·서쪽으로 떨어지는 적이 잘려서 0.8

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
/** 우주 팩은 OBJ+MTL, 나머지는 GLB */
async function loadRoot(path: string): Promise<THREE.Object3D> {
  if (!path.startsWith('space/')) return (await model(path)).scene;
  const mtl = await new MTLLoader().loadAsync(`${import.meta.env.BASE_URL}models/${path}.mtl`);
  mtl.preload();
  return new OBJLoader().setMaterials(mtl).loadAsync(`${import.meta.env.BASE_URL}models/${path}.obj`);
}
type Baked = { geo: THREE.BufferGeometry; mat: THREE.Material };
const baked = new Map<string, Promise<Baked>>();
/** 여러 조각을 한 덩어리로 굽는다. 그림(텍스처)이 있으면 그 그림을, 없으면 조각마다의 색을 꼭짓점 색으로 */
function bake(path: string, height: number): Promise<Baked> {
  const key = `${path}|${height}`;
  if (!baked.has(key)) baked.set(key, bakeNow(path, height));
  return baked.get(key)!;
}
async function bakeNow(path: string, height: number): Promise<Baked> {
  const root = await loadRoot(path);
  root.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  let map: THREE.Texture | null = null;
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => { if (o instanceof THREE.Mesh) meshes.push(o); });
  for (const o of meshes) map ??= ((Array.isArray(o.material) ? o.material[0] : o.material) as THREE.MeshStandardMaterial).map ?? null;
  for (const o of meshes) {
    let src = o.geometry as THREE.BufferGeometry;
    if (!map && src.index) src = src.toNonIndexed(); // 조각 색을 꼭짓점마다 칠하려면 인덱스를 푼다
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', src.attributes.position);
    geo.setAttribute('normal', src.attributes.normal);
    if (map) {
      geo.setAttribute('uv', src.attributes.uv);
      geo.setIndex(src.index);
    } else {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const col = new Float32Array(src.attributes.position.count * 3), c = new THREE.Color();
      const groups = src.groups.length ? src.groups : [{ start: 0, count: src.attributes.position.count, materialIndex: 0 }];
      for (const gr of groups) {
        c.copy((mats[gr.materialIndex ?? 0] as THREE.MeshStandardMaterial).color ?? c.set(0xffffff));
        for (let v = gr.start; v < gr.start + gr.count; v++) c.toArray(col, v * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    parts.push(geo.applyMatrix4(o.matrixWorld));
  }
  return { geo: fit(mergeGeometries(parts), height), mat: map ? new THREE.MeshLambertMaterial({ map }) : new THREE.MeshLambertMaterial({ vertexColors: true }) };
}
type Prop = { m: THREE.InstancedMesh; i: number; bx: number; bz: number; x: number; z: number; yaw: number; s: number; y: number; vy: number };
const props: Prop[] = [];
function place(p: Prop) {
  put(p.m, p.i, p.x, p.y, p.z, p.yaw, p.s, p.s, p.s, p.y * -0.08);
  p.m.instanceMatrix.needsUpdate = true;
}
const onIsland = (min: number, max: number) => {
  const a = rnd(0, Math.PI * 2), d = R.ISLAND_R * rnd(min, max);
  return [Math.cos(a) * d, Math.sin(a) * d] as const;
};
function insert([x, z]: readonly [number, number], y = 0) {
  return [x, y, z] as const;
}
const [pumpkin, skel, zombie, keeper, barrel, lantern] = await Promise.all([
  bake('graveyard/pumpkin', 0.5), bake('graveyard/character-skeleton', 1.05),
  bake('graveyard/character-zombie', 1.05), bake('graveyard/character-keeper', 1.15),
  bake('dungeon/barrel', 0.8), bake('graveyard/lantern-candle', 1.3),
]);
// 장마다 바뀌는 소품(결정 067): 스테이지 번호로 정해진 무작위로 종류별 개수·자리를 정한다. 나무 같은 큰 것은 가장자리에만
let propMeshes: THREE.InstancedMesh[] = [];
async function buildProps(def: CH.StageDef) {
  const ch = CH.CHAPTERS[def.chapter], rand = R.seeded(def.seed);
  const specs = await Promise.all(ch.props.map(async (sp) => ({ sp, b: await bake(sp.m, sp.h) })));
  for (const m of propMeshes) scene.remove(m);
  propMeshes = [];
  props.length = 0;
  for (const { sp, b } of specs) {
    const n = sp.n[0] + Math.floor(rand() * (sp.n[1] - sp.n[0] + 1));
    if (!n) continue;
    const m = instanced(b.geo, b.mat, n, true);
    propMeshes.push(m);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, d = R.ISLAND_R * (sp.edge ? 0.8 + rand() * 0.17 : 0.22 + rand() * 0.66);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      props.push({ m, i, bx: x, bz: z, x, z, yaw: rand() * 6.28, s: 0.85 + rand() * 0.35, y: 0, vy: 0 });
    }
    m.count = n;
  }
}
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
// 상점·캡슐에 쓸 캐릭터 초상화: 시작 때 작은 렌더러로 한 번 찍어 그림으로 만들고 바로 버린다
const portraits = (() => {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(192, 192, false);
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, 1, 0.1, 30), sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(2, 4, 4);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x9a8f86, 2), sun);
  const out = {} as Record<MT.CharId, string>;
  for (const c of MT.CHARS) {
    const m = cloneSkinned(heroModels[c].scene);
    m.rotation.y = 0.45;
    sc.add(m);
    const box = new THREE.Box3().setFromObject(m), mid = box.getCenter(new THREE.Vector3()), h = box.getSize(new THREE.Vector3()).y;
    cam.position.set(mid.x, mid.y + h * 0.25, mid.z + h * 2.5);
    cam.lookAt(mid);
    r.render(sc, cam);
    out[c] = r.domElement.toDataURL();
    sc.remove(m);
  }
  r.dispose();
  r.forceContextLoss();
  return out;
})();
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
const small2Mesh = instanced(skel.geo, skel.mat, R.MAX_ENEMIES, true); // 작은 적이 두 종류인 장
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
  new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), R.GADGET_COUNT * R.SPRINGS_MUL, true,
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
let bossMat = new THREE.MeshLambertMaterial({ map: (zombie.mat as THREE.MeshLambertMaterial).map, color: 0xd8ffc0 });
let bossFlash = new THREE.MeshLambertMaterial({ map: (zombie.mat as THREE.MeshLambertMaterial).map, color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 });
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
let meta = MT.loadMeta(store.get('meta'), CH.STAGE_COUNT);
if (meta.coins || meta.cleared || meta.missionsDone) ads.initAds(); // 한 판이라도 해 본 사람은 켤 때 바로 광고를 준비
meta.missions = MS.fillMissions(meta.missions);
setHero(meta.hero);
const saveMeta = () => store.set('meta', JSON.stringify(meta));
// 스테이지(결정 067): stageIdx는 0~149. 나머지 코드는 예전 섬 데이터 모양(R.Stage)을 그대로 쓰도록 맞춰 만든다
let stageIdx = Math.min(meta.cleared, CH.STAGE_COUNT - 1);
const defOf = (no: number) => CH.stageDef(no, R.seeded(no * 9973 + 17));
const stageName = (no: number) => { const c = CH.CHAPTERS[Math.floor(no / CH.STAGES_PER_CHAPTER)]; return `${L(...c.name)} ${(no % CH.STAGES_PER_CHAPTER) + 1}`; };
let curDef = defOf(stageIdx);
let curStage: R.Stage = toStage(curDef);
function toStage(d: CH.StageDef): R.Stage {
  const c = CH.CHAPTERS[d.chapter], dusk = d.time === 'dusk';
  return {
    name: [stageName(d.no), stageName(d.no)], r: d.r, crumbles: d.crumbles, gadget: c.gadget,
    grass: c.grass, cliff: c.cliff, sky: dusk ? 0xf3b98f : c.sky, sun: dusk ? 0xffb07a : c.sun,
    spawn: d.spawn, big: d.big, hp: d.hp, speed: d.speed, dmg: d.dmg,
  };
}
const stage = () => curStage;
let ruleOverride: R.Rule | '' | undefined; // 개발 훅에서 규칙 켜고 끄기 비교용
const rule = () => (ruleOverride === undefined ? CH.CHAPTERS[curDef.chapter].rule : ruleOverride || undefined); // 장 규칙(결정 078)
/** 장 모델(적·소품)을 불러와 끼운다. 이미 불러온 장은 바로 */
let stageReady: Promise<void> = Promise.resolve();
function enterStage(no: number) {
  stageIdx = no;
  curDef = defOf(no);
  curStage = toStage(curDef);
  const ch = CH.CHAPTERS[curDef.chapter], d = curDef;
  stageReady = (async () => {
    const [a, b, big] = await Promise.all([bake(ch.small[0], 1.05), bake(ch.small[1] ?? ch.small[0], 1.05), bake(ch.big, 1.05), buildProps(d)]);
    if (stageIdx !== no) return; // 그 사이 다른 스테이지를 골랐다
    smallMesh.geometry = a.geo; smallMesh.material = a.mat;
    small2Mesh.geometry = b.geo; small2Mesh.material = b.mat;
    bigMesh.geometry = big.geo; bigMesh.material = big.mat;
    bossBody.geometry = big.geo;
    bossMat = (big.mat as THREE.MeshLambertMaterial).clone(); bossMat.color.set(0xd8ffc0);
    bossFlash = (big.mat as THREE.MeshLambertMaterial).clone(); bossFlash.emissive.set(0xffffff); bossFlash.emissiveIntensity = 0.6;
    applyStage();
    resetIsland();
  })();
  return stageReady;
}
function applyStage() {
  const st = stage(), night = CH.CHAPTERS[curDef.chapter].night || curDef.time === 'night';
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
type Enemy = { x: number; z: number; y: number; vy: number; kx: number; kz: number; hp: number; big: boolean; out: boolean; flash: number; hop: number; age: number; bladeCd: number; kind: R.Kind; pct?: number; stag?: number; v?: number };
type Drop = { x: number; z: number; y: number; type: R.DropId; life: number };
type Helper = { x: number; z: number; t: number; cd: number; face: number; hop: number };
type Gadget = { x: number; z: number; hx: number; hz: number; cd: number; squash: number; vx: number; vz: number; left: number; gone: number; on: number };
type Log = { x: number; z: number; dx: number; dz: number; left: number; roll: number };
type Pumpkin = { x0: number; z0: number; x: number; z: number; tx: number; tz: number; t: number; y: number };
type Bit = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: THREE.Color };
const newGame = () => ({
  t: 0, px: 0, pz: 0, face: 0, hp: MT.maxHp(meta), maxHp: MT.maxHp(meta), inv: 0, level: 0, xp: 0, picks: MT.startPicks(meta.perks.cards),
  charge: 0, kills: 0, falls: 0, rerolls: MT.rerolls(meta.perks.cards), revived: false, continued: false,
  lv: R.startLevels(), enemies: [] as Enemy[], logs: [] as Log[], pumpkins: [] as Pumpkin[], bits: [] as Bit[],
  hammerCd: 0.5, logCd: 2, pumpkinCd: 1.5, swingT: 1, swingYaw: 0, spawnCd: 0.6, shake: 0, stop: 0, ringT: 1, ringR: 1, moving: false,
  vx: 0, vz: 0, bt: 0, bonusDone: false, bonusFalls: 0, // 박치기 보너스
  swings: 0, misses: 0, sweepLock: 0, helperUsed: false,
  gadgets: [] as Gadget[], weather: '' as R.Weather | '', wt: 0, wx: 0, wz: 0, weatherN: 0,
  need: R.xpNeed(0), xpRecent: 0, xpTot: 0, calm: 0, // 카드 간격·보너스 뒤 숨 고르기(결정 078)
  opened: 0, slams: 0, done: [] as string[], bestChain: 0, // 미션(결정 060)·베스트 컷
  bossSpawned: false, bossDown: false, endIn: 0, extra: 0, strikes: 0, juggles: 0, // 왕좀비·STRIKE·저글(결정 057·058)
  drops: [] as Drop[], dropCd: R.FIRST_DROP as number, golden: 0, helper: null as Helper | null,
  isl: stage().r, chain: 0, chainT: 0, // 이어서 떨어뜨린 수와 남은 시간
});
let g = newGame();
let mode: 'title' | 'play' | 'bonusIntro' | 'bonus' | 'pick' | 'over' | 'pause' = 'title';
const eScale = (e: Enemy) => (e.kind === 'boss' ? R.BOSS_SCALE * (curDef.finale ? 1.25 : 1) : e.big ? 1.5 : 1);
const eRadius = (e: Enemy) => 0.45 * eScale(e);
/** 밀리는 정도: 왕좀비는 맞을수록(%) 더 멀리 */
const knockOf = (e: Enemy) => (e.kind === 'boss' ? R.bossKnock(e.pct ?? 0) : R.KIND_KNOCK[e.kind]);
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
document.addEventListener('visibilitychange', () => {
  resetInput();
  if (document.hidden) pause(); // 앱이 뒤로 가면 저절로 멈춘다
});
// 전화가 오거나 제어 센터를 내리는 등 잠깐 비활성이 되어도 멈추고, 돌아오면 일시정지 화면에서 이어 한다(결정 070)
void App.addListener('appStateChange', ({ isActive }) => {
  if (isActive) return;
  resetInput();
  pause();
});
addEventListener('keydown', (e) => (e.code === 'Space' ? sweep() : keys.add(e.code)));
addEventListener('keyup', (e) => keys.delete(e.code));
$('sweep').addEventListener('pointerdown', () => sweep());
$('pause').addEventListener('click', () => { sfx.tap(); pause(); });

// ───────── 규칙 ─────────
function spawn() {
  let a = 0;
  for (let tries = 0; tries < 6; tries++) { // 주인공 코앞에서는 올라오지 않게
    a = rnd(0, Math.PI * 2);
    if (Math.hypot(Math.cos(a) * g.isl - g.px, Math.sin(a) * g.isl - g.pz) > 5) break;
  }
  const st = stage(), big = Math.random() < Math.min(0.6, R.bigChance(g.t) * st.big), d = g.isl - 0.8, kind = R.pickKind(g.t, big);
  g.enemies.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 0, vy: 0, kx: 0, kz: 0, hp: R.enemyHp(g.t, big) * st.hp * R.KIND_HP[kind], big, out: false, flash: 0, hop: rnd(0, 6), age: 0, bladeCd: 0, kind, v: Math.random() < 0.5 ? 1 : 0 });
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
  if (g.sweepLock <= 0) g.charge = Math.min(R.sweepCost(g.lv.sweep), g.charge + charge * MT.chargeMul(meta));
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
  if (e.kind === 'boss' && e.age >= 2.5) { // 왕좀비: 맞을수록 %가 오르고 잠깐 휘청
    e.pct = (e.pct ?? 0) + dmg * R.BOSS_PCT_PER_DMG;
    e.stag = R.BOSS_STAGGER;
  }
  let km = R.knockMul(g.lv.knock) * MT.shoveMul(meta) * knockOf(e) * (e.kind === 'boss' && e.age < 2.5 ? 0 : 1); // 왕좀비는 등장 2.5초 동안 안 밀림
  if (e.y > 0.3 && e.kind !== 'boss') { // 공중에 뜬 적을 또 치면 더 세게
    km *= R.JUGGLE_KNOCK;
    g.juggles++;
    toast(L('공중 콤보!', 'Air combo!'));
  }
  e.kx += kx * km;
  e.kz += kz * km;
  const low = rule() === 'lowGrav';
  if (e.kind !== 'boss' && Math.hypot(kx, kz) * km > (low ? R.LOW_GRAV_KNOCK : 7) && e.y <= 0.01) e.vy = low ? R.LOW_GRAV_LIFT : 4.5; // 세게 맞으면 살짝 떠오른다
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
    const k = R.BOMB_KNOCK * (1 - d / R.BOMB_RADIUS * 0.5) * knockOf(o);
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
  toast(L('왕좀비 등장! 때릴수록 %가 오르고 멀리 날아간다', 'King zombie! Each hit raises % — then knock it off!'));
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
    g.extra += R.bossCoins(curDef.chapter);
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
  g.xp += n;
  g.xpTot += n;
  g.xpRecent += n;
  while (g.xp >= g.need) {
    g.xp -= g.need;
    g.level++;
    g.picks++;
    g.need = R.cardNeed(g.level, g.xpRecent);
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
  if (g.hp > 0) return;
  const back = g.revived ? 0 : MT.revivePct(meta.perks.revive);
  if (!back) return canContinue() ? offerContinue() : end(false);
  g.revived = true; // 두 번째 기회(결정 072): 판당 1번 일어나며 주변을 밀어낸다
  g.hp = Math.round(g.maxHp * back);
  g.inv = 2;
  blast(g.px, g.pz);
  sfx.fanfare();
  toast(L('다시 일어남!', 'Back on your feet!'));
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
  // 처음 보는 규칙이라 시간을 멈추고 할 일을 먼저 보여 준다(사용자: "뭘 어쩌라는 건지 모르다가 끝났다").
  // 세 번 본 뒤로는 설명 카드 없이 바로 시작(결정 074, 매 판 같은 카드를 누르는 게 번거로웠다)
  const seen = +(store.get('bonusSeen') ?? 0);
  store.set('bonusSeen', String(seen + 1));
  if (seen >= 3) {
    mode = 'bonus';
    sfx.setMusicFast(true);
    toast(L('보너스 판! 끌었다 놓으면 돌진', 'Bonus! Drag & release to dash'));
    return;
  }
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
  g.inv = R.BONUS_INV;
  g.calm = R.BONUS_CALM;
  g.spawnCd = R.spawnInterval(g.t) / stage().spawn / R.calmSpawn(g.calm); // 보너스 중 줄어든 대기를 되돌려 끝나자마자 몰려오지 않게
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
  const gold = g.golden > 0, rad = R.hammerRadius(g.lv.hammer) * MT.hammerMul(meta) + (gold ? 1.2 : 0);
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
  const wind2 = rule() === 'wind2', at = wind2 ? R.WIND2_AT : [R.WEATHER_AT];
  if (g.weatherN < at.length && g.t >= at[g.weatherN]) {
    g.weatherN++;
    g.weather = wind2 || Math.random() < 0.5 ? 'wind' : 'quake';
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
  g.xpRecent *= Math.exp(-dt / R.XP_WINDOW);
  if (!bonus && g.calm > 0) {
    if (g.calm > R.BONUS_CALM - 1) { const k = Math.exp(-0.5 * dt); g.px *= k; g.pz *= k; } // 첫 1초 동안 섬 가운데 쪽으로 미끄러진다(가장자리에서 끝나도 숨 돌리게)
    g.calm -= dt;
  }
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
    g.spawnCd = R.spawnInterval(g.t) / stage().spawn / R.calmSpawn(g.calm);
    for (let i = Math.round(R.spawnBatch(g.t) * stage().spawn); i > 0 && g.enemies.length < R.MAX_ENEMIES; i--) spawn();
  }

  // 적 이동·낙하·접촉
  const decay = Math.exp((bonus ? -1.4 : rule() === 'ice' ? -R.ICE_DECAY : -4.5) * dt); // 보너스 판·얼음 바닥은 볼링 레인처럼 멀리 미끄러진다
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
      e.vy -= (rule() === 'lowGrav' ? R.LOW_GRAV : 22) * dt;
      e.y = Math.max(0, e.y + e.vy * dt);
      if (e.y === 0) e.vy = 0;
    }
    const dx = g.px - e.x, dz = g.pz - e.z, d = Math.hypot(dx, dz) || 1;
    if (e.stag && e.stag > 0) e.stag -= dt;
    const sp = bonus || (e.stag ?? 0) > 0 ? 0 : (e.kind === 'boss' ? 0.9 : R.enemySpeed(g.t, e.big) * (e.kind === 'balloon' ? 1.15 : 1)) * stage().speed;
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
      if (ka > 3 && ka > kb * 1.5) { const t = 0.7 * knockOf(b); b.kx += a.kx * t; b.kz += a.kz * t; a.kx *= 0.55; a.kz *= 0.55; b.flash = 0.1; }
      else if (kb > 3 && kb > ka * 1.5) { const t = 0.7 * knockOf(a); a.kx += b.kx * t; a.kz += b.kz * t; b.kx *= 0.55; b.kz *= 0.55; a.flash = 0.1; }
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

  let ns = 0, ns2 = 0, nb = 0, nBal = 0, nBomb = 0, nSh = 0;
  bossMesh.visible = false;
  for (const e of g.enemies) {
    const yaw = Math.atan2(g.px - e.x, g.pz - e.z);
    if (e.kind === 'boss') {
      const roll = e.out ? Math.min(2.6, -e.y * 0.35 + 0.6) : 0;
      bossMesh.visible = true;
      bossMesh.position.set(e.x, e.y + Math.abs(Math.sin(now * 0.004)) * 0.15, e.z);
      bossMesh.rotation.set(-roll, yaw, 0, 'YXZ');
      bossMesh.scale.setScalar(eScale(e) * Math.min(1, e.age * 2));
      bossBody.material = e.flash > 0 ? bossFlash : bossMat;
      continue;
    }
    const top = (e.big ? 1.05 * 1.5 : 1.05) + e.y;
    if (e.kind === 'balloon') put(balloonMesh, nBal++, e.x, top + 0.55, e.z, 0, 1, 1.15, 1);
    if (e.kind === 'bomb') put(bombMesh, nBomb++, e.x, top + 0.12, e.z, yaw);
    if (e.kind === 'shield') put(shieldMesh, nSh++, e.x + Math.sin(yaw) * 0.75, e.y + 0.75, e.z + Math.cos(yaw) * 0.75, yaw);
    const hop = e.out ? 0 : Math.abs(Math.sin(e.hop)), sc = eScale(e) * Math.min(1, e.age * 4);
    const mesh = e.big ? bigMesh : e.v ? small2Mesh : smallMesh, i = e.big ? nb++ : e.v ? ns2++ : ns++;
    const roll = e.out ? Math.min(2.6, -e.y * 0.35 + 0.6) : 0; // 떨어질 때 뒤로 넘어가며 구른다
    put(mesh, i, e.x, e.y + hop * 0.22, e.z, Math.atan2(g.px - e.x, g.pz - e.z), sc * (1.04 - hop * 0.08), sc * (0.94 + hop * 0.12), sc * (1.04 - hop * 0.08), -roll);
    mesh.setColorAt(i, e.flash > 0 ? C_FLASH : C_PLAIN);
  }
  sync(smallMesh, ns);
  sync(small2Mesh, ns2);
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
  hammer.scale.setScalar((g.golden > 0 ? 1.35 : 1) * (0.9 + 0.08 * g.lv.hammer) * MT.hammerMul(meta));
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
    swing.scale.setScalar(R.hammerRadius(g.lv.hammer) * MT.hammerMul(meta) * (0.7 + g.swingT * 0.3));
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
  camTarget.lerp(P.set(g.px * CAM_PULL_X, 0, g.pz * CAM_PULL_Z), 1 - Math.exp(-6 * dt)); // 섬 가운데 쪽으로 당겨 가장자리 너머 떨어지는 적이 보이게(결정 079)
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
  // 같은 화면을 다시 그릴 때(상점에서 사기, 설정 켜고 끄기, 스테이지 넘기기)는 등장 애니메이션을 생략: 연달아 누를 때 버튼이 움직여 빗나갔다(결정 074)
  overlay.toggleAttribute('data-still', !overlay.hidden && overlay.className === cls);
  overlay.className = cls;
  overlay.innerHTML = html;
  overlay.hidden = false;
}
// 레벨 업 시트(결정 079): 아래 절반에 뜨고, 쌓인 카드는 닫지 않고 이어 고른다. 뜬 뒤 0.3초는 눌러도 무시(달리던 손가락이 잘못 누르지 않게)
let pickAt = 0, pickTotal = 0;
function showPick() {
  const picks = R.pickUpgrades(g.lv, g.hp >= g.maxHp);
  if (!picks.length) {
    g.picks = 0;
    if (mode === 'pick') { overlay.hidden = true; mode = 'play'; }
    return;
  }
  if (mode !== 'pick') { pickTotal = g.picks; sfx.fanfare(); }
  mode = 'pick';
  resetInput();
  pickAt = performance.now();
  const cards = picks.map((id) => {
    const [name, desc, c] = UPS[id], lv = id === 'heart' ? 0 : g.lv[id];
    const tag = id === 'heart' ? '' : lv ? `<em>Lv ${lv} → ${lv + 1}</em>` : `<em class="new">NEW</em>`;
    return `<button class="card" data-id="${id}" style="--c:${c}"><div class="ico">${svg(ICON[id])}</div><b>${name}</b>${tag}<span>${desc}</span></button>`;
  });
  const again = g.rerolls > 0 ? `<button class="sub" data-act="reroll">${L(`다시 고르기 (${g.rerolls})`, `Reroll (${g.rerolls})`)}</button>` : '';
  const head = g.t === 0 ? L('들고 갈 스킬', 'Starting skill') : L('레벨 업!', 'Level up!');
  const count = pickTotal > 1 ? ` <small>×${pickTotal} · ${pickTotal - g.picks + 1}/${pickTotal}</small>` : '';
  show(`<div class="sheet"><h2>${head}${count}</h2><div class="cards">${cards.join('')}</div>${again}</div>`, 'pick');
}
// 상점 설명은 "다음 단계에서 무엇이 되는지"를 보여 준다(결정 072)
const PERK_UI: Record<MT.Perk, [string, (next: number) => string, string, string]> = {
  vigor: [L('튼튼한 몸', 'Sturdy'), () => L('최대 체력 +15', 'Max HP +15'), '#ff5a6e', ICON.heart],
  shove: [L('큰 망치', 'Big mallet'), () => L('망치 크기·사거리 +3%, 넉백 +5%', 'Mallet size & reach +3%, knockback +5%'), '#b06ee8', ICON.hammer],
  charge: [L('쾅! 충전', 'Slam charge'), () => L('쾅! 게이지가 10% 빨리 참', 'Slam gauge fills 10% faster'), '#ff8a4c', ICON.sweep],
  cards: [L('카드 달인', 'Card master'), (n) => L(`다시 고르기 ${MT.rerolls(n)}번`, `${MT.rerolls(n)} rerolls`) + (MT.startPicks(n) ? L(` · 스킬 ${MT.startPicks(n)}개 들고 시작`, ` · start with ${MT.startPicks(n)} skill(s)`) : ''), '#35b9ab',
    '<rect x="3" y="7" width="11" height="14" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/>'],
  revive: [L('두 번째 기회', 'Second chance'), (n) => L(`판당 1번, 쓰러지면 체력 ${Math.round(MT.revivePct(n) * 100)}%로 일어남`, `Once a run, get up with ${Math.round(MT.revivePct(n) * 100)}% HP`), '#ef5da8',
    '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>'],
  purse: [L('코인 주머니', 'Coin pouch'), () => L('판 보상 코인 +10%', 'Run coins +10%'), '#e6a817', '<path d="M7 8h10l3 12H4z"/><path d="M9 8l1-4h4l1 4M12 12v5"/>'],
};
const coinPill = () => `<div class="coins"><i></i>${meta.coins.toLocaleString()}</div>`;

function placeGadgets() {
  g.gadgets = [];
  const n = R.GADGET_COUNT * (rule() === 'springs' ? R.SPRINGS_MUL : 1);
  for (let k = 0; k < n; k++) { // 고르게 벌려 놓는다
    const a = (k / n) * Math.PI * 2 + rnd(-0.4, 0.4), r = stage().r * rnd(0.38, 0.6);
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
async function startDaily() {
  stageBeforeDaily = stageIdx;
  await enterStage(R.dailyStage(today()));
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
  if (g.picks) showPick(); // 카드 달인: 스킬을 골라 들고 시작
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
  if (curDef.no !== stageIdx) void enterStage(stageIdx); // 고른 스테이지의 장 모델을 불러와 끼운다
  else { applyStage(); resetIsland(); }
  const locked = stageIdx > meta.cleared;
  // 시작 화면(결정 079): 미션은 한 줄로 접고(가장 쉬운 것 = 보상이 가장 적은 것을 앞에), 주인공이 가려지지 않게 메뉴를 아래로 모은다
  const ms = meta.missions.map((id) => MS.missionById(id)!).filter(Boolean), easy = [...ms].sort((a, b) => a.coins - b.coins)[0];
  const daily = loadDaily();
  show(
    `<div class="top">${coinPill()}<h1 class="big-title">${L('망치섬', 'Tumble<br>Isle')}</h1><p class="tag">${L('망치로 쳐서 섬 밖으로 날려 버리세요', 'Bonk the horde off your tiny island')}</p></div>` +
      `<div class="menu">` +
      `<div class="stage"><button data-act="prevCh" ${curDef.chapter ? '' : 'disabled'} aria-label="${L('이전 장', 'Previous chapter')}">«</button>` +
      `<button data-act="prev" ${stageIdx ? '' : 'disabled'} aria-label="${L('이전 스테이지', 'Previous stage')}">‹</button>` +
      `<div><small>${L(`${curDef.chapter + 1}장 · ${curDef.inChapter + 1}/${CH.STAGES_PER_CHAPTER}`, `Ch.${curDef.chapter + 1} · ${curDef.inChapter + 1}/${CH.STAGES_PER_CHAPTER}`)}${curDef.finale ? L(' · 장 보스', ' · boss') : ''}</small><b>${locked ? '🔒 ' : ''}${L(...CH.CHAPTERS[curDef.chapter].name)}</b></div>` +
      `<button data-act="next" ${stageIdx < CH.STAGE_COUNT - 1 ? '' : 'disabled'} aria-label="${L('다음 스테이지', 'Next stage')}">›</button>` +
      `<button data-act="nextCh" ${curDef.chapter < CH.CHAPTERS.length - 1 ? '' : 'disabled'} aria-label="${L('다음 장', 'Next chapter')}">»</button></div>` +
      (locked ? `<p class="best">${L(`${stageName(stageIdx - 1)}을(를) 지키면 열립니다`, `Clear ${stageName(stageIdx - 1)} to unlock`)}</p>` : bestLine()) +
      `<div class="goal"><i></i>${L(`${clock(R.RUN_SECONDS)} 버티면 섬을 지킨다`, `Survive ${clock(R.RUN_SECONDS)} to save the isle`)}</div>` +
      (easy ? `<details class="fold"><summary>${L(`미션 1/${ms.length}`, `Mission 1/${ms.length}`)} · ${L(easy.ko, easy.en)}</summary>${missionList(meta.missions)}</details>` : '') +
      `<button class="go" data-act="start" ${locked ? 'disabled' : ''}>${L('시작', 'Start')}</button>` +
      `<div class="row"><button class="sub daily" data-act="daily">${L('오늘의 섬', "Today's isle")}<small>${stageName(R.dailyStage(today()))}${daily.best ? L(` · 최고 ${daily.best}`, ` · best ${daily.best}`) : ''}</small></button>` +
      `<button class="sub" data-act="shop">${L('상점', 'Shop')}</button>` +
      `<button class="sub" data-act="settings">${L('설정', 'Settings')}</button></div></div>`,
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
/** 캡슐 연출: 흔들흔들(약 1초) → 펑 열리며 캐릭터 등장. 새 캐릭터면 바로 쓰기 버튼 */
function showCapsule(got: MT.CharId, dup: boolean) {
  mode = 'title';
  const [name, perk] = CHAR_UI[got];
  show(
    `<div class="gacha"><div class="ball"><i></i></div><div class="reveal ${dup ? 'dup' : ''}"><div class="rays"></div>` +
      `<img src="${portraits[got]}" alt=""><b>${dup ? L('이미 있는 캐릭터', 'Duplicate') : L('새 캐릭터!', 'New hero!')}</b><h2>${name}</h2>` +
      `<small>${dup ? L(`+${MT.CAPSULE_REFUND} 코인 돌려받음`, `+${MT.CAPSULE_REFUND} coins back`) : perk}</small>` +
      (dup ? `<button class="go" data-act="shop">${L('확인', 'OK')}</button>` : `<button class="go" data-act="hero" data-char="${got}">${L('바로 쓰기', 'Use now')}</button><button class="sub" data-act="shop">${L('나중에', 'Later')}</button>`) +
      `</div></div>`,
    'shop',
  );
  for (let i = 0; i < 4; i++) setTimeout(sfx.pop, i * 280);
  setTimeout(() => {
    overlay.querySelector('.gacha')?.classList.add('open');
    dup ? sfx.coins() : sfx.fanfare();
    sfx.buzz(30);
  }, 1150);
}
// ───── 일시정지·설정(결정 070) ─────
let pausedFrom: 'play' | 'bonus' = 'play';
function pause() {
  if (mode !== 'play' && mode !== 'bonus') return;
  pausedFrom = mode;
  mode = 'pause';
  resetInput();
  showPause();
}
function resume() {
  if (g.hp <= 0) return end(false); // 이어하기 창에서 뒤로 가기
  overlay.hidden = true;
  mode = pausedFrom;
}
// ───── 보상형 광고(결정 073): 직접 누를 때만, 판 밖에서만 ─────
/** 광고 보고 이어하기: 판당 1번, 60초를 넘겼거나 왕좀비가 나왔을 때만(아까운 순간). 오늘의 섬은 공정하게 뺀다 */
const canContinue = () => !g.continued && !dailyRun && ads.adReady() && (g.t >= 60 || g.bossSpawned);
function offerContinue(note = '', withAd = true) {
  pausedFrom = 'play';
  mode = 'pause';
  resetInput();
  show(
    `<h2 class="big-title" style="font-size:32px">${L('쓰러졌다!', 'Down!')}</h2><p class="tag">${note || L('광고를 보면 체력 50%로 이어 할 수 있어요 (판당 1번)', 'Watch an ad to get up with 50% HP (once a run)')}</p>` +
      (withAd ? `<div class="slot">${ads.adReady() ? continueAdBtn() : adWait()}</div>` : '') + `<button class="sub" data-act="quit">${L('그만하기', 'Give up')}</button>`,
    'shop',
  );
}
const continueAdBtn = () => `<button class="ad" data-act="adContinue">▶ ${L('이어 하기', 'Continue')}</button>`;
const adWait = () => `<span class="ad-wait">${L('광고 준비 중…', 'Loading ad…')}</span>`;
async function watchAd(btn: HTMLButtonElement): Promise<ads.AdResult> {
  overlay.querySelectorAll('button').forEach((b) => (b.disabled = true)); // 광고 중엔 「그만하기」도 잠근다(QA: 광고 중 그만하기 → 판이 되살아나 코인 두 번)
  sfx.setMuted(true);
  try {
    return await ads.showAd();
  } catch {
    return 'failed';
  } finally {
    sfx.setMuted(false); // SDK가 예외로 끝나도 소리는 되살린다
  }
}
let lastCoins = 0;
const doubleAdBtn = () => `<button class="ad" data-act="adDouble">▶ ${L(`광고 보고 코인 2배 (+${lastCoins})`, `Watch ad: double coins (+${lastCoins})`)}</button>`;
/** 코인 2배 자리(결정 079): 조건이 맞으면 광고 준비 전에도 같은 높이 칸을 미리 잡아 둔다(준비되어 버튼이 생겨도 아래가 밀리지 않게) */
const doubleBtn = () =>
  meta.cleared >= 2 && lastCoins > 0 && ads.adDaily().doubles < ads.DOUBLES_PER_DAY // 처음 두 섬을 깨기 전에는 광고를 보여 주지 않는다
    ? `<div class="slot" data-slot="double">${ads.adReady()
      ? doubleAdBtn()
      : adWait()}</div>` : '';
// 늦게 준비된 광고(결정 080): 열린 결과 화면의 「광고 준비 중…」 칸을 버튼으로, 상점은 다시 그린다(같은 화면이라 애니메이션 없음)
ads.onAdReady(() => {
  if (overlay.hidden) return;
  const wait = overlay.querySelector('.slot .ad-wait'); // 결과 화면 2배 칸 또는 이어하기 창(광고를 닫은 뒤)
  if (wait) wait.outerHTML = wait.closest('[data-slot="double"]') ? doubleAdBtn() : continueAdBtn();
  else if (overlay.querySelector('[data-act="adCapsule"]:disabled') && !ads.adDaily().capsule) showShop();
});
async function onAd(act: string, btn: HTMLButtonElement) {
  if (act === 'adContinue') {
    const res = await watchAd(btn);
    if (mode !== 'pause' || g.hp > 0) return; // 그사이 다른 화면으로 넘어갔으면 아무것도 하지 않는다
    // 닫았으면 다음 광고가 준비되는 대로 버튼이 살아나고(onAdReady), 보여 주지 못했으면 그만하기만
    if (res === 'closed') return offerContinue(L('광고를 끝까지 보면 이어 할 수 있어요', 'Finish the ad to continue'));
    if (res === 'failed') return offerContinue(L('광고를 불러오지 못했어요', "Couldn't load the ad"), false);
    g.continued = true;
    g.hp = Math.round(g.maxHp * 0.5);
    g.inv = 2.5;
    blast(g.px, g.pz);
    resume();
    toast(L('다시 일어남!', 'Back on your feet!'));
  } else if (act === 'adDouble') {
    if ((await watchAd(btn)) !== 'earned') { // 실패·닫음: 칸을 「광고 준비 중…」으로 되돌려 다음 광고가 준비되면 버튼으로(onAdReady)
      btn.outerHTML = ads.adReady() ? doubleAdBtn() : adWait();
      overlay.querySelectorAll<HTMLButtonElement>('button:not(.ad)').forEach((b) => (b.disabled = false));
      return;
    }
    meta = { ...meta, coins: meta.coins + lastCoins };
    saveMeta();
    ads.useAdDaily('doubles');
    sfx.coins();
    btn.outerHTML = `<span class="badge">${L(`+${lastCoins} 코인 더 받음!`, `+${lastCoins} bonus coins!`)}</span>`;
  } else if (act === 'adCapsule') {
    if ((await watchAd(btn)) !== 'earned') return showShop(); // 잠갔던 버튼을 다시 그려서 푼다
    const r = MT.rollCapsule({ ...meta, coins: meta.coins + MT.CAPSULE_COST })!;
    meta = r.meta;
    saveMeta();
    ads.useAdDaily('capsule');
    showCapsule(r.got, r.dup);
  }
}
// 안드로이드 뒤로 가기(결정 071): 판 도중 → 일시정지, 일시정지 → 이어 하기, 상점·설정·결과 → 시작 화면, 시작 화면 → 묻고 종료
void App.addListener('backButton', () => {
  if (mode === 'play' || mode === 'bonus') return pause();
  if (mode === 'pause') return resume();
  if (mode === 'pick' || mode === 'bonusIntro') return; // 고르는 화면은 고른 뒤에 나간다
  if (overlay.className !== 'title') return showTitle();
  if (window.confirm(L('망치섬을 종료할까요? 진행 기록은 저장되어 있어요.', 'Quit Tumble Isle? Your progress is saved.'))) void App.exitApp();
});
const toggleRow = (act: string, label: string, on: boolean) =>
  `<button class="set" data-act="${act}" aria-pressed="${on}"><span>${label}</span><b>${on ? L('켬', 'On') : L('끔', 'Off')}</b></button>`;
/** 언어를 바꾸면 다시 불러오므로 판 도중(일시정지)에는 빼고 보여 준다 */
const settingsRows = (withLang: boolean) =>
  `<div class="settings">${toggleRow('music', L('음악', 'Music'), sfx.isMusicOn())}${toggleRow('sound', L('효과음', 'Sound effects'), sfx.isSfxOn())}${toggleRow('haptic', L('진동', 'Vibration'), sfx.isHapticOn())}` +
  (withLang && ads.privacyRequired() ? `<button class="set" data-act="privacy"><span>${L('개인정보 설정', 'Privacy settings')}</span><b>›</b></button>` : '') +
  (withLang ? `<button class="set" data-act="lang"><span>${L('언어', 'Language')}</span><b>${lang === 'ko' ? '한국어' : 'English'}</b></button>` : '') + `</div>`;
function showPause() {
  show(
    `<h2 class="big-title" style="font-size:30px">${L('일시정지', 'Paused')}</h2>${settingsRows(false)}` +
      `<button class="go" data-act="resume">${L('계속하기', 'Resume')}</button><button class="sub" data-act="quit">${L('그만하기', 'Quit')}</button>`,
    'shop',
  );
}
function showSettings() {
  mode = 'title';
  show(
    `<h2 class="big-title" style="font-size:30px">${L('설정', 'Settings')}</h2>${settingsRows(true)}` +
      `<p class="credit">${L('그래픽·효과음', 'Art & sound')}: Kenney (kenney.nl, CC0)</p><button class="sub" data-act="title">${L('돌아가기', 'Back')}</button>`,
    'shop',
  );
}
function showShop() {
  mode = 'title';
  // 상점 한 화면(결정 079): 강화는 2열 타일, 캡슐 두 버튼은 한 줄에 같은 크기, 돌아가기는 왼쪽 위 ‹
  const cards = MT.PERKS.map((id) => {
    const [name, descOf, c, ico] = PERK_UI[id], lv = meta.perks[id], max = MT.PERK_MAX[id], cost = MT.perkCost(id, lv), desc = descOf(Math.min(max, lv + 1));
    const btn = lv >= max ? `<button class="buy" disabled>MAX</button>` : `<button class="buy" data-act="buy" data-perk="${id}" ${meta.coins < cost ? 'disabled' : ''}><i></i>${cost}</button>`;
    return `<div class="perk" style="--c:${c}"><div class="ico">${svg(ico)}</div><b>${name}</b><em style="--p:${(lv / max) * 100}%">Lv ${lv}/${max}</em><span>${desc}</span>${btn}</div>`;
  });
  const adUsed = ads.adDaily().capsule > 0, adOk = ads.adReady() && !adUsed;
  const chars = MT.CHARS.map((c) => {
    const [name, perk] = CHAR_UI[c], own = meta.chars.includes(c), on = meta.hero === c;
    return `<button class="char ${on ? 'on' : ''}" data-act="hero" data-char="${c}" ${own ? '' : 'disabled'}><img src="${portraits[c]}" alt=""><b>${own ? name : '???'}</b><small>${perk}</small></button>`;
  });
  show(
    `<div class="shopbox"><header><button class="back" data-act="title" aria-label="${L('돌아가기', 'Back')}">‹</button><h2>${L('상점', 'Shop')}</h2>${coinPill()}</header>` +
      `<div class="side"><div class="capsule"><button class="buy" data-act="capsule" ${meta.coins < MT.CAPSULE_COST ? 'disabled' : ''}><i></i>${MT.CAPSULE_COST}<small>${L('캡슐 돌리기', 'Spin capsule')}</small></button>` +
      // 자리를 늘 차지해 사고 나서 아래 버튼이 밀려 올라가지 않게(결정 074). 준비 전·다 쓴 날은 회색으로 자리만
      `<button class="ad" data-act="adCapsule" ${adOk ? '' : 'disabled'}>${adUsed ? L('무료 캡슐', 'Free capsule') : `▶ ${L('광고', 'Ad')}`}<small>${adUsed ? L('내일 또', 'Back tomorrow') : adOk ? L('무료 캡슐 (하루 1번)', 'Free capsule (1/day)') : L('광고 준비 중', 'Loading ad')}</small></button></div>` +
      `<div class="chars">${chars.join('')}</div></div><div class="perks">${cards.join('')}</div></div>`,
    'store',
  );
}
overlay.addEventListener('click', (ev) => {
  const btn = (ev.target as HTMLElement).closest('button');
  if (!btn || btn.disabled) return;
  if (mode === 'pick' && ev.isTrusted && performance.now() - pickAt < 300) return; // 시트가 뜬 직후 누름 막기(봇의 .click()은 통과)
  sfx.unlockAudio();
  sfx.tap();
  const act = btn.dataset.act, id = btn.dataset.id as R.UpgradeId | 'heart' | undefined;
  if (act === 'start') return void stageReady.then(startRun);
  if (act === 'daily') return startDaily();
  if (act === 'share') return void shareShot();
  if (act === 'bonusGo') {
    overlay.hidden = true;
    mode = 'bonus';
    sfx.setMusicFast(true);
    return;
  }
  if (act === 'shop') return showShop();
  if (act === 'settings') return showSettings();
  if (act === 'music' || act === 'sound' || act === 'haptic') {
    (act === 'music' ? sfx.toggleMusic : act === 'sound' ? sfx.toggleSfx : sfx.toggleHaptic)();
    return mode === 'pause' ? showPause() : showSettings();
  }
  if (act === 'privacy') return void ads.openPrivacy().then(showSettings);
  if (act === 'lang') return setLang(lang === 'ko' ? 'en' : 'ko');
  if (act === 'resume') return resume();
  if (act === 'adContinue' || act === 'adDouble' || act === 'adCapsule') return void onAd(act, btn);
  if (act === 'reroll') {
    g.rerolls--;
    return showPick();
  }
  if (act === 'quit') return end(false);
  if (act === 'title') return showTitle();
  if (act === 'prev' || act === 'next') {
    stageIdx = Math.max(0, Math.min(CH.STAGE_COUNT - 1, stageIdx + (act === 'next' ? 1 : -1)));
    return showTitle();
  }
  if (act === 'prevCh' || act === 'nextCh') { // 장 단위로 건너뛰되 열린 곳까지만
    const ch = Math.max(0, Math.min(CH.CHAPTERS.length - 1, curDef.chapter + (act === 'nextCh' ? 1 : -1)));
    stageIdx = Math.min(ch * CH.STAGES_PER_CHAPTER, Math.max(meta.cleared, 0));
    if (ch * CH.STAGES_PER_CHAPTER > meta.cleared) stageIdx = ch * CH.STAGES_PER_CHAPTER; // 잠긴 장도 둘러는 볼 수 있게
    return showTitle();
  }
  if (act === 'nextIsle') {
    return void enterStage(stageIdx + 1).then(startRun);
  }
  if (act === 'capsule') {
    const r = MT.rollCapsule(meta);
    if (!r) return showShop();
    meta = r.meta;
    saveMeta();
    return showCapsule(r.got, r.dup);
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
  g.inv = Math.max(g.inv, 0.6);
  if (--g.picks > 0) return showPick(); // 시트를 닫지 않고 다음 장
  overlay.hidden = true;
  mode = 'play';
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
    void enterStage(stageBeforeDaily); // 오늘의 섬은 섬 해금·기록과 따로 간다
  }
  checkMissions();
  const doneMs = g.done.map((id) => MS.missionById(id)!);
  const missionCoins = doneMs.reduce((a, m) => a + m.coins, 0);
  const coins = Math.round((MT.coinsFor(g.kills, g.falls, win, curDef.chapter) + g.bonusFalls * R.BONUS_COIN + g.extra + missionCoins) * MT.coinMul(meta));
  lastCoins = coins;
  ads.initAds(); // 첫 판이 끝난 뒤에야 광고 준비(추적 허용 창)를 시작한다
  const unlocked = win && !dailyNote && stageIdx === meta.cleared && stageIdx < CH.STAGE_COUNT;
  meta = {
    ...meta, coins: meta.coins + coins, cleared: unlocked ? stageIdx + 1 : meta.cleared,
    missionsDone: meta.missionsDone + g.done.length, bossDowns: meta.bossDowns + (g.bossDown ? 1 : 0),
    missions: MS.fillMissions(meta.missions.filter((id) => !g.done.includes(id))), // 달성한 미션은 새 것으로
  };
  saveMeta();
  const hasNext = win && !dailyNote && stageIdx + 1 < CH.STAGE_COUNT;
  // 결과(결정 079): 떨어뜨린 수를 크게, 나머지는 작은 한 줄. 미션은 이번 판 달성한 것만 펼치고 없으면 접는다
  const badges = (unlocked && hasNext ? `<span class="badge">${L(`다음: ${stageName(stageIdx + 1)}`, `Next: ${stageName(stageIdx + 1)}`)}</span>` : '') +
    (isBest ? `<span class="badge">${L('최고 기록!', 'New best!')}</span>` : '') + (g.strikes ? `<span class="badge">STRIKE ×${g.strikes}</span>` : '') + dailyNote;
  const missions = doneMs.length ? missionList(g.done, g.done)
    : `<details class="fold"><summary>${L(`다음 미션 ${meta.missions.length}개`, `${meta.missions.length} next missions`)}</summary>${missionList(meta.missions)}</details>`;
  show(
    `<h1 class="big-title" style="font-size:32px">${g.bossDown ? L('왕좀비 격파!', 'King zombie down!') : win ? L('섬을 지켰다!', 'Isle defended!') : L('섬을 빼앗겼다', 'The isle fell')}</h1>` +
      `<div class="panel result"><small>${L('떨어뜨림', 'Knocked off')}</small><strong class="falls">${g.falls}</strong>` +
      `<p class="line">${clock(sec)} · ${L('처치', 'KOs')} ${g.kills} · Lv ${g.level + 1}</p>` +
      `<div class="earn"><i></i>+${coins}</div>${doubleBtn()}` +
      (badges ? `<div class="badges">${badges}</div>` : '') + missions + `</div>` +
      (bestShot ? `<button class="bestcut" data-act="share" aria-label="${L('베스트 컷 공유', 'Share best shot')}"><img src="${bestShot}" alt=""><span><b>${L('베스트 컷', 'Best shot')}</b>${L(`낙하 ×${g.bestChain}`, `Drop ×${g.bestChain}`)}</span>` +
        `${svg('<path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>', 'share')}</button>` : '') +
      `<div class="actions">` +
      (hasNext ? `<button class="go" data-act="nextIsle">${L('다음 섬으로', 'Next isle')}</button><button class="sub" data-act="start">${L('한 번 더', 'Once more')}</button>`
        : `<button class="go" data-act="start">${L('한 번 더', 'Once more')}</button>`) +
      `<div class="row"><button class="sub" data-act="shop">${L('상점', 'Shop')}</button><button class="sub" data-act="title">${L('처음으로', 'Home')}</button></div></div>`,
    'over',
  );
}
$('sweep').querySelector('span')!.textContent = L('쾅!', 'SLAM!');

// 바뀔 때만 DOM을 고친다(매 프레임 innerHTML을 쓰면 폰에서 느려진다)
const bossPct = $('bossPct');
const hud = { hint: $('hint'), toast: $('toast'), warn: $('warn'), hearts: $('hearts'), time: $('time'), lvl: $('lvl'), xp: $('xp').querySelector('i')!, falls: $('falls'), sweep: $('sweep'), dev: $('dev') };
const shown = { hp: -1, left: -1, level: -1, xp: -1, falls: -1, p: -1, mode: '', warnText: '', hint: '' };
const hpFill = $('hpFill'), hpLag = $('hpLag'), hpText = $('hpText');
const BP = new THREE.Vector3();
function drawBossPct() { // 왕좀비 머리 위에 %(높을수록 빨갛게)
  const b = g.enemies.find((e) => e.kind === 'boss' && !e.out);
  if (!b || (mode !== 'play' && mode !== 'pick')) return void (bossPct.hidden = true);
  BP.set(b.x, b.y + R.BOSS_SCALE * 1.35, b.z).project(camera);
  const pct = Math.round(b.pct ?? 0);
  bossPct.hidden = false;
  bossPct.style.transform = `translate(${((BP.x + 1) / 2) * innerWidth}px, ${((1 - BP.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
  bossPct.textContent = `${pct}%`;
  bossPct.style.color = `hsl(${Math.max(0, 50 - pct * 0.3)}, 100%, ${pct > 100 ? 55 : 98}%)`;
}
function drawHud() {
  drawBossPct();
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
  const xp = Math.round((g.xp / g.need) * 100);
  if (shown.xp !== xp) hud.xp.style.width = `${(shown.xp = xp)}%`;
  if (shown.falls !== g.falls) {
    hud.falls.innerHTML = `${L('떨어뜨림', 'Knocked off')} <b>${(shown.falls = g.falls)}</b>`;
    if (g.chain >= R.STRIKE_CHAIN) toast(`STRIKE! ×${g.chain}`);
    else if (g.chain >= 2) toast(L(`낙하 ×${g.chain}!`, `Drop ×${g.chain}!`)); // 이어서 떨어뜨리면 가운데에 크게
  }
  const ruleText = CH.CHAPTERS[curDef.chapter].ruleText; // 장 규칙 안내 띠: 판 시작 3초(결정 079)
  const hint = mode === 'bonus' ? `${L('끌었다 놓으면 돌진!', 'Drag & release to dash!')} · ${L('떨어뜨림', 'Knocked')} ${g.bonusFalls} (+${g.bonusFalls * R.BONUS_COIN})`
    : mode === 'play' && g.t < 3 && rule() && ruleText ? L(...ruleText) : '';
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

const DEV = import.meta.env.MODE !== 'release';
const DEBUG = DEV && new URLSearchParams(location.search).has('debug'); // 프레임 수 글씨는 주소에 ?debug일 때만(결정 079)
hud.dev.hidden = !DEBUG;
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
    if (DEBUG) hud.dev.textContent = `${fps}fps · ${g.enemies.length} · ${renderer.info.render.calls}dc · in ${joyId === -1 ? '-' : `${jx.toFixed(1)},${jz.toFixed(1)}`}`;
  }
}
await enterStage(stageIdx);
showTitle();
requestAnimationFrame(frame);
const boot = $('boot');
boot.classList.add('done');
setTimeout(() => boot.remove(), 500);

// 개발 훅: 콘솔에서 상태 확인·부하 시험(__demo.stress(300))
if (DEV)
  Object.assign(window, {
    __demo: {
      ads: ads.adDev, // 광고 흐름 시험: __demo.ads.failNext·closeNext = true, __demo.ads.setReady(false)
      /** 광고 자리 시험: 판을 시작해 60초 지난 것으로 하고 쓰러지게(이어하기 창) 또는 이기게(결과 화면) */
      down: async () => { await stageReady; startRun(); g.t = 61; g.revived = true; hurt(1e9); return overlay.innerText; },
      win: async () => { await stageReady; startRun(); g.t = 61; end(true); return overlay.innerText; },
      /** 촬영 모드: 연출 장면을 정해진 크기로 렌더해 docs/art/<kind>.png로 저장(개발 서버 vite.config.ts) */
      shot: async (kind: 'icon' | 'splash') => {
        const size = kind === 'icon' ? 1024 : 2732;
        await enterStage(0);
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
      /** chaseBoss: 왕좀비가 나오면 사람처럼 노린다(왕좀비와 섬 중심 사이에서 바깥으로 치기, 근처에서 쾅!) */
      bot: async (runs = 10, sloppy = 0.6, stageNo = 0, chaseBoss = false) => {
        const out: { win: boolean; t: number; falls: number; kills: number; swings: number; misses: number; lv: number; boss: boolean; strikes: number; bossSecs: number; bossPct: number; diedVsBoss: boolean; lvT: number[]; xpAt: number[] }[] = [];
        for (let r = 0; r < runs; r++) {
          let lastBossPct = 0;
          const lvT: number[] = [], xpAt: number[] = []; // 레벨 업 시각, 10초마다 모은 경험치 합(카드 간격 측정)
          await enterStage(stageNo);
          startRun();
          let lag = [0, 0];
          for (;;) {
            while (lvT.length < g.level) lvT.push(g.t);
            if (g.t >= (xpAt.length + 1) * 10) xpAt.push(g.xpTot);
            if (mode === 'pick') {
              const picks = [...overlay.querySelectorAll<HTMLButtonElement>('.card')];
              (picks.find((c) => c.dataset.id === 'heart' && g.hp <= g.maxHp * 0.5) ?? picks.find((c) => R.ATTACKS.includes(c.dataset.id as R.UpgradeId)) ?? picks[0]).click();
              continue;
            }
            if (mode === 'bonusIntro') { overlay.querySelector<HTMLButtonElement>('[data-act="bonusGo"]')!.click(); continue; }
            if (mode === 'bonus') { for (let i = 0; i < 30; i++) update(1 / 60); continue; }
            if (mode === 'pause') { overlay.querySelector<HTMLButtonElement>('[data-act="quit"]')!.click(); continue; } // 이어하기 광고 창: 봇은 보지 않는다
            if (mode !== 'play') break;
            let mx = 0, mz = 0, near: Enemy | null = null, nd = 99;
            const boss = chaseBoss ? g.enemies.find((e) => e.kind === 'boss' && !e.out) : undefined;
            if (boss) { // 왕좀비 안쪽 2.3칸 자리로
              lastBossPct = boss.pct ?? 0;
              const bd = Math.hypot(boss.x, boss.z) || 1, tx = boss.x - (boss.x / bd) * 2.3, tz = boss.z - (boss.z / bd) * 2.3;
              const dx = tx - g.px, dz = tz - g.pz, d = Math.hypot(dx, dz) || 1;
              if (d > 0.3) { mx += (dx / d) * 1.4; mz += (dz / d) * 1.4; }
            }
            for (const e of g.enemies) {
              if (e.out || (boss && e === boss && Math.hypot(g.px - e.x, g.pz - e.z) > 1.7)) continue;
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
            if (g.charge >= R.sweepCost(g.lv.sweep) && (g.enemies.filter((e) => !e.out && Math.hypot(e.x - g.px, e.z - g.pz) < 5).length >= 8 || (boss && Math.hypot(boss.x - g.px, boss.z - g.pz) < 4))) sweep();
            jx = dir[0];
            jz = dir[1];
            joyId = 99;
            for (let i = 0; i < 6 && mode === 'play'; i++) update(1 / 60);
            resetInput();
          }
          const win = g.t >= R.RUN_SECONDS - 0.1 || g.bossDown;
          out.push({ win, t: g.t, falls: g.falls, kills: g.kills, swings: g.swings, misses: g.misses, lv: g.level + 1, boss: g.bossDown, strikes: g.strikes, bossSecs: g.bossDown ? g.t - R.BOSS_AT : 0, bossPct: g.bossDown ? lastBossPct : 0, diedVsBoss: !win && g.t >= R.BOSS_AT, lvT, xpAt });
          await new Promise((res) => setTimeout(res, 0));
        }
        const avg = (f: (x: (typeof out)[number]) => number) => +(out.reduce((a, x) => a + f(x), 0) / runs).toFixed(2);
        showTitle();
        return { wins: `${out.filter((x) => x.win).length}/${runs}`, avgT: avg((x) => x.t), avgLv: avg((x) => x.lv), fallShare: avg((x) => x.falls / Math.max(1, x.kills)), missShare: avg((x) => x.misses / Math.max(1, x.swings)), bossDowns: out.filter((x) => x.boss).length, strikes: avg((x) => x.strikes),
          bossSecs: +(out.filter((x) => x.boss).reduce((a, x) => a + x.bossSecs, 0) / Math.max(1, out.filter((x) => x.boss).length)).toFixed(1),
          bossPct: Math.round(out.filter((x) => x.boss).reduce((a, x) => a + x.bossPct, 0) / Math.max(1, out.filter((x) => x.boss).length)),
          diedVsBoss: out.filter((x) => x.diedVsBoss).length,
          // 카드 수(레벨 업 횟수)·첫 세 장 받은 시각·보너스 직후(65~80초) 쓰러진 판 수(결정 078)
          cards: avg((x) => x.lv - 1), cardT: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => { const ts = out.filter((x) => x.lvT[k] !== undefined).map((x) => x.lvT[k]); return ts.length ? Math.round(ts.reduce((a, b) => a + b, 0) / ts.length) : null; }),
          xpAt: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((k) => { const v = out.filter((x) => x.xpAt[k] !== undefined).map((x) => x.xpAt[k]); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; }),
          diedAfterBonus: out.filter((x) => !x.win && x.t >= R.BONUS_AT && x.t < R.BONUS_AT + 15).length };
      },
      /** 처음부터 끝까지(결정 068): 늘 다음 스테이지를 하고, 판마다 가장 싼 강화를 살 수 있는 만큼 산다. 다 사는 판·도달 스테이지를 잰다 */
      /** doubles: 6판마다 앞 몇 판에 결과 화면 코인 2배 광고를 본다(하루 6판 중 3판이면 3, 버튼 조건과 같이 두 섬을 깬 뒤부터) */
      campaign: async (runs = 200, sloppy = 0.85, doubles = 0) => {
        meta = MT.freshMeta(); saveMeta();
        const log: string[] = [];
        let maxedAt = 0;
        for (let r = 1; r <= runs; r++) {
          const no = Math.min(meta.cleared, CH.STAGE_COUNT - 1);
          await (window as unknown as { __demo: { bot: (n: number, s: number, no: number, c: boolean) => Promise<unknown> } }).__demo.bot(1, sloppy, no, true);
          if ((r - 1) % 6 < doubles && meta.cleared >= 2) meta = { ...meta, coins: meta.coins + lastCoins };
          for (;;) {
            const id = MT.PERKS.filter((p) => meta.perks[p] < MT.PERK_MAX[p]).sort((a, b) => MT.perkCost(a, meta.perks[a]) - MT.perkCost(b, meta.perks[b]))[0];
            const next = id && MT.buy(meta, id);
            if (!next) break;
            meta = next;
          }
          saveMeta();
          if (!maxedAt && MT.PERKS.every((p) => meta.perks[p] >= MT.PERK_MAX[p])) maxedAt = r;
          if (r % 10 === 0) log.push(`${r}판: ${meta.cleared}스테이지 깸, 코인 ${meta.coins}, 강화 ${MT.PERKS.map((p) => meta.perks[p]).join('/')}`);
        }
        return { maxedAt, cleared: meta.cleared, log };
      },
      /** 강화 단계를 바로 정한다(강화별 효과를 봇으로 비교할 때) */
      setPerks: (p: Partial<Record<MT.Perk, number>>) => { meta = { ...meta, perks: { ...MT.freshMeta().perks, ...p } }; },
      /** 장 규칙을 바꿔 비교: '' 끔, undefined 장 그대로 */
      setRule: (r?: R.Rule | '') => { ruleOverride = r; },
      sweep,
      /** 스테이지 번호(0~149)로 바로 가서 장 모델을 불러온다 */
      goStage: (no: number) => enterStage(no).then(() => showTitle()),
      /** 그리기 한 번 + 베스트 컷 찍기(화면 갱신이 멈춘 미리보기에서 시험용) */
      renderOnce: () => { draw(1 / 60, performance.now()); composer.render(); captureShot(); drawHud(); return bestShot.length; },
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
