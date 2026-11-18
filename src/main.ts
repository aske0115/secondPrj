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
import * as WL from './weaponLook';
import * as BS from './bestShot';

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
let heroIdle: THREE.AnimationAction, heroWalk: THREE.AnimationAction, heroBase = 1; // heroBase: 모델 크기(웅크림은 여기에 곱한다)
function setHero(id: MT.CharId) {
  scene.remove(hero);
  const gl = heroModels[id];
  hero = gl.scene;
  heroBase = hero.scale.x;
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
let ringAtHero = true;
const arcGeos = new Map<string, THREE.BufferGeometry>();
/** 부채꼴(+z 가운데)은 각도별로 한 번만 만든다: 원·360°와 부채꼴이 번갈아 나와도 새로 만들지 않게 */
function arcGeo(arc: number, inner = 0.4) {
  const k = `${arc.toFixed(3)}|${inner}`;
  let geo = arcGeos.get(k);
  if (!geo) arcGeos.set(k, (geo = new THREE.RingGeometry(inner, 1, 28, 1, -Math.PI / 2 - arc / 2, arc).rotateX(-Math.PI / 2)));
  return geo;
}
// 주무기 8종(결정 088): 무기마다 한 덩어리(WL.weaponGeo), 쌍검만 왼손에 하나 더
const weaponMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const weapon = new THREE.Mesh(new THREE.BufferGeometry(), weaponMat), weapon2 = new THREE.Mesh(new THREE.BufferGeometry(), weaponMat);
weapon.castShadow = weapon2.castShadow = true;
scene.add(weapon, weapon2);
let weaponKey = '';
// 박자 연출(결정 088): 늘 만들어 두고 보일 때만 그린다(인스턴스 0개면 그리기 없음)
const fxMat = (color: number, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
const strip = () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5); // 길이 1, +z로 뻗는 띠
const shockFx = new THREE.Mesh(arcGeo(Math.PI * 2, 0.72), fxMat(0xfff3c4)); // 원 충격파(대형 해머·펀치 막대 고리)
const landFx = new THREE.Mesh(mergeGeometries([new THREE.RingGeometry(0.8, 1, 40), new THREE.CircleGeometry(0.12, 12)]).rotateX(-Math.PI / 2), fxMat(0xfff0c8)); // 대형 해머 착지 원
const crackFx = new THREE.Mesh(mergeGeometries(Array.from({ length: 7 }, (_, k) => {
  const a = (k / 7) * Math.PI * 2 + (k % 2) * 0.3, l = 0.55 + (k % 3) * 0.2;
  return new THREE.PlaneGeometry(0.07, l).rotateX(-Math.PI / 2).translate(0, 0, l / 2 + 0.1).rotateY(a);
})), fxMat(0x5a3b22, 0.7)); // 쿵! 금 간 자국
for (const m of [shockFx, landFx, crackFx]) { m.visible = false; scene.add(m); }
const lineFx = instanced(strip(), fxMat(0xffffff), 3); // 펀치 막대 직선 흰 띠
const dashFx = instanced(new THREE.PlaneGeometry(0.12, 0.3).rotateX(-Math.PI / 2), fxMat(0xffffff, 0.8), 12); // 찌를 줄 점선
const logWarnFx = instanced(strip(), fxMat(0xff6a3c, 0.25), 4); // 통나무 예고 띠
const markFx = instanced(arcGeo(Math.PI * 2, 0.82), fxMat(0xff9a3c, 0.6), 16); // 호박 착지 원·덩어리 떨어지는 자리
const slashFx = instanced(arcGeo(1.5, 0.82), fxMat(0xffffff, 0.7), 3); // 쌍검 교차 잔상
const gustFx = instanced(new THREE.ConeGeometry(0.55, 1.2, 9, 1, true).rotateX(Math.PI).translate(0, 0.6, 0), fxMat(0xe8f8ff, 0.4), 6); // 부채 회오리
const helmetMesh = instanced(new THREE.SphereGeometry(0.3, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1), flat(0x59606c), R.MAX_ENEMIES, true); // 단단 성질 투구
const C_SUB = new THREE.Color(2.6, 1.3, 0.3), C_BLOCK = new THREE.Color(0.45, 0.48, 0.58), C_TOUGH = new THREE.Color(0.72, 0.72, 0.8), C_STAR = new THREE.Color(0xffe23f);
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
const streakMesh = instanced(new THREE.BoxGeometry(0.04, 0.04, 1.4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }), 56); // 40개는 날씨, 나머지는 부채 바람
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
  const c = CH.CHAPTERS[d.chapter], dusk = d.time === 'dusk', fx = d.trait ? R.TRAIT_FX[d.trait] : { spawn: 1, big: 1 };
  return {
    name: [stageName(d.no), stageName(d.no)], r: d.r, crumbles: d.crumbles, gadget: c.gadget,
    grass: c.grass, cliff: c.cliff, sky: dusk ? 0xf3b98f : c.sky, sun: dusk ? 0xffb07a : c.sun,
    spawn: d.spawn * fx.spawn, big: d.big * fx.big, hp: d.hp, speed: d.speed, dmg: d.dmg, // 스테이지 특징(결정 083)은 적 구성만 바꾼다
  };
}
const stage = () => curStage;
/** 이 스테이지 성질의 적 구성(성질 없으면 기본) */
const tfx = () => (curDef.trait ? R.TRAIT_FX[curDef.trait] : R.NO_TRAIT);
let traitOverride: R.Trait | '' | undefined; // 개발 훅: 스테이지 특징 끄고 켜기
let ruleOverride: R.Rule | '' | undefined; // 개발 훅에서 규칙 켜고 끄기 비교용
const rule = () => (ruleOverride === undefined ? CH.CHAPTERS[curDef.chapter].rule : ruleOverride || undefined); // 장 규칙(결정 078)
/** 장 모델(적·소품)을 불러와 끼운다. 이미 불러온 장은 바로 */
let stageReady: Promise<void> = Promise.resolve();
function enterStage(no: number) {
  stageIdx = no;
  curDef = defOf(no);
  if (traitOverride !== undefined) curDef = { ...curDef, trait: traitOverride || undefined }; // 개발 훅 비교용
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
type Enemy = { x: number; z: number; y: number; vy: number; kx: number; kz: number; hp: number; big: boolean; out: boolean; flash: number; hop: number; age: number; bladeCd: number; kind: R.Kind; pct?: number; stag?: number; v?: number; by?: Src; byT?: number; blk?: number; bnc?: number }; // blk: 가려서 안 맞음 표시, bnc: 풍선이 무른 타를 튕겨 냄 표시(그리기용)
/** 떨어뜨린 원인(결정 083): 마지막으로 친 것. 2초 지나면 '그 밖' */
type Src = 'main' | 'log' | 'pumpkin' | 'sweep' | 'other';
/** 주무기 한 타(덧붙는 타격은 in 초 뒤 실행). 디자인: kind로 그릴 모양을 고른다 */
type Strike = {
  in: number; kind: 'main' | 'tap' | 'back' | 'whirl' | 'shock' | 'full' | 'after' | 'double' | 'spin' | 'ring' | 'fork'; shape: R.WeaponShape;
  yaw: number; half: number; rad: number; dmg: number; knock: number; dmgHalf: number; lift: number; extra: boolean; flat: boolean;
  cx: number; cz: number; core: number; coreDmg: number; width: number; pierce: number; // 원: 가운데 자리·가운데 피해 반지름, 직선: 폭·관통 수
};
type Drop = { x: number; z: number; y: number; type: R.DropId; life: number };
type Helper = { x: number; z: number; t: number; cd: number; face: number; hop: number };
type Gadget = { x: number; z: number; hx: number; hz: number; cd: number; squash: number; vx: number; vz: number; left: number; gone: number; on: number };
type Log = { x: number; z: number; dx: number; dz: number; left: number; roll: number; warn: number; hit: Set<Enemy> }; // warn: 남은 예고 시간(0보다 크면 아직 출발 전, 결정 083)
type Pumpkin = { x0: number; z0: number; x: number; z: number; tx: number; tz: number; t: number; y: number };
type Bit = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: THREE.Color };
/** 이번 판 주무기: 「추천 무기 자동」(meta.autoWeapon)이 켜져 있으면 추천 무기(잠겼으면 망치), 꺼져 있으면 고른 무기(결정 083·085) */
// 무기 시트·「바로 쓰기」로 직접 고른 무기: 화살표로 스테이지를 바꾸거나 다시 고르기 전까지 유지(한 번 더·처음으로·다음 섬에도), 앱을 다시 켜면 잊음(결정 088 보완)
let manualPick: MT.WeaponId | null = null;
let trialWeapon: MT.WeaponId | null = null; // 광고로 이번 판만 빌린 잠긴 추천 무기(결정 093), 판이 시작되면 비운다
const runWeapon = (): MT.WeaponId => trialWeapon ?? WL.pickRunWeapon(manualPick, meta.autoWeapon, CH.recommendedWeapon(curDef), meta.weapon, meta.cleared);
const newGame = (w = runWeapon()) => ({
  t: 0, px: 0, pz: 0, face: 0, hp: MT.maxHp(meta), maxHp: MT.maxHp(meta), inv: 0, level: 0, xp: 0, picks: MT.startPicks(meta.perks.cards),
  charge: 0, kills: 0, falls: 0, rerolls: MT.rerolls(meta.perks.cards), revived: false, continued: false, adRerolled: false,
  lv: R.startLevels(), enemies: [] as Enemy[], logs: [] as Log[], pumpkins: [] as Pumpkin[], bits: [] as Bit[],
  hammerCd: 0.5, logCd: 2, pumpkinCd: 1.5, swingT: 1, swingYaw: 0, spawnCd: 0.6, shake: 0, stop: 0, ringT: 1, ringR: 1, moving: false,
  vx: 0, vz: 0, bt: 0, bonusDone: false, bonusFalls: 0, // 박치기 보너스
  swings: 0, misses: 0, sweepLock: 0, helperUsed: false,
  gadgets: [] as Gadget[], weather: '' as R.Weather | '', wt: 0, wx: 0, wz: 0, weatherN: 0,
  need: R.xpNeed(0), xpRecent: 0, xpTot: 0, calm: 0, // 카드 간격·보너스 뒤 숨 고르기(결정 078)
  opened: 0, slams: 0, done: [] as string[], // 미션(결정 060)
  bossSpawned: false, bossDown: false, endIn: 0, extra: 0, strikes: 0, juggles: 0, // 왕좀비·STRIKE·저글(결정 057·058)
  drops: [] as Drop[], dropCd: R.FIRST_DROP as number, golden: 0, helper: null as Helper | null,
  isl: stage().r, chain: 0, chainT: 0, // 이어서 떨어뜨린 수와 남은 시간
  // 주무기(결정 083·086): wPhase 준비/후딜 단계와 남은 시간 wT, 겨눈 방향 wYaw, 숙련 값 wMods. swing*는 마지막 타의 모양(그리기용)
  weapon: w, wMods: R.masteryMods(w, R.masteryLevel(meta.mastery[w])), wSwings: 0, queue: [] as Strike[], gusts: [] as { x: number; z: number; t: number }[],
  wPhase: 'idle' as 'idle' | 'windup' | 'recovery', wT: 0, wYaw: 0, hurts: 0, hurtsInWind: 0, ringAcc: 0, laneA: rnd(0, Math.PI), // laneA: 행렬 성질의 두 방향
  swingKind: 'main' as Strike['kind'], swingShape: R.WEAPON_STATS[w].shape, swingArc: R.weaponArc(w, 1), swingRad: R.weaponRadius(w, 1) * MT.hammerMul(meta),
  fallBy: { main: 0, log: 0, pumpkin: 0, sweep: 0, other: 0 } as Record<Src, number>,
  airToastT: -9, homerT: -9, // 「공중 콤보!」·「홈런!」 글자는 1.5초에 한 번
  // 그리기 전용 잔상 기록(결정 088, 판 규칙과 무관): 원 충격파·금 간 자국·직선 띠·쌍검 잔상·부채 바람·덩어리 자리
  vis: { shockT: 1, shockX: 0, shockZ: 0, shockR: 1, crackT: 1, crackX: 0, crackZ: 0, crackR: 1, twinTap: 0, windT: 1, windX: 0, windZ: 0, windYaw: 0, windR: 1, windArc: 1,
    lines: [] as { x: number; z: number; yaw: number; len: number; w: number; t: number }[], slashes: [] as { x: number; z: number; yaw: number; r: number; hand: number; t: number }[],
    packs: [] as { x: number; z: number; t: number }[] },
});
let g = newGame();
let mode: 'title' | 'play' | 'bonusIntro' | 'bonus' | 'pick' | 'over' | 'pause' = 'title';
const eScale = (e: Enemy) => (e.kind === 'boss' ? R.BOSS_SCALE * (curDef.finale ? 1.25 : 1) : e.big ? 1.5 : 1);
const eRadius = (e: Enemy) => 0.45 * eScale(e);
/** 밀리는 정도: 왕좀비는 맞을수록(%) 더 멀리 */
const knockOf = (e: Enemy) => (e.kind === 'boss' ? R.bossKnock(e.pct ?? 0) : R.KIND_KNOCK[e.kind] * tfx().weight); // 단단 성질: 무거워 덜 밀림
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
/** 나올 자리(각도). 행렬 성질은 마주 보는 두 방향에서만 */
function spawnAngle() {
  if (tfx().lanes) return g.laneA + (Math.random() < 0.5 ? 0 : Math.PI) + rnd(-0.06, 0.06);
  let a = 0;
  for (let tries = 0; tries < 6; tries++) { // 주인공 코앞에서는 올라오지 않게
    a = rnd(0, Math.PI * 2);
    if (Math.hypot(Math.cos(a) * g.isl - g.px, Math.sin(a) * g.isl - g.pz) > 5) break;
  }
  return a;
}
/** 떼 성질: 주인공 둘레 RING_R칸에 n마리를 고르게(섬 안으로 당김) */
function spawnRing(n: number) {
  const a0 = rnd(0, Math.PI * 2);
  for (let k = 0; k < n && g.enemies.length < R.MAX_ENEMIES; k++) {
    spawn();
    const e = g.enemies[g.enemies.length - 1], a = a0 + (k / n) * Math.PI * 2;
    let x = g.px + Math.cos(a) * R.RING_R, z = g.pz + Math.sin(a) * R.RING_R;
    const o = Math.hypot(x, z), lim = g.isl - 0.8;
    if (o > lim) { x *= lim / o; z *= lim / o; }
    e.x = x;
    e.z = z;
    burst(x, z, C_DIRT, 2); // 땅에서 솟아오르는 흙
  }
}
/** 뭉침 성질: 주인공에게서 PACK_R칸 떨어진 한 점에 n마리가 덩어리로 떨어진다 */
function spawnPack(n: number) {
  const a = rnd(0, Math.PI * 2), lim = g.isl - 1.5;
  let cx = g.px + Math.cos(a) * R.PACK_R, cz = g.pz + Math.sin(a) * R.PACK_R;
  const o = Math.hypot(cx, cz);
  if (o > lim) { cx *= lim / o; cz *= lim / o; }
  g.vis.packs.push({ x: cx, z: cz, t: 0 }); // 덩어리가 떨어지는 자리(그리기용)
  for (let k = 0; k < n && g.enemies.length < R.MAX_ENEMIES; k++) {
    spawn();
    const e = g.enemies[g.enemies.length - 1], r = Math.sqrt(Math.random()) * R.PACK_SPREAD, b = rnd(0, Math.PI * 2);
    e.x = cx + Math.cos(b) * r;
    e.z = cz + Math.sin(b) * r;
  }
}
function spawn() {
  const fx = tfx(), a = spawnAngle();
  const st = stage(), big = Math.random() < Math.min(0.6, R.bigChance(g.t) * st.big), kind = R.pickKind(g.t, big, Math.random, curDef.trait);
  const d = g.isl - 0.8 - (fx.lanes ? rnd(0, 1.4) : 0); // 행렬은 앞뒤로도 조금 흩어 겹치지 않게
  g.enemies.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 0, vy: 0, kx: 0, kz: 0, hp: R.enemyHp(g.t, big) * st.hp * R.KIND_HP[kind] * fx.hp * (big ? 1 : fx.smallHp), big, out: false, flash: 0, hop: rnd(0, 6), age: 0, bladeCd: 0, kind, v: Math.random() < 0.5 ? 1 : 0 });
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
  if (g.sweepLock <= 0) g.charge = Math.min(R.sweepCost(g.lv.sweep), g.charge + charge * MT.chargeMul(meta) * (g.weapon === 'hammer' ? R.HAMMER_SLAM.charge * g.wMods.charge : 1)); // 쾅! 망치(결정 085)
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
/** extra: 덧붙는 타격·뿅망치 둘째 타(공중 콤보로 세지 않는다). lift: 세기와 상관없이 이만큼 띄운다(0이면 세게 맞을 때만) */
function hit(i: number, dmg: number, kx: number, kz: number, src: Src = 'other', extra = false, lift = 0) {
  const e = g.enemies[i], main = src === 'main', sub = src === 'log' || src === 'pumpkin';
  if (e.kind === 'shield' && main && !R.WEAPON_STATS[g.weapon].ignoreShield) { const b = tfx().block; dmg *= b; kx *= b; kz *= b; } // 정면 주무기는 방패가 막는다(프라이팬은 무시)
  const fx = tfx();
  if (fx.pop && e.kind === 'balloon') { // 풍선 많은 섬: 첫 타엔 풍선만 터진다(피해 없음, 밀리기는 함) → 연타가 유리. 무른 타는 튕겨 나가 아무 일 없음
    if (Math.hypot(kx, kz) >= R.POP_MIN) e.kind = '';
    else { kx = kz = 0; e.bnc = 0.3; }
    dmg = 0;
  }
  if (e.big && e.kind !== 'boss' && Math.hypot(kx, kz) < fx.brace) { kx *= fx.braceKeep; kz *= fx.braceKeep; } // 무거운 섬: 약한 타격엔 큰 적이 버틴다 → 넉백 큰 무기가 유리
  e.by = src;
  e.byT = g.t;
  e.hp -= dmg;
  e.flash = 0.1;
  sfx.bonk();
  if (e.kind === 'boss' && e.age >= 2.5) { // 왕좀비: 맞을수록 %가 오르고 잠깐 휘청
    e.pct = (e.pct ?? 0) + dmg * R.BOSS_PCT_PER_DMG;
    e.stag = R.BOSS_STAGGER;
  }
  let km = R.knockMul(g.lv.knock) * MT.shoveMul(meta) * knockOf(e) * (e.kind === 'boss' && e.age < 2.5 ? 0 : 1); // 왕좀비는 등장 2.5초 동안 안 밀림
  if (sub) km *= R.SUB_KNOCK * (e.kind === 'boss' ? R.BOSS_SUB_KNOCK : 1);
  if (main && !lift && e.kind !== 'boss') km *= tfx().anchor; // 뭉침 성질: 바닥에 붙은 덩어리는 띄워 치는 타(대형 해머·방망이)에만 제대로 밀린다
  if (main && R.WEAPON_STATS[g.weapon].windPush && e.kind !== 'boss') km /= tfx().weight; // 부채 바람은 무게와 상관없이
  if (main && e.kind === 'boss') km *= R.WEAPON_STATS[g.weapon].boss; // 방망이·대형 해머는 왕좀비에게 덜(결정 072처럼 너무 빨리 떨구지 않게)
  if (!extra && e.y > 0.3 && e.kind !== 'boss') { // 공중에 뜬 적을 또 치면 더 세게
    km *= R.JUGGLE_KNOCK;
    g.juggles++;
    if (g.t - g.airToastT > 1.5) { g.airToastT = g.t; toast(L('공중 콤보!', 'Air combo!')); }
  }
  e.kx += kx * km;
  e.kz += kz * km;
  const low = rule() === 'lowGrav';
  const up = low ? R.LOW_GRAV_LIFT : R.LIFT;
  if (sub) lift = Math.max(lift, up);
  if (e.kind !== 'boss' && e.y <= 0.01 && (lift || Math.hypot(kx, kz) * km > (low ? R.LOW_GRAV_KNOCK : 7))) e.vy = Math.max(lift, up); // 세게 맞으면 살짝 떠오른다
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
  toast(L('왕좀비 등장! 떨어뜨리면 보너스 코인', 'King zombie! Knock it off for bonus coins'));
  sfx.rumble();
  g.shake = 0.8;
}

let lastFallSfx = 0;
function fall(e: Enemy, byCrumble = false) {
  e.out = true;
  e.vy = 4; // 살짝 튀었다가 떨어진다
  g.falls++;
  g.fallBy[byCrumble || !e.by || g.t - (e.byT ?? 0) > 2 ? 'other' : e.by]++;
  if (mode === 'bonus') g.bonusFalls++;
  g.chain = g.chainT > 0 ? g.chain + 1 : 1;
  g.chainT = 1.2;
  const homer = g.weapon === 'bat' && e.by === 'main' && g.t - (e.byT ?? 0) < 1;
  if (!byCrumble) considerShot(e, homer);
  if (g.chain === R.STRIKE_CHAIN) { g.extra += R.STRIKE_COINS; g.strikes++; sfx.fanfare(); }
  if (e.kind === 'bomb') blast(e.x, e.z);
  if (homer && g.t - g.homerT > 1.5) { g.homerT = g.t; toast(L('홈런!', 'Home run!')); }
  if (e.kind === 'boss' && !g.bossDown) { // 왕좀비를 떨어뜨리면 큰 보상, 판은 끝까지(결정 094)
    g.bossDown = true;
    g.extra += R.bossCoins(curDef.chapter);
    g.stop = 0.45;
    g.shake = 1.2;
    toast(L(`왕좀비를 떨어뜨렸다! +${R.bossCoins(curDef.chapter)} 코인`, `King zombie down! +${R.bossCoins(curDef.chapter)} coins`));
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
  g.hurts++;
  if (g.wPhase === 'windup') g.hurtsInWind++; // 준비 중 맞은 횟수(대형 해머 준비가 답답한지 보는 봇 지표)
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
  const rad = R.sweepRadius(g.lv.sweep) * (g.weapon === 'hammer' ? R.HAMMER_SLAM.radius : 1);
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];
    const dx = e.x - g.px, dz = e.z - g.pz, d = Math.hypot(dx, dz) || 1;
    if (e.out || d > rad) continue;
    const k = (24 * (1 - (d / rad) * 0.5)) / (e.big ? 1.5 : 1);
    hit(i, 6, (dx / d) * k, (dz / d) * k, 'sweep');
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
  g.spawnCd = R.spawnInterval(g.t, curDef.gap) / stage().spawn / R.calmSpawn(g.calm); // 보너스 중 줄어든 대기를 되돌려 끝나자마자 몰려오지 않게
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
/** 주무기 한 타: 모양(부채꼴·원·직선) 안의 적을 친다. 평행(flat) 무기는 모두 휘두른 쪽으로 민다. 맞힌 수를 돌려준다 */
function strike(s: Strike) {
  const es = g.enemies, fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), circle = s.shape === 'circle';
  const ox = circle ? s.cx : g.px, oz = circle ? s.cz : g.pz;
  const pick: [number, number][] = []; // [적 번호, 피해]
  const cover = tfx().cover;
  /** 행렬·뭉침: 주인공과 이 적 사이 좁은 길에 다른 적이 있으면 가려서 안 맞는다(관통하는 직선만 뒤까지) */
  const hidden = (e: Enemy) => {
    const ex = e.x - g.px, ez = e.z - g.pz, d = Math.hypot(ex, ez) || 1;
    return es.some((o) => {
      if (o === e || o.out) return false;
      const qx = o.x - g.px, qz = o.z - g.pz, along = (qx * ex + qz * ez) / d;
      return along > 0.3 && along < d - 0.3 && Math.abs(qx * ez - qz * ex) / d < cover;
    });
  };
  if (s.shape === 'line') { // 직선: 가까운 순서로 pierce마리까지, 왕좀비에서 멈춤
    const c: [number, number][] = [];
    es.forEach((e, i) => {
      const rx = e.x - ox, rz = e.z - oz, along = rx * fx + rz * fz, side = Math.abs(rx * fz - rz * fx);
      if (e.out || along <= -eRadius(e) || along > s.rad + eRadius(e) || side > s.width / 2 + eRadius(e)) return;
      if (tfx().clump && hidden(e)) e.blk = 0.35; // 가린 적은 회색으로 보여 안 맞는 이유가 보이게
      else c.push([i, along]);
    });
    c.sort((a, b) => a[1] - b[1]);
    for (const [i] of c.slice(0, s.pierce)) { pick.push([i, s.dmg]); if (es[i].kind === 'boss') break; }
  } else
    for (let i = 0; i < es.length; i++) {
      const e = es[i], dx = e.x - ox, dz = e.z - oz, d = Math.hypot(dx, dz);
      if (e.out || d > s.rad + eRadius(e)) continue;
      if (cover > 0 && !circle && hidden(e)) { // 원 충격파는 위에서 내려찍어 덩어리 안쪽까지
        const a = Math.atan2(dx, dz) - s.yaw;
        if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) <= s.half) e.blk = 0.35; // 부채꼴 안인데 가려서 안 맞음(회색)
        continue;
      }
      if (circle) { pick.push([i, d <= s.core ? s.coreDmg : s.dmg]); continue; }
      let da = Math.atan2(dx, dz) - s.yaw;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) <= s.half) pick.push([i, Math.abs(da) <= s.dmgHalf ? s.dmg : 0]);
    }
  // hit()이 죽은 적을 뒤에서 당겨 지우므로 큰 번호부터 친다
  pick.sort((a, b) => b[0] - a[0]);
  for (const [i, dmg] of pick) {
    const e = es[i], hx = circle ? g.px : ox, hz = circle ? g.pz : oz; // 원도 주인공 바깥쪽으로 민다(가운데 기준이면 주인공 쪽으로 밀려 왔다)
    const dx = e.x - hx, dz = e.z - hz, d = Math.hypot(dx, dz) || 1;
    const ux = s.flat || s.shape === 'line' ? fx : dx / d, uz = s.flat || s.shape === 'line' ? fz : dz / d;
    hit(i, dmg, ux * s.knock, uz * s.knock, 'main', s.extra, s.lift);
  }
  g.swingT = 0;
  g.swingYaw = s.yaw;
  g.swingKind = s.kind;
  g.swingShape = s.shape;
  g.swingArc = s.shape === 'fan' ? s.half * 2 : Math.PI * 2;
  g.swingRad = s.rad;
  showStrike(s);
  return pick.length;
}
/** 타격 순간: 무기 표·숙련대로 첫 타를 치고 다음 타·덧붙는 타격(Lv3·Lv5)을 예약한다 */
function swingNow(yaw: number) {
  const w = g.weapon, ws = R.WEAPON_STATS[w], lv = g.lv.hammer, m = g.wMods, gold = g.golden > 0, big = MT.hammerMul(meta);
  const rad = R.weaponRadius(w, lv, m) * big + (gold ? 1.2 : 0), half = R.weaponArc(w, lv, m) / 2, gap = R.weaponGap(w, lv);
  const dmg = ws.damage * (gold ? 24 / 14 : 1), km = (gold ? 12 / 9 : 1) * m.knock;
  const A = lv >= R.WEAPON_LV_A || (m.star && lv >= 2), B = lv >= R.WEAPON_LV_B; // ★: 동작 1이 Lv2부터
  const knocks = ws.knocks.map((k, i, a) => k * km * (a.length > 1 && i === a.length - 1 ? m.lastKnock : 1));
  if (w === 'squeaky' && A) knocks[1] *= R.SQUEAKY_LV3_KNOCK;
  const at = (ws.at ?? 0) * big, n = ++g.wSwings, last = gap * (ws.knocks.length - 1);
  const base: Strike = {
    in: 0, kind: 'main', shape: ws.shape, yaw, half, rad, dmg, knock: knocks[0], dmgHalf: half, lift: ws.lift, extra: false, flat: !!ws.flat,
    cx: g.px + Math.sin(yaw) * at, cz: g.pz + Math.cos(yaw) * at, core: (ws.core ?? 0) * big, coreDmg: (ws.coreDamage ?? 0) * (gold ? 24 / 14 : 1),
    width: (ws.width ?? 0) + (ws.widthLv ?? 0) * (lv - 1), pierce: (ws.pierce ?? 0) + m.pierce + (ws.pierceLv ?? 0) * (lv - 1),
  };
  let first = base;
  const later = (o: Partial<Strike>) => g.queue.push({ ...base, dmg: 0, extra: true, ...o });
  for (let h = 1; h < knocks.length; h++) later({ in: gap * h, kind: 'tap', dmg, knock: knocks[h] }); // 다음 타: 피해 있음, 공중 콤보로 세지 않음
  if (w === 'hammer') {
    if (B && n % R.HAMMER_WHIRL.every === 0) first = { ...base, kind: 'whirl', half: Math.PI, rad: rad * R.HAMMER_WHIRL.r, knock: knocks[0] * R.HAMMER_WHIRL.knock };
    else if (A) later({ in: R.HAMMER_BACK.delay, kind: 'back', yaw: yaw + Math.PI, knock: knocks[0] * R.HAMMER_BACK.knock });
  } else if (w === 'squeaky') {
    if (B) later({ in: last, kind: 'shock', shape: 'fan', half: Math.PI, rad: R.SQUEAKY_SHOCK_R, knock: R.SQUEAKY_SHOCK_KNOCK });
  } else if (w === 'sledge') {
    if (A) later({ in: R.SLEDGE_AFTER.delay, kind: 'after', rad: rad * R.SLEDGE_AFTER.r, core: 0, knock: knocks[0] * R.SLEDGE_AFTER.knock });
    if (B && n % R.SLEDGE_DOUBLE.every === 0) later({ in: 0.15, kind: 'double', knock: knocks[0] * R.SLEDGE_DOUBLE.knock });
  } else if (w === 'twin') {
    if (A) later({ in: gap * knocks.length, kind: 'tap', knock: R.TWIN_FOURTH * km });
    if (B) later({ in: gap * (knocks.length - (A ? 0 : 1)), kind: 'spin', half: Math.PI, knock: R.TWIN_SPIN * km });
  } else if (w === 'pan') {
    if (B) first = { ...base, lift: R.PAN_FLIP_LIFT };
    if (A) strike({ ...base, kind: 'back', dmg: 0, extra: true, yaw: yaw + Math.PI, half: R.PAN_BACK.arc / 2, knock: knocks[0] * R.PAN_BACK.knock }); // 앞면보다 먼저: 마지막 휘두름 모양은 앞면
  } else if (w === 'bat') {
    if (A && n % R.BAT_FULL.every === 0) { first = { ...base, kind: 'full', knock: knocks[0] * R.BAT_FULL.knock }; g.shake = Math.max(g.shake, R.BAT_FULL.shake); }
    if (B) later({ in: R.BAT_BACK.delay, kind: 'back', yaw: yaw + Math.PI, knock: knocks[0] * R.BAT_BACK.knock });
  } else if (w === 'pole') {
    if (A) later({ in: 0.05, kind: 'ring', shape: 'circle', cx: g.px + Math.sin(yaw) * rad, cz: g.pz + Math.cos(yaw) * rad, rad: R.POLE_RING.r, core: 0, knock: R.POLE_RING.knock * km });
    if (B && n % R.POLE_FORK.every === 0)
      for (const sd of [-1, 1]) later({ in: 0.02, kind: 'fork', yaw: yaw + sd * R.POLE_FORK.spread });
  } else {
    if (B) first = { ...base, lift: R.LIFT };
    if (A) g.gusts.push({ x: g.px + Math.sin(yaw) * rad, z: g.pz + Math.cos(yaw) * rad, t: R.FAN_GUST.t });
  }
  const hits = strike(first);
  if (stage().gadget === 'barrel')
    for (const b of g.gadgets) { // 휘두른 자리의 통은 굴러간다
      const dx = b.x - g.px, dz = b.z - g.pz, d = Math.hypot(dx, dz) || 1;
      let da = Math.atan2(dx, dz) - yaw;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (b.gone > 0 || b.left > 0 || d > at + rad + 0.5 || Math.abs(da) > Math.max(first.half, 0.6)) continue;
      b.vx = (dx / d) * R.BARREL_SPEED;
      b.vz = (dz / d) * R.BARREL_SPEED;
      b.left = R.BARREL_RANGE;
      sfx.whack();
    }
  g.swings++;
  if (!hits) { g.misses++; g.hammerCd = Math.min(g.hammerCd, 0.2); } // 헛치면 금방 다시 휘두른다(후딜은 그대로)
  hits ? sfx.whack() : sfx.swish();
}
/** 지금 휘두르기 단계의 이동 속도 배율(준비·후딜 중 느려짐) */
const swingMove = () => { const ws = R.WEAPON_STATS[g.weapon]; return g.wPhase === 'windup' ? ws.windMove : g.wPhase === 'recovery' ? ws.recMove : 1; };
/** 무기 사거리(원 무기는 앞자리 거리 + 반지름) */
function weaponReach() {
  const w = g.weapon, ws = R.WEAPON_STATS[w], big = MT.hammerMul(meta);
  return R.weaponRadius(w, g.lv.hammer, g.wMods) * big + (g.golden > 0 ? 1.2 : 0) + (ws.at ?? 0) * big;
}
/** 준비가 끝나면 친다: 타격(타 간격 포함)·후딜 동안 recovery, 그 뒤 쉼 */
function swingStrike() {
  const w = g.weapon, ws = R.WEAPON_STATS[w], lv = g.lv.hammer;
  if (ws.aim) { const t = nearest(weaponReach() + 0.7); if (t) g.wYaw = g.face = Math.atan2(t.x - g.px, t.z - g.pz); } // 연타 무기는 방향을 고정하지 않는다
  g.wPhase = 'recovery';
  g.wT = R.weaponGap(w, lv) * (ws.knocks.length - 1) + R.weaponRec(w, lv, g.wMods);
  g.hammerCd = g.wT + R.weaponRest(w, lv, g.wMods) * (g.golden > 0 ? 0.35 : 1); // 번개 보급은 쉼만 줄인다
  swingNow(g.wYaw);
}
function weapons(dt: number) {
  const es = g.enemies, w = g.weapon, ws = R.WEAPON_STATS[w], lv = g.lv.hammer;
  // 주무기(결정 083·086): 무기 표대로 준비(wind) → 타격 → 후딜(rec) → 쉼(rest). 다음 타·Lv3·Lv5 덧붙는 타격은 예약해 뒀다 친다
  for (let k = g.queue.length - 1; k >= 0; k--) {
    const q = g.queue[k];
    if ((q.in -= dt) > 0) continue;
    g.queue.splice(k, 1);
    if (strike(q)) sfx.whack();
  }
  for (let k = g.gusts.length - 1; k >= 0; k--) { // 부채 Lv3 작은 회오리: 지나는 적을 바깥으로
    const u = g.gusts[k];
    if ((u.t -= dt) <= 0) { g.gusts.splice(k, 1); continue; }
    for (let i = es.length - 1; i >= 0; i--) {
      const e = es[i], dx = e.x - u.x, dz = e.z - u.z, d = Math.hypot(dx, dz) || 1, o = Math.hypot(e.x, e.z) || 1;
      if (e.out || e.bladeCd > 0 || d > R.FAN_GUST.r + eRadius(e)) continue;
      e.bladeCd = 0.4;
      hit(i, 0, (e.x / o) * R.FAN_GUST.knock, (e.z / o) * R.FAN_GUST.knock, 'main', true);
    }
  }
  g.hammerCd -= dt;
  if (g.wPhase !== 'idle' && (g.wT -= dt) <= 0) {
    if (g.wPhase === 'windup') swingStrike();
    else g.wPhase = 'idle';
  }
  // 실제로 맞는 거리(무기 길이 + 적 몸)에 들어왔을 때만 준비를 시작한다. 준비가 긴 무기는 0.5칸 앞에서(걸어오는 적을 미리 노림)
  const wind = R.weaponWind(w, lv, g.wMods), reach = weaponReach() + (ws.wind >= R.WIND_REACH ? 0.5 : 0);
  const near = g.hammerCd <= 0 && g.wPhase === 'idle' ? nearest(reach + 0.7) : null;
  if (near && Math.hypot(near.x - g.px, near.z - g.pz) <= reach + eRadius(near)) {
    g.wYaw = g.face = Math.atan2(near.x - g.px, near.z - g.pz); // 방향은 준비 시작 때 고정
    g.wPhase = 'windup';
    g.wT = wind; // 준비 중 맞아도 취소되지 않는다
    if (wind <= 0) swingStrike();
  }
  // 통나무: 주인공 근처를 지나가게 섬 끝에서 굴려 보낸다
  if (g.lv.log) {
    g.logCd -= dt;
    if (g.logCd <= 0) {
      g.logCd = R.logInterval(g.lv.log);
      for (let k = 0; k < R.logCount(g.lv.log); k++) {
        const a = rnd(0, Math.PI * 2), dx = Math.sin(a), dz = Math.cos(a), off = rnd(-1.5, 1.5) + k * 3;
        const sx = g.px - dx * (g.isl + 2) + dz * off, sz = g.pz - dz * (g.isl + 2) - dx * off;
        g.logs.push({ x: sx, z: sz, dx, dz, left: (g.isl + 2) * 2 + 4, roll: 0, warn: R.LOG_WARN, hit: new Set() });
      }
      sfx.creak();
    }
  }
  for (let k = g.logs.length - 1; k >= 0; k--) {
    const L1 = g.logs[k], step = 10 * dt;
    if (L1.warn > 0) { L1.warn -= dt; continue; } // 예고 중(디자인이 지나갈 줄을 그린다)
    L1.x += L1.dx * step;
    L1.z += L1.dz * step;
    L1.roll += step / 0.36;
    if ((L1.left -= step) <= 0) { g.logs.splice(k, 1); continue; }
    for (let i = es.length - 1; i >= 0; i--) {
      const e = es[i], rx = e.x - L1.x, rz = e.z - L1.z;
      const along = rx * L1.dx + rz * L1.dz, side = rx * L1.dz - rz * L1.dx;
      if (e.out || L1.hit.has(e) || Math.abs(along) > 0.4 + eRadius(e) || Math.abs(side) > 1.7) continue;
      L1.hit.add(e);
      hit(i, 8, L1.dx * 13, L1.dz * 13, 'log');
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
      hit(i, 12, (dx / d) * kk, (dz / d) * kk, 'pumpkin');
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
  heart: L('회복!', 'Heal!'), charge: L('쾅! 충전!', 'Slam charged!'), golden: L('번개 무기!', 'Lightning weapon!'), helper: L('묘지기가 도와줍니다!', 'The keeper joins you!'),
};
function openDrop(d: Drop) {
  g.opened++;
  if (d.type === 'heart') g.hp = Math.min(g.maxHp, g.hp + R.HEAL);
  else if (d.type === 'charge') g.charge = R.sweepCost(g.lv.sweep);
  else if (d.type === 'golden') g.golden = R.GOLDEN_SECONDS;
  else g.helper = { x: g.px + 1.2, z: g.pz, t: R.HELPER_SECONDS, cd: 0.4, face: 0, hop: 0 };
  burst(d.x, d.z, new THREE.Color(DROP_COLOR[d.type]), 14);
  const wn = WL.UI[g.weapon].name;
  toast(d.type === 'golden' ? L(`번개 ${wn[0]}!`, `Lightning ${wn[1]}!`) : DROP_NAME[d.type]); // 「번개 ○○」(결정 082)
  sfx.coins();
  sfx.chime();
  sfx.buzz(15);
}
function supplies(dt: number) {
  g.dropCd -= dt;
  if (g.dropCd <= 0 && g.drops.length < dropViews.length) {
    g.dropCd = R.DROP_INTERVAL;
    const a = rnd(0, Math.PI * 2), r = rnd(0.15, 0.65) * g.isl;
    g.drops.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: 12, type: R.pickDrop(g.hp >= g.maxHp, Math.random, g.helperUsed, g.hp < g.maxHp / 2), life: R.DROP_LIFE });
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
    if (g.t >= R.RUN_SECONDS) return end(true);
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
    const sp = R.moveSpeed(g.lv.speed) * MT.speedMul(meta) * swingMove();
    g.px += mx * sp * dt;
    g.pz += mz * sp * dt;
    g.face = Math.atan2(mx, mz);
    const d = Math.hypot(g.px, g.pz), lim = g.isl - 0.7;
    if (d > lim) { g.px *= lim / d; g.pz *= lim / d; }
  }

  // 적이 올라온다
  g.spawnCd -= dt;
  if (!bonus && g.spawnCd <= 0) {
    const ring = tfx().ring, pk = tfx().pack; // 덩어리 성질: 한 번에 pk배, 간격도 pk배(총 수는 같음)
    g.spawnCd = (R.spawnInterval(g.t, curDef.gap) / stage().spawn / R.calmSpawn(g.calm)) * pk;
    if (ring) { // 떼 성질: 같은 수를 ring마리씩 모아 주인공 둘레에 한꺼번에 솟아오르게
      g.ringAcc += R.spawnBatch(g.t) * stage().spawn;
      if (g.ringAcc >= ring) { g.ringAcc -= ring; spawnRing(ring); }
    } else if (pk > 1) spawnPack(Math.round(R.spawnBatch(g.t) * stage().spawn * pk));
    else for (let i = Math.max(1, Math.round(R.spawnBatch(g.t) * stage().spawn)); i > 0 && g.enemies.length < R.MAX_ENEMIES; i--) spawn(); // max 1: 배수 0.5 미만 섬(풍선 섬)도 처음 30초에 0마리가 되지 않게(결정 091)
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
    const sp = bonus || (e.stag ?? 0) > 0 ? 0 : (e.kind === 'boss' ? 0.9 : R.enemySpeed(g.t, e.big) * (e.kind === 'balloon' ? tfx().balloonSpeed : e.big ? 1 : tfx().smallSpeed)) * stage().speed;
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
      if (ka > 3 && ka > kb * 1.5) { const t = 0.7 * knockOf(b); b.kx += a.kx * t; b.kz += a.kz * t; b.by = a.by; b.byT = a.byT; a.kx *= 0.55; a.kz *= 0.55; b.flash = 0.1; }
      else if (kb > 3 && kb > ka * 1.5) { const t = 0.7 * knockOf(a); a.kx += b.kx * t; a.kz += b.kz * t; a.by = b.by; a.byT = b.byT; b.kx *= 0.55; b.kz *= 0.55; a.flash = 0.1; }
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
  hero.visible = g.inv <= 0 || Math.floor(g.inv * 14) % 2 === 0;

  let ns = 0, ns2 = 0, nb = 0, nBal = 0, nBomb = 0, nSh = 0, nHel = 0;
  const fxT = tfx(), heavyLook = fxT.weight < 1; // 단단 성질: 투구 쓴 진한 색 적
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
    // 성질 연출(결정 088): 떼는 땅에서 솟고, 뭉침은 하늘에서 떨어진다(그림만, 판정 자리는 그대로)
    const rise = fxT.ring && e.age < 0.3 ? -(0.3 - e.age) * 3.5 : fxT.pack > 1 && e.age < 0.45 ? (0.45 - e.age) ** 2 * 30 : 0;
    const hop = e.out ? 0 : Math.abs(Math.sin(e.hop)), es = eScale(e), sc = es * Math.min(1, e.age * 4), ey = e.y + rise + hop * 0.22;
    const top = (e.big ? 1.05 * 1.5 : 1.05) + e.y + rise;
    e.bnc = (e.bnc ?? 0) - dt;
    e.blk = (e.blk ?? 0) - dt;
    const wob = e.bnc > 0 ? Math.sin(now * 0.06) * e.bnc : 0; // 무른 타를 튕겨 낸 풍선이 흔들린다
    if (e.kind === 'balloon') put(balloonMesh, nBal++, e.x + wob, top + 0.55, e.z, 0, 1 + Math.abs(wob), 1.15 - Math.abs(wob), 1);
    if (e.kind === 'bomb') put(bombMesh, nBomb++, e.x, top + 0.12, e.z, yaw);
    if (e.kind === 'shield') put(shieldMesh, nSh++, e.x + Math.sin(yaw) * 0.5 * es, ey + 0.5 * es, e.z + Math.cos(yaw) * 0.5 * es, yaw, es / 1.5); // 몸 크기에 맞춰 손 앞에(작은 적의 방패가 떠 보이던 것)
    if (heavyLook && !e.out) put(helmetMesh, nHel++, e.x, top - 0.2 * es + hop * 0.22, e.z, yaw, sc);
    const mesh = e.big ? bigMesh : e.v ? small2Mesh : smallMesh, i = e.big ? nb++ : e.v ? ns2++ : ns++;
    if (shotPend?.e === e) { shotPend.mesh = mesh; shotPend.idx = i; } // 베스트 컷이 이 적을 카메라 쪽으로 돌려 찍는다
    const roll = e.out ? Math.min(2.6, -e.y * 0.35 + 0.6) : 0; // 떨어질 때 뒤로 넘어가며 구른다
    put(mesh, i, e.x, ey, e.z, Math.atan2(g.px - e.x, g.pz - e.z), sc * (1.04 - hop * 0.08), sc * (0.94 + hop * 0.12), sc * (1.04 - hop * 0.08), -roll);
    // 회색 = 가려서·튕겨서 안 먹힘, 주황 번쩍 = 보조 무기에 맞음, 흰 번쩍 = 주무기
    mesh.setColorAt(i, e.blk > 0 || e.bnc > 0 ? C_BLOCK : e.flash > 0 ? ((e.by === 'log' || e.by === 'pumpkin') && g.t - (e.byT ?? 0) < 0.2 ? C_SUB : C_FLASH) : heavyLook ? C_TOUGH : C_PLAIN);
  }
  sync(smallMesh, ns);
  sync(small2Mesh, ns2);
  sync(bigMesh, nb);
  sync(balloonMesh, nBal);
  sync(bombMesh, nBomb);
  sync(shieldMesh, nSh);
  sync(helmetMesh, nHel);
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
  drawWeapon(dt, now);
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
  const v = g.vis;
  if ((v.windT = Math.min(1, v.windT + dt * 3)) < 1) // 부채: 펼친 쪽으로 바람 줄이 흘러간다
    for (let k = 0; k < 14; k++) {
      const a = v.windYaw + (k / 13 - 0.5) * v.windArc, d = v.windR * (0.25 + 0.85 * v.windT) + (k % 3) * 0.3;
      put(streakMesh, nStreak++, v.windX + Math.sin(a) * d, 0.3 + (k % 4) * 0.25, v.windZ + Math.cos(a) * d, a, 1, 1, 0.6 + v.windT);
    }
  sync(streakMesh, nStreak);
  g.logs.forEach((l, i) => put(logMesh, i, l.x, 0.36, l.z, Math.atan2(l.dx, l.dz), 1, 1, 1, l.roll));
  sync(logMesh, g.logs.length);
  let nWarn = 0, nMark = 0; // 통나무 0.6초 예고 띠, 호박 착지 원, 덩어리 떨어지는 자리
  for (const l of g.logs) if (l.warn > 0) put(logWarnFx, nWarn++, l.x, 0.05, l.z, Math.atan2(l.dx, l.dz), 3.2, 1, l.left);
  (logWarnFx.material as THREE.MeshBasicMaterial).opacity = 0.14 + 0.18 * Math.abs(Math.sin(now * 0.018));
  sync(logWarnFx, nWarn);
  if (mode !== 'title' && mode !== 'over') for (const pk of g.pumpkins) put(markFx, nMark++, pk.tx, 0.05, pk.tz, 0, R.pumpkinRadius(g.lv.pumpkin) * (0.6 + 0.4 * pk.t));
  for (let k = g.vis.packs.length - 1; k >= 0; k--) {
    const pa = g.vis.packs[k];
    if ((pa.t += dt) > 0.5) { g.vis.packs.splice(k, 1); continue; }
    put(markFx, nMark++, pa.x, 0.05, pa.z, 0, (R.PACK_SPREAD + 0.6) * (1.3 - pa.t * 0.6));
  }
  sync(markFx, Math.min(16, nMark));
  g.pumpkins.forEach((pk, i) => put(pumpkinMesh, i, pk.x, pk.y, pk.z, pk.t * 9, 1.1));
  sync(pumpkinMesh, g.pumpkins.length);
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

/** 지금 보여 줄 주무기: 판 안은 이번 판 무기, 시작 화면은 다음 판에 들 무기 */
const shownWeapon = (): MT.WeaponId => (mode === 'title' ? runWeapon() : g.weapon);
/** 타격 순간 그릴 것을 기록한다(strike에서 부름, 판 규칙과 무관) */
function showStrike(s: Strike) {
  const v = g.vis, w = g.weapon;
  if (s.shape === 'circle') {
    v.shockT = 0; v.shockX = s.cx; v.shockZ = s.cz; v.shockR = s.rad;
    if (w === 'sledge' && (s.kind === 'main' || s.kind === 'double')) { // 쿵: 멈춤 0.08초·흔들림·금 간 자국 1초·흙먼지 고리
      v.crackT = 0; v.crackX = s.cx; v.crackZ = s.cz; v.crackR = s.rad;
      g.stop = Math.max(g.stop, 0.08);
      g.shake = Math.max(g.shake, 0.25);
      for (let k = 0; k < 10; k++) burst(s.cx + Math.sin(k * 0.628) * s.rad * 0.8, s.cz + Math.cos(k * 0.628) * s.rad * 0.8, C_DIRT, 1);
    }
  } else if (s.shape === 'line') {
    v.lines.push({ x: g.px, z: g.pz, yaw: s.yaw, len: s.rad, w: s.width, t: 0 });
    if (v.lines.length > 3) v.lines.shift();
  } else if (w === 'twin' && s.kind !== 'spin') { // 좌·우·좌 교차 잔상
    v.twinTap++;
    v.slashes.push({ x: g.px, z: g.pz, yaw: s.yaw, r: s.rad, hand: v.twinTap % 2, t: 0 });
    if (v.slashes.length > 3) v.slashes.shift();
  } else if (w === 'fan' && s.kind === 'main') { v.windT = 0; v.windX = g.px; v.windZ = g.pz; v.windYaw = s.yaw; v.windR = s.rad; v.windArc = s.half * 2; }
  if (w === 'squeaky' && s.kind === 'tap') burst(g.px + Math.sin(s.yaw) * s.rad * 0.7, g.pz + Math.cos(s.yaw) * s.rad * 0.7, C_STAR, 5); // 둘째 타 노란 별
}
const HANDS = [[weapon, -1], [weapon2, 1]] as const; // 쌍검: 오른손·왼손
let titleModsKey = '', titleModsVal = R.NO_MODS;
/** 시작 화면 무기의 숙련 값: 무기·숙련 단계가 바뀔 때만 다시 계산(매 프레임 만들지 않게) */
function titleMods(w: MT.WeaponId) {
  const lv = R.masteryLevel(meta.mastery[w]), k = `${w}|${lv}`;
  if (k !== titleModsKey) { titleModsKey = k; titleModsVal = R.masteryMods(w, lv); }
  return titleModsVal;
}
/** 주무기와 박자 연출(결정 088): 무기별 모양, 준비(들어 올림·젖힘·당김·접기) → 타격 → 후딜(내려온 자세), 바닥 표시 */
function drawWeapon(dt: number, now: number) {
  const wid = shownWeapon(), inRun = mode !== 'title' && mode !== 'over', v = g.vis, big = MT.hammerMul(meta), gold = inRun && g.golden > 0;
  const wlv = inRun ? g.lv.hammer : 1, mods = inRun ? g.wMods : titleMods(wid), tier = WL.tierOf(wlv);
  const key = `${wid}|${tier}|${mods.star}`;
  if (key !== weaponKey) {
    weaponKey = key;
    weapon.geometry = WL.weaponGeo(wid, tier, mods.star);
    weapon2.geometry = WL.weaponGeo(wid, tier, mods.star, true);
  }
  weaponMat.emissive.setHex(gold ? 0x5a4000 : 0); // 번개 무기 보급
  const phase = inRun ? g.wPhase : 'idle';
  const p = phase === 'windup' ? Math.min(1, 1 - g.wT / Math.max(0.01, R.weaponWind(wid, wlv, mods))) : 0, k = p * (2 - p);
  g.swingT = Math.min(1, g.swingT + dt * 6);
  const sw = Math.min(1, g.swingT * 1.6), swinging = inRun && sw < 1, ease = 1 - (1 - sw) ** 2; // 처음 빠르게, 끝에 느리게
  const half = Math.min(g.swingArc, Math.PI) / 2 + 0.3, half0 = R.weaponArc(wid, wlv, mods) / 2 + 0.3; // 회오리(360°)도 무기는 반 바퀴만
  let yaw = g.face + 2.4, pitch = -0.9, wy = 0.75, fwd = 0.25, crouch = 0, twist = 0, fold = 1, squash = 0;
  if (swinging && g.swingShape === 'circle' && wid === 'sledge') { yaw = g.swingYaw; pitch = -2.5 + 3 * ease; wy = 0.95 - 0.4 * ease; crouch = 1 - sw; } // 쿵 내려찍기
  else if (swinging && g.swingShape === 'line') { yaw = g.swingYaw; pitch = 0.1; wy = 0.6; fwd = -0.3 + 0.9 * ease; } // 퍽 찌르기
  else if (swinging && wid !== 'sledge' && wid !== 'pole') {
    yaw = g.swingYaw + half - 2 * half * ease; pitch = 0.25; wy = 0.55;
    if (wid === 'squeaky' && g.swingKind === 'tap') squash = 1 - sw; // 둘째 타에 머리가 찌그러짐
  } else if (phase === 'windup') {
    if (wid === 'sledge') { yaw = g.wYaw; pitch = -0.9 - 1.6 * k; wy = 0.75 + 0.2 * k; crouch = k; } // 머리 위로 크게 천천히
    else if (wid === 'bat') { yaw = g.wYaw + half0 + 1.1 * k; pitch = 0.05; wy = 0.65; twist = 0.7 * k; crouch = k; } // 몸을 비틀며 뒤로 젖힘
    else if (wid === 'pole') { yaw = g.wYaw; pitch = 0.1; wy = 0.6; fwd = 0.25 - 0.55 * k; } // 뒤로 당김
    else if (wid === 'fan') { yaw = g.wYaw + half0 * k; pitch = -0.9 + 0.6 * k; fold = 1 - 0.8 * k; } // 접었다가
    else if (wid !== 'twin') { yaw = g.wYaw + half0 * k; pitch = -0.9 - 0.45 * k; } // 짧게 들어 올림
  } else if (phase === 'recovery') { // 후딜: 휘두른 자세로 멈춤
    if (wid === 'sledge') { yaw = g.swingYaw; pitch = 0.5; wy = 0.55; crouch = 0.6; } // 땅에 박힌 채
    else if (wid === 'pole') { yaw = g.swingYaw; pitch = 0.1; wy = 0.6; fwd = 0.6; } // 내민 채
    else if (wid !== 'twin') { yaw = g.swingYaw - half; pitch = 0.25; wy = 0.55; }
  }
  const sc = (gold ? 1.35 : 1) * (0.9 + 0.08 * wlv) * big; // Lv5 ×1.3
  weapon.visible = mode !== 'bonus';
  weapon2.visible = weapon.visible && wid === 'twin';
  if (wid === 'twin') { // 두 손에 하나씩: 친 손만 휘두르고 다른 손은 앞으로 들고 있다
    const right = v.twinTap % 2 === 1;
    for (const [m, side] of HANDS) {
      const hit = swinging && g.swingKind !== 'spin' ? right === (side < 0) : swinging;
      const a = hit ? g.swingYaw - side * (half - 2 * half * ease) : g.face + side * 0.55, hx = g.face + (side * Math.PI) / 2;
      m.position.set(g.px + Math.sin(hx) * 0.28, hit ? 0.55 : 0.7, g.pz + Math.cos(hx) * 0.28);
      m.rotation.set(hit ? 0.25 : -1.0, a, 0, 'YXZ');
      m.scale.setScalar(sc);
    }
  } else {
    weapon.position.set(g.px + Math.sin(yaw) * fwd, wy - 0.12 * crouch, g.pz + Math.cos(yaw) * fwd);
    weapon.rotation.set(pitch, yaw, 0, 'YXZ');
    weapon.scale.set(sc * fold * (1 + 0.35 * squash), sc * (1 - 0.3 * squash), sc);
  }
  // 준비가 긴 무기(대형 해머·방망이)는 준비 동안 웅크린다
  hero.scale.set(heroBase * (1 + 0.06 * crouch), heroBase * (1 - 0.1 * crouch), heroBase * (1 + 0.06 * crouch));
  hero.rotation.y = g.face + twist;
  // 타격 모양: 부채꼴(주인공 자리)·원(앞자리)·직선
  const swingMat = swing.material as THREE.MeshBasicMaterial;
  swing.visible = swinging && g.swingShape === 'fan' && (wid !== 'twin' || g.swingKind === 'spin');
  if (swing.visible) {
    swing.geometry = arcGeo(g.swingArc, wid === 'bat' ? 0.8 : 0.4); // 방망이는 가는 흰 줄 궤적
    swingMat.color.setHex(gold ? 0xffd23f : wid === 'bat' ? 0xffffff : wid === 'fan' ? 0xd8f4ff : 0xfff3c4);
    swing.position.set(g.px, 0.08, g.pz);
    swing.rotation.y = g.swingYaw;
    swing.scale.setScalar(g.swingRad * (0.7 + g.swingT * 0.3));
    swingMat.opacity = 0.75 * (1 - g.swingT);
  }
  v.shockT = Math.min(1, v.shockT + dt * 4);
  shockFx.visible = inRun && v.shockT < 1;
  if (shockFx.visible) {
    shockFx.position.set(v.shockX, 0.08, v.shockZ);
    shockFx.scale.setScalar(v.shockR * (0.55 + 0.45 * v.shockT));
    (shockFx.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - v.shockT);
  }
  v.crackT = Math.min(1, v.crackT + dt);
  crackFx.visible = inRun && v.crackT < 1;
  if (crackFx.visible) {
    crackFx.position.set(v.crackX, 0.04, v.crackZ);
    crackFx.scale.setScalar(v.crackR * 0.75);
    (crackFx.material as THREE.MeshBasicMaterial).opacity = 0.7 * Math.min(1, (1 - v.crackT) * 3);
  }
  // 대형 해머 착지 원: 들어 올리는 동안 점점 진해진다(맞을 자리 = 주인공 + 겨눈 방향 × 앞 거리)
  landFx.visible = inRun && wid === 'sledge' && phase === 'windup';
  if (landFx.visible) {
    const at = (R.WEAPON_STATS.sledge.at ?? 0) * big, r = R.weaponRadius('sledge', wlv, mods) * big + (gold ? 1.2 : 0);
    landFx.position.set(g.px + Math.sin(g.wYaw) * at, 0.06, g.pz + Math.cos(g.wYaw) * at);
    landFx.scale.setScalar(r);
    (landFx.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.6 * p;
  }
  // 펀치 막대: 준비 중 찌를 줄에 얇은 점선, 찌르면 직선 흰 띠
  let nDash = 0, nLine = 0, nSlash = 0, nGust = 0;
  if (inRun && wid === 'pole' && phase === 'windup') {
    const len = R.weaponRadius('pole', wlv, mods) * big + (gold ? 1.2 : 0);
    for (let d = 0.6; d < len && nDash < 12; d += 0.45) put(dashFx, nDash++, g.px + Math.sin(g.wYaw) * d, 0.07, g.pz + Math.cos(g.wYaw) * d, g.wYaw);
    (dashFx.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.6 * p;
  }
  let lineFade = 1;
  for (const l of v.lines) {
    if ((l.t += dt * 4) >= 1) continue;
    put(lineFx, nLine++, l.x, 0.075, l.z, l.yaw, l.w * (1 - 0.4 * l.t), 1, l.len);
    lineFade = Math.min(lineFade, l.t);
  }
  (lineFx.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - lineFade);
  let slashFade = 1;
  for (const sl of v.slashes) {
    if ((sl.t += dt * 4) >= 1) continue;
    put(slashFx, nSlash++, sl.x, 0.5, sl.z, sl.yaw + (sl.hand ? 0.25 : -0.25), sl.r, sl.r, sl.r, sl.hand ? 0.35 : -0.35); // 좌우로 기울여 X자 교차
    slashFade = Math.min(slashFade, sl.t);
  }
  (slashFx.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - slashFade);
  if (inRun) for (const u of g.gusts) put(gustFx, nGust++, u.x, 0, u.z, now * 0.012, 1, 0.8 + 0.2 * Math.sin(now * 0.02), 1);
  sync(dashFx, nDash);
  sync(lineFx, nLine);
  sync(slashFx, nSlash);
  sync(gustFx, Math.min(6, nGust));
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
    const wu = WL.UI[g.weapon], [name, desc, c] = id === 'hammer' ? [L(...wu.name), UPS.hammer[1], wu.color] : UPS[id], lv = id === 'heart' ? 0 : g.lv[id]; // 무기 카드는 이번 판 무기 이름·색
    const tag = id === 'heart' ? '' : lv ? `<em>Lv ${lv} → ${lv + 1}</em>` : `<em class="new">NEW</em>`;
    return `<button class="card" data-id="${id}" style="--c:${c}"><div class="ico">${svg(id === 'hammer' ? wu.icon : ICON[id])}</div><b>${name}</b>${tag}<span>${desc}</span></button>`;
  });
  const again = g.rerolls > 0 ? `<button class="sub" data-act="reroll">${L(`다시 고르기 (${g.rerolls})`, `Reroll (${g.rerolls})`)}</button>`
    : g.t > 0 && !g.adRerolled && adExtras() ? `<button class="ad mini" data-act="adReroll">▶ ${L('광고 보고 다시 뽑기', 'Watch ad: new cards')}</button>` : ''; // 판당 1번(결정 093)
  const head = g.t === 0 ? L('들고 갈 스킬', 'Starting skill') : L('레벨 업!', 'Level up!');
  const count = pickTotal > 1 ? ` <small>×${pickTotal} · ${pickTotal - g.picks + 1}/${pickTotal}</small>` : '';
  show(`<div class="sheet"><h2>${head}${count}</h2><div class="cards">${cards.join('')}</div>${again}</div>`, 'pick');
}
// 상점 설명은 "다음 단계에서 무엇이 되는지"를 보여 준다(결정 072)
const PERK_UI: Record<MT.Perk, [string, (next: number) => string, string, string]> = {
  vigor: [L('튼튼한 몸', 'Sturdy'), () => L('최대 체력 +15', 'Max HP +15'), '#ff5a6e', ICON.heart],
  shove: [L('큰 무기', 'Big weapon'), () => L('모든 무기 크기·사거리 +3%, 넉백 +5%', 'All weapons: size & reach +3%, knockback +5%'), '#b06ee8', ICON.hammer],
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
// 베스트 컷(결정 062 → 090 다시 설계): 판 중 가장 멋지게 날려 보낸 순간을 점수로 고르고(BS.judge), 그 적이 꼭대기에 뜬 때
// 따로 둔 카메라로 낮고 가까이 한 번만 그린다(점수가 판 최고를 넘을 때만, 판 시간 0.5초에 한 번까지). 카드 글·효과는 판이 끝날 때 얹는다
let bestShot = '', shotT = -9, shotBest = 0, shotInfo: BS.ShotInfo | null = null;
let shotPend: { e: Enemy; score: number; kind: BS.Kind; word: BS.KoEn; mesh?: THREE.InstancedMesh; idx?: number } | null = null;
let shotSeq = Math.floor(Math.random() * 30); // 찍을 때마다 +1 → 앵글·자세·표정(BS.look). 불러올 때 한 번만 무작위라 오늘의 섬 씨앗과 무관
let shotWord: BS.KoEn = ['', ''], bestCap = ''; // bestCap: 카드에 쓴 캡션(공유 문구·결과 섬네일이 같은 글을 쓰게)
const shotCam = new THREE.PerspectiveCamera(50, 0.8, 0.2, 140), shotPhoto = document.createElement('canvas');
const SV = new THREE.Vector3(), SV2 = new THREE.Vector3(), SH = new THREE.Vector3(), SZ = new THREE.Vector2(), SM = new THREE.Matrix4(), SE = new THREE.Euler();
function considerShot(e: Enemy, homer: boolean) {
  const src = !e.by || g.t - (e.byT ?? 0) > 2 ? 'other' : e.by;
  const { score, kind } = BS.judge({ speed: Math.hypot(e.kx, e.kz), chain: g.chain, boss: e.kind === 'boss', big: e.big, src, homer, last: g.t > R.RUN_SECONDS - 4 });
  if (score > Math.max(shotBest, shotPend?.score ?? 0) && (kind === 'boss' || g.t - shotT > 0.5)) shotPend = { e, score, kind, word: BS.word(src, g.weapon) };
}
/** 튀어 오른 적이 꼭대기 근처(vy 4 → 1.5)일 때 찍는다 */
const shotDue = () => (mode === 'play' || mode === 'bonus') && !!shotPend && shotPend.e.vy < 1.5; // 판이 끝난 뒤엔 찍지 않는다(카드와 어긋남)
/** draw() 직후·화면 그리기 전에 부른다(같은 캔버스 왼쪽 아래에 그려 2D 캔버스로 옮기고, 이어서 본 화면이 덮어쓴다) */
function takeShot() {
  const p = shotPend!, e = p.e, es = eScale(e), h = 1.05 * es;
  shotPend = null;
  shotT = g.t;
  shotBest = p.score;
  shotWord = p.word;
  const lk = BS.look(shotSeq++); // 판마다 다른 앵글·자세·표정(결정 094)
  // 적 → 바깥쪽(o)·옆(s)·위로 키의 몇 배 떨어진 자리. 옆은 해가 얼굴을 비추는 쪽
  let ox = e.x - g.px, oz = e.z - g.pz;
  const ol = Math.hypot(ox, oz) || 1;
  ox /= ol; oz /= ol;
  const side = oz * 10 - ox * 8 > 0 ? 1 : -1, sx = oz * side, sz = -ox * side; // 해(sun.position)의 가로 방향 (10, 8)
  const cy = e.y + h * 0.5;
  // 앵글: [바깥, 옆, 높이, 시야각, 화면 기울기] — 낮은 옆 / 내려다보기 / 얼굴 꽉 / 올려다보기(하늘 배경) / 멀리(섬·주인공까지)
  const [co, cs, ch, fov, roll] = ([[2.3, 1.5, 0.25, 50, -0.14], [1.4, 0.9, 2.3, 52, 0.1], [2.0, 0.5, 0.15, 40, -0.22], [2.1, 1.1, -1.5, 56, 0.2], [3.4, 2.0, 0.9, 42, -0.06]] as const)[lk.cam];
  shotCam.position.set(e.x + (ox * co + sx * cs) * h, cy + h * ch, e.z + (oz * co + sz * cs) * h);
  if (Math.hypot(shotCam.position.x, shotCam.position.z) < g.isl + 0.5) shotCam.position.y = Math.max(shotCam.position.y, 0.4); // 섬 위면 땅속에 들어가지 않게
  shotCam.fov = fov;
  // 적 쪽으로 기울여 주인공도 뒤에 들어오게(얼굴 꽉 앵글은 적만)
  const hw = lk.cam === 2 ? 0.08 : 0.32;
  SV.set(e.x, cy, e.z).sub(shotCam.position).normalize().multiplyScalar(1 - hw);
  SV2.set(g.px, 0.6, g.pz).sub(shotCam.position).normalize().multiplyScalar(hw);
  shotCam.lookAt(SV.add(SV2).add(shotCam.position));
  shotCam.rotateZ(roll * side); // 기운 화면(만화 컷 느낌)
  shotCam.updateMatrixWorld();
  // 자세: [젖힘, 가로 배율, 세로 배율, 거꾸로] — 뒤로 젖힘 / 앞으로 고꾸라짐 / 거꾸로 / 길쭉 / 납작. 찍은 뒤 원래대로 되돌린다(같은 프레임 본 화면에 보이지 않게)
  const [lean, wx, wy, flip] = ([[-0.5, 1, 1, 0], [0.65, 1, 1, 0], [2.75, 1, 1, 1], [-0.3, 0.78, 1.4, 0], [-0.2, 1.32, 0.66, 0]] as const)[lk.pose];
  const yaw = Math.atan2(shotCam.position.x - e.x, shotCam.position.z - e.z) + (flip ? Math.PI : 0), py = e.y + (flip ? h : 0); // 거꾸로면 얼굴이 카메라를 보게 돌리고 발이 위로 가게 올린다
  const inst = e.kind !== 'boss' && p.mesh && p.idx !== undefined ? { m: p.mesh, i: p.idx } : null;
  SE.copy(bossMesh.rotation);
  SV2.copy(bossMesh.scale);
  const bossY = bossMesh.position.y;
  if (inst) inst.m.getMatrixAt(inst.i, SM);
  // 사진 크기 4:5, 가로 최대 720px(캔버스 안에 들어가게)
  const cvs = renderer.domElement, pr = renderer.getPixelRatio(), target = renderer.getRenderTarget();
  const pw = Math.floor(Math.min(720, cvs.width, cvs.height * 0.8) / pr) * pr, ph = Math.round(pw * 1.25);
  shotCam.aspect = pw / ph;
  shotCam.updateProjectionMatrix();
  renderer.getSize(SZ);
  // 카메라와 적 사이를 가리는 나무·바위는 이 한 장에서만 숨긴다
  const hid = props.filter((q) => segDist(q.x, q.z, shotCam.position.x, shotCam.position.z, e.x, e.z) < 0.5 + q.s * 0.6);
  try {
    if (e.kind === 'boss') { bossMesh.rotation.set(lean, yaw, 0, 'YXZ'); bossMesh.scale.set(SV2.x * wx, SV2.y * wy, SV2.z * wx); bossMesh.position.y = py; }
    else if (inst) {
      put(inst.m, inst.i, e.x, py, e.z, yaw, es * wx, es * wy, es * wx, lean);
      inst.m.instanceMatrix.needsUpdate = true;
    }
    for (const q of hid) { put(q.m, q.i, q.x, q.y, q.z, 0, 0); q.m.instanceMatrix.needsUpdate = true; }
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, pw / pr, ph / pr);
    renderer.render(scene, shotCam);
    shotPhoto.width = pw;
    shotPhoto.height = ph;
    shotPhoto.getContext('2d')!.drawImage(cvs, 0, cvs.height - ph, pw, ph, 0, 0, pw, ph);
  } finally {
    hid.forEach(place);
    bossMesh.rotation.copy(SE);
    bossMesh.scale.copy(SV2);
    bossMesh.position.y = bossY;
    if (inst) { inst.m.setMatrixAt(inst.i, SM); inst.m.instanceMatrix.needsUpdate = true; }
    renderer.setRenderTarget(target);
    renderer.setViewport(0, 0, SZ.x, SZ.y);
  }
  // 얼굴 자리(모델 앞쪽 머리 높이)와 날아온 길을 사진 픽셀로
  const toPx = (v: THREE.Vector3): [number, number] => (v.project(shotCam), [((v.x + 1) / 2) * pw, ((1 - v.y) / 2) * ph]);
  M.compose(P.set(e.x, py, e.z), Q.setFromEuler(EUL.set(lean, yaw, 0)), S.set(es * wx, es * wy, es * wx));
  const [fx, fy] = toPx(SH.set(0, FACE[0], FACE[1]).applyMatrix4(M)), [rx, ry] = toPx(SH.set(FACE[2], FACE[0], FACE[1]).applyMatrix4(M));
  const trail: [number, number][] = [];
  for (let k = 8; k >= 0; k--) { const t = k * 0.06; trail.push(toPx(SH.set(e.x - e.kx * t, Math.max(0.3, cy - e.vy * t - 15 * t * t), e.z - e.kz * t))); }
  shotInfo = { face: { x: fx, y: fy, r: Math.hypot(rx - fx, ry - fy), a: Math.atan2(ry - fy, rx - fx) }, trail, kind: p.kind, mood: lk.mood, cam: lk.cam, pose: lk.pose };
}
/** 점 (x, z)에서 선분 a→b까지 거리(가로 평면) */
function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}
/** 모델 안에서 얼굴 자리: 높이·앞쪽·머리 반폭(키 1.05로 맞춘 Kenney 모델 기준) */
const FACE = [0.72, 0.3, 0.26] as const;
/** 판이 끝날 때 한 번: 사진 + 효과·글 → 카드 그림 */
function makeCard(stageNo: number) {
  bestCap = '';
  if (!shotInfo) return '';
  bestCap = L(...BS.caption(shotInfo.kind, shotSeq + g.falls, shotInfo.mood));
  return BS.drawCard(shotPhoto, shotInfo, {
    caption: bestCap, word: L(...shotWord), brand: L('망치섬', 'Tumble Isle'),
    line: `${stageName(stageNo)} · ${L('떨어뜨림', 'Knocked off')} ${g.falls}`,
  }).toDataURL('image/jpeg', 0.85);
}
function startRun() {
  bestShot = '';
  shotInfo = shotPend = null;
  shotBest = 0;
  shotT = -9;
  resetInput();
  sfx.setMusicFast(false);
  g = newGame();
  trialWeapon = null;
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
  const cap = bestCap;
  const text = L(`${cap} 망치섬에서 ${g.falls}마리 떨어뜨렸다!`, `${cap} Knocked off ${g.falls} on Tumble Isle!`);
  try {
    if (navigator.canShare?.({ files: [file] })) return void (await navigator.share({ files: [file], text }));
  } catch { return; } // 사용자가 공유 창을 닫음
  const a = document.createElement('a'); // 공유를 못 하는 곳에서는 그림을 내려받는다
  a.href = bestShot;
  a.download = file.name;
  a.click();
}
/** 무기 아이콘(무기 색 바탕 + 흰 선). lock: 검은 그림자 */
const wIcon = (w: MT.WeaponId, lock = false) => `<span class="wico${lock ? ' lock' : ''}" style="--c:${WL.UI[w].color}">${svg(WL.UI[w].icon)}</span>`;
/** 잠긴 무기 안내: 장 끝이면 「2장 끝에서 열림」, 아니면 스테이지 이름 */
function openText(w: MT.WeaponId) {
  const n = MT.WEAPON_OPEN[w], ch = n / CH.STAGES_PER_CHAPTER;
  return Number.isInteger(ch) ? L(`${ch}장 끝에서 열림`, `Unlocks after Ch.${ch}`) : L(`${stageName(n - 1)} 지키면 열림`, `Clear ${stageName(n - 1)} to unlock`);
}
const otherWeaponOpen = () => MT.WEAPONS.some((w) => w !== 'hammer' && MT.weaponOpen(w, meta.cleared));
function showTitle(still = false) {
  mode = 'title';
  if (curDef.no !== stageIdx) void enterStage(stageIdx); // 고른 스테이지의 장 모델을 불러와 끼운다
  else { applyStage(); resetIsland(); }
  const locked = stageIdx > meta.cleared;
  // 시작 화면(결정 079): 미션은 한 줄로 접고(가장 쉬운 것 = 보상이 가장 적은 것을 앞에), 주인공이 가려지지 않게 메뉴를 아래로 모은다
  const ms = meta.missions.map((id) => MS.missionById(id)!).filter(Boolean), easy = [...ms].sort((a, b) => a.coins - b.coins)[0];
  const daily = loadDaily();
  // 스테이지 성질·추천 무기(결정 088): 성질이 있으면 「버티면 섬을 지킨다」 줄 자리에 두 줄로(시작 화면 높이 그대로, 결정 079)
  const tt = CH.traitText(curDef), rec = CH.recommendedWeapon(curDef), recOpen = MT.weaponOpen(rec, meta.cleared), cur = runWeapon();
  const [traitA, traitB] = tt ? L(...tt).split(' · ') : ['', ''];
  const goalRow = tt
    ? `<div class="goal trait">${wIcon(rec, !recOpen)}<span><b>${traitA}</b><small>${traitB}${recOpen ? '' : ` · ${openText(rec)}`}</small></span>` +
      (!recOpen && !locked && adExtras() && ads.adDaily().trials < ads.TRIALS_PER_DAY ? `<button class="ad mini" data-act="adTrial">▶ ${L('써 보기', 'Try it')}</button>` : '') + `</div>`
    : `<div class="goal"><i></i>${L(`${clock(R.RUN_SECONDS)} 버티면 섬을 지킨다`, `Survive ${clock(R.RUN_SECONDS)} to save the isle`)}</div>`;
  const wBtn = otherWeaponOpen()
    ? `<button class="wbtn" data-act="weapons" aria-label="${L('무기 고르기', 'Choose weapon')}">${wIcon(cur)}<small>${L(...WL.UI[cur].name)}</small>${tt && cur === rec ? `<em>${L('추천', 'Pick')}</em>` : ''}</button>` : '';
  show(
    `<div class="top">${coinPill()}<h1 class="big-title">${L('망치섬', 'Tumble<br>Isle')}</h1><p class="tag">${L('망치로 쳐서 섬 밖으로 날려 버리세요', 'Bonk the horde off your tiny island')}</p></div>` +
      `<div class="menu">` +
      `<div class="stage"><button data-act="prevCh" ${curDef.chapter ? '' : 'disabled'} aria-label="${L('이전 장', 'Previous chapter')}">«</button>` +
      `<button data-act="prev" ${stageIdx ? '' : 'disabled'} aria-label="${L('이전 스테이지', 'Previous stage')}">‹</button>` +
      `<div><small>${L(`${curDef.chapter + 1}장 · ${curDef.inChapter + 1}/${CH.STAGES_PER_CHAPTER}`, `Ch.${curDef.chapter + 1} · ${curDef.inChapter + 1}/${CH.STAGES_PER_CHAPTER}`)}${curDef.finale ? L(' · 장 보스', ' · boss') : ''}</small><b>${locked ? '🔒 ' : ''}${L(...CH.CHAPTERS[curDef.chapter].name)}</b></div>` +
      `<button data-act="next" ${stageIdx < CH.STAGE_COUNT - 1 ? '' : 'disabled'} aria-label="${L('다음 스테이지', 'Next stage')}">›</button>` +
      `<button data-act="nextCh" ${curDef.chapter < CH.CHAPTERS.length - 1 ? '' : 'disabled'} aria-label="${L('다음 장', 'Next chapter')}">»</button></div>` +
      (locked ? `<p class="best">${L(`${stageName(stageIdx - 1)}을(를) 지키면 열립니다`, `Clear ${stageName(stageIdx - 1)} to unlock`)}</p>` : bestLine()) +
      goalRow +
      (easy ? `<details class="fold"><summary>${L(`미션 1/${ms.length}`, `Mission 1/${ms.length}`)} · ${L(easy.ko, easy.en)}</summary>${missionList(meta.missions)}</details>` : '') +
      `<div class="startrow">${wBtn}<button class="go" data-act="start" ${locked ? 'disabled' : ''}>${L('시작', 'Start')}</button></div>` +
      `<div class="row"><button class="sub daily" data-act="daily">${L('오늘의 섬', "Today's isle")}<small>${stageName(R.dailyStage(today()))}${daily.best ? L(` · 최고 ${daily.best}`, ` · best ${daily.best}`) : ''}</small></button>` +
      `<button class="sub" data-act="shop">${L('상점', 'Shop')}</button>` +
      `<button class="sub" data-act="settings">${L('설정', 'Settings')}</button></div></div>`,
    'title',
  );
  if (still) overlay.setAttribute('data-still', ''); // 무기 시트에서 돌아올 때 메뉴가 다시 튀어 오르지 않게(결정 074)
}
/** 무기 시트(결정 085 6-2·088): 아래 시트에 2×4 칸, 한 번 누르면 고르고 닫힘 */
function showWeapons() {
  mode = 'title';
  const rec = CH.recommendedWeapon(curDef), cur = runWeapon(), lv1 = (w: MT.WeaponId) => R.masteryMods(w, R.masteryLevel(meta.mastery[w]));
  // 박자 막대 길이 = 시간, 가장 긴 무기(대형 해머) 기준. 숫자는 쓰지 않는다
  const mx = (f: (w: MT.WeaponId) => number) => Math.max(...MT.WEAPONS.map(f));
  const wind = (w: MT.WeaponId) => R.weaponWind(w, 1, lv1(w)), cyc = (w: MT.WeaponId) => R.weaponCycle(w, 1, lv1(w)), recv = (w: MT.WeaponId) => R.weaponRec(w, 1, lv1(w));
  const top = [mx(wind), mx(cyc), mx(recv)];
  const tiles = MT.WEAPONS.map((w) => {
    const open = MT.weaponOpen(w, meta.cleared), lvl = R.masteryLevel(meta.mastery[w]), ui = WL.UI[w];
    const bars = [wind(w), cyc(w), recv(w)].map((x, i) => `<i style="--w:${Math.max(5, (x / top[i]) * 100).toFixed(0)}%"></i>`).join('');
    const mast = lvl >= R.MASTERY_MAX ? `<span class="next">★ ${L('달인', 'Master')}</span>`
      : `<span class="next" style="--m:${lvl * 10}%"><u></u>${L('다음', 'Next')}: ${L(...WL.masteryStep(w, lvl + 1))}</span>`;
    return `<button class="wtile${w === cur ? ' on' : ''}" data-act="weapon" data-w="${w}" ${open ? '' : 'disabled'}>${wIcon(w, !open)}<b>${L(...ui.name)}</b>` +
      (curDef.trait && w === rec ? `<em>${L('추천', 'Pick')}</em>` : '') + `<small>${open ? L(...ui.tag) : openText(w)}</small><div class="beats">${bars}</div>${open ? mast : ''}</button>`;
  });
  show(
    `<div class="sheet wsheet"><h2>${L('무기', 'Weapons')}</h2>` +
      `<div class="legend"><i></i>${L('준비', 'Wind-up')}<i></i>${L('공속', 'Cycle')}<i></i>${L('후딜', 'Recovery')}</div>` +
      `<div class="wgrid">${tiles.join('')}</div>${toggleRow('autoWeapon', L('추천 무기 자동', 'Auto-pick recommended'), meta.autoWeapon)}</div>`,
    'pick wsheet',
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
const canContinue = () => !g.continued && !dailyRun && ads.adReady() && (g.t >= 45 || g.bossSpawned);
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
/** 2배를 받으면 새로 살 수 있게 되는 가장 싼 강화(결정 093): 「지금 꼭 필요한」 이유를 버튼에 붙인다 */
function doubleBuys(): string {
  const can = MT.PERKS.filter((id) => meta.perks[id] < MT.PERK_MAX[id]).map((id) => ({ id, cost: MT.perkCost(id, meta.perks[id]) }))
    .filter((p) => p.cost > meta.coins && p.cost <= meta.coins + lastCoins).sort((a, b) => a.cost - b.cost)[0];
  return can ? `<small>${L(`2배면 「${PERK_UI[can.id][0]}」 Lv ${meta.perks[can.id] + 1}을 살 수 있어요`, `Enough for ${PERK_UI[can.id][0]} Lv ${meta.perks[can.id] + 1}`)}</small>` : '';
}
const doubleAdBtn = () => `<button class="ad" data-act="adDouble">▶ ${L(`광고 보고 코인 2배 (+${lastCoins})`, `Watch ad: double coins (+${lastCoins})`)}${doubleBuys()}</button>`;
/** 덤 광고(무기 체험·카드 다시 뽑기)는 처음 두 섬을 깬 뒤, 광고가 준비됐을 때만 보인다(없어도 손해 없게) */
const adExtras = () => meta.cleared >= 2 && ads.adReady();
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
  } else if (act === 'adTrial') {
    const rec = CH.recommendedWeapon(curDef);
    if ((await watchAd(btn)) !== 'earned') return showTitle();
    ads.useAdDaily('trials');
    trialWeapon = rec;
    void stageReady.then(startRun);
  } else if (act === 'adReroll') {
    const res = await watchAd(btn);
    if (mode !== 'pick') return;
    if (res === 'earned') g.adRerolled = true;
    showPick(); // 받았으면 새 카드, 아니면 같은 시트를 다시 그려 잠근 버튼을 푼다
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
  (withLang ? `<button class="set" data-act="lang"><span>${L('언어', 'Language')}</span><b>${lang === 'ko' ? '한국어' : 'English'}</b></button>` : '') +
  (withLang && MT.DEV_MODE ? toggleRow('devAll', L('개발자: 모든 무기 열기', 'Dev: unlock all weapons'), MT.devAllWeapons()) : '') + `</div>`;
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
  if (!btn && ev.target === overlay && overlay.classList.contains('wsheet')) return showTitle(true); // 시트 밖을 누르면 닫힘
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
  if (act === 'weapons') return showWeapons();
  if (act === 'weapon') { // 한 번 누르면 고르고 닫힘. 자동 장착이 켜져 있어도 이 스테이지에선 고른 무기
    const w = btn.dataset.w as MT.WeaponId;
    meta = { ...meta, weapon: w };
    saveMeta();
    manualPick = w;
    return showTitle(true);
  }
  if (act === 'autoWeapon') {
    meta = meta.autoWeapon ? { ...meta, weapon: runWeapon(), autoWeapon: false } : { ...meta, autoWeapon: true }; // 끌 때는 지금 들 무기를 그대로
    if (meta.autoWeapon) manualPick = null;
    saveMeta();
    return showWeapons();
  }
  if (act === 'useWeapon') { // 결과 화면 「새 무기!」 바로 쓰기: 다음 판에 들고 간다
    const w = btn.dataset.w as MT.WeaponId;
    meta = { ...meta, weapon: w };
    saveMeta();
    manualPick = w;
    btn.outerHTML = `<span class="badge">${L('장착!', 'Equipped!')}</span>`;
    return;
  }
  if (act === 'settings') return showSettings();
  if (act === 'music' || act === 'sound' || act === 'haptic') {
    (act === 'music' ? sfx.toggleMusic : act === 'sound' ? sfx.toggleSfx : sfx.toggleHaptic)();
    return mode === 'pause' ? showPause() : showSettings();
  }
  if (act === 'privacy') return void ads.openPrivacy().then(showSettings);
  if (act === 'lang') return setLang(lang === 'ko' ? 'en' : 'ko');
  if (act === 'devAll') { MT.setDevAllWeapons(!MT.devAllWeapons()); return location.reload(); } // 다시 불러와 잠긴 무기 저장값까지 정리
  if (act === 'resume') return resume();
  if (act === 'adContinue' || act === 'adDouble' || act === 'adCapsule' || act === 'adTrial' || act === 'adReroll') return void onAd(act, btn);
  if (act === 'reroll') {
    g.rerolls--;
    return showPick();
  }
  if (act === 'quit') return end(false);
  if (act === 'title') return showTitle();
  if (act === 'prev' || act === 'next' || act === 'prevCh' || act === 'nextCh') manualPick = null; // 스테이지를 바꾸면 다시 추천 무기로
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
/** 이번 판 숙련 점수(rules.ts masteryGain) */
function masteryEarned(chapter: number) {
  const lvOf = (w: MT.WeaponId) => R.masteryLevel(meta.mastery[w]);
  return R.masteryGain(g.falls, chapter, lvOf(g.weapon), Math.max(...MT.WEAPONS.map(lvOf)));
}
function end(win: boolean) {
  mode = 'over';
  const chapter = curDef.chapter, runStage = stageIdx; // 오늘의 섬은 아래에서 원래 스테이지로 돌아가 curDef가 바뀌므로 판의 장을 먼저 잡아 둔다
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
  shotPend = null; // 판 끝 뒤에 한 장 더 찍혀 카드와 어긋나지 않게
  bestShot = makeCard(runStage);
  const doneMs = g.done.map((id) => MS.missionById(id)!);
  const missionCoins = doneMs.reduce((a, m) => a + m.coins, 0);
  const coins = Math.round((MT.coinsFor(g.kills, g.falls, win, chapter) + g.bonusFalls * R.BONUS_COIN + g.extra + missionCoins) * MT.coinMul(meta));
  lastCoins = coins;
  ads.initAds(); // 첫 판이 끝난 뒤에야 광고 준비(추적 허용 창)를 시작한다
  const unlocked = win && !dailyNote && stageIdx === meta.cleared && stageIdx < CH.STAGE_COUNT;
  const clearedBefore = meta.cleared, mastBefore = R.masteryLevel(meta.mastery[g.weapon]);
  meta = {
    ...meta, coins: meta.coins + coins, cleared: unlocked ? stageIdx + 1 : meta.cleared,
    missionsDone: meta.missionsDone + g.done.length, bossDowns: meta.bossDowns + (g.bossDown ? 1 : 0),
    missions: MS.fillMissions(meta.missions.filter((id) => !g.done.includes(id))), // 달성한 미션은 새 것으로
    mastery: { ...meta.mastery, [g.weapon]: meta.mastery[g.weapon] + masteryEarned(chapter) }, // 숙련(결정 085): 이기든 지든 떨어뜨린 수
  };
  saveMeta();
  const hasNext = win && !dailyNote && stageIdx + 1 < CH.STAGE_COUNT;
  // 결과(결정 079): 떨어뜨린 수를 크게, 나머지는 작은 한 줄. 미션은 이번 판 달성한 것만 펼치고 없으면 접는다
  const badges = (unlocked && hasNext ? `<span class="badge">${L(`다음: ${stageName(stageIdx + 1)}`, `Next: ${stageName(stageIdx + 1)}`)}</span>` : '') +
    (isBest ? `<span class="badge">${L('최고 기록!', 'New best!')}</span>` : '') + (g.strikes ? `<span class="badge">STRIKE ×${g.strikes}</span>` : '') + dailyNote;
  // 새 무기·숙련 오름(결정 088): 배지 줄 아래 한 칸씩, 주 버튼은 그대로 하나
  const newW = MT.WEAPONS.find((w) => !MT.weaponOpen(w, clearedBefore) && MT.weaponOpen(w, meta.cleared));
  const mastAfter = R.masteryLevel(meta.mastery[g.weapon]), wn = WL.UI[g.weapon].name;
  const newBlock = newW ? `<div class="newweapon"><div class="rays"></div>${wIcon(newW)}<span><b>${L('새 무기!', 'New weapon!')}</b>${L(...WL.UI[newW].name)}</span>` +
    `<button class="sub" data-act="useWeapon" data-w="${newW}">${L('바로 쓰기', 'Use now')}</button></div>` : '';
  const mastLine = mastAfter > mastBefore ? `<p class="mastline">${wIcon(g.weapon)}<span>${mastAfter >= R.MASTERY_MAX ? L(`${wn[0]} 달인!`, `${wn[1]} master!`)
    : L(`${wn[0]} 숙련 ${mastAfter} → ${WL.masteryStep(g.weapon, mastAfter)[0]}`, `${wn[1]} mastery ${mastAfter} → ${WL.masteryStep(g.weapon, mastAfter)[1]}`)}</span></p>` : '';
  const missions = doneMs.length ? missionList(g.done, g.done)
    : `<details class="fold"><summary>${L(`다음 미션 ${meta.missions.length}개`, `${meta.missions.length} next missions`)}</summary>${missionList(meta.missions)}</details>`;
  show(
    `<h1 class="big-title" style="font-size:32px">${!win ? L('섬을 빼앗겼다', 'The isle fell') : g.bossDown ? L('왕좀비까지 격파!', 'Isle saved, king down!') : L('섬을 지켰다!', 'Isle defended!')}</h1>` +
      `<div class="panel result"><small>${L('떨어뜨림', 'Knocked off')}</small><strong class="falls">${g.falls}</strong>` +
      `<p class="line">${clock(sec)} · ${L('처치', 'KOs')} ${g.kills} · Lv ${g.level + 1}</p>` +
      `<div class="earn"><i></i>+${coins}</div>${doubleBtn()}` +
      (badges ? `<div class="badges">${badges}</div>` : '') + newBlock + mastLine + missions + `</div>` +
      (bestShot ? `<button class="bestcut" data-act="share" aria-label="${L('베스트 컷 공유', 'Share best shot')}"><img src="${bestShot}" alt=""><span><b>${L('베스트 컷', 'Best shot')}</b>${bestCap}</span>` +
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
let frozen = false; // 개발 훅 freeze: 스토어 촬영 때 그 순간을 그대로 멈춘다(renderOnce로만 그림)
function frame(now: number) {
  requestAnimationFrame(frame);
  if (frozen) return void (last = now);
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (mode === 'play' || mode === 'bonus') {
    if (g.stop > 0) g.stop -= dt;
    else update(dt);
  }
  draw(dt, now);
  renderer.info.reset();
  if (shotDue()) takeShot();
  composer.render();
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
      win: async (falls = 0) => { await stageReady; startRun(); g.t = 61; g.falls = falls; end(true); return overlay.innerText; }, // falls: 숙련 오름 줄 확인용
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
        const out: { win: boolean; t: number; falls: number; kills: number; swings: number; misses: number; lv: number; boss: boolean; strikes: number; bossSecs: number; bossPct: number; diedVsBoss: boolean; lvT: number[]; xpAt: number[]; juggles: number; fallBy: Record<Src, number>; subAt2: boolean; hurts: number; hurtsInWind: number; weapon: MT.WeaponId }[] = [];
        const mastery0 = meta.mastery; // 측정 중 숙련이 쌓여 값이 바뀌지 않게 판마다 되돌린다(campaign은 bot(1)이라 쌓인다)
        for (let r = 0; r < runs; r++) {
          if (r) meta = { ...meta, mastery: mastery0 };
          let lastBossPct = 0, bossDownT = 0, subAt2 = false; // subAt2: 둘째 카드까지 보조 무기를 얻었나(결정 083)
          const lvT: number[] = [], xpAt: number[] = []; // 레벨 업 시각, 10초마다 모은 경험치 합(카드 간격 측정)
          await enterStage(stageNo);
          startRun();
          let lag = [0, 0];
          for (;;) {
            while (lvT.length < g.level) lvT.push(g.t);
            if (g.level <= 2 && (g.lv.log || g.lv.pumpkin)) subAt2 = true;
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
            if (g.bossDown && !bossDownT) bossDownT = g.t;
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
            if (shotDue()) { draw(0, performance.now()); takeShot(); } // 봇은 화면을 그리지 않으므로 베스트 컷만 그때 그린다
            resetInput();
          }
          const win = g.t >= R.RUN_SECONDS - 0.1;
          out.push({ win, t: g.t, falls: g.falls, kills: g.kills, swings: g.swings, misses: g.misses, lv: g.level + 1, boss: g.bossDown, strikes: g.strikes, bossSecs: g.bossDown ? bossDownT - R.BOSS_AT : 0, bossPct: g.bossDown ? lastBossPct : 0, diedVsBoss: !win && g.t >= R.BOSS_AT, lvT, xpAt, juggles: g.juggles, fallBy: { ...g.fallBy }, subAt2, hurts: g.hurts, hurtsInWind: g.hurtsInWind, weapon: g.weapon });
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
          diedAfterBonus: out.filter((x) => !x.win && x.t >= R.BONUS_AT && x.t < R.BONUS_AT + 15).length,
          // 무기 측정(결정 083): 판당 공중 콤보, 원인별 떨어뜨림 합, 보조 무기(통나무+호박) 비율, 둘째 카드까지 보조 무기를 가진 판
          juggles: avg((x) => x.juggles), fallBy: Object.fromEntries((['main', 'log', 'pumpkin', 'sweep', 'other'] as Src[]).map((k) => [k, out.reduce((a, x) => a + x.fallBy[k], 0)])),
          subShare: +(out.reduce((a, x) => a + x.fallBy.log + x.fallBy.pumpkin, 0) / Math.max(1, out.reduce((a, x) => a + x.falls, 0))).toFixed(2),
          subAt2: out.filter((x) => x.subAt2).length,
          // 박자(결정 086): 판당 떨어뜨림(숙련 계수), 맞은 횟수 중 준비 동작 중에 맞은 비율, 쓴 무기
          falls: avg((x) => x.falls), hurts: avg((x) => x.hurts), windHurt: +(out.reduce((a, x) => a + x.hurtsInWind, 0) / Math.max(1, out.reduce((a, x) => a + x.hurts, 0))).toFixed(2),
          weapon: [...new Set(out.map((x) => x.weapon))].join(',') };
      },
      /** 처음부터 끝까지(결정 068): 늘 다음 스테이지를 하고, 판마다 가장 싼 강화를 살 수 있는 만큼 산다. 다 사는 판·도달 스테이지를 잰다 */
      /** doubles: 6판마다 앞 몇 판에 결과 화면 코인 2배 광고를 본다(하루 6판 중 3판이면 3, 버튼 조건과 같이 두 섬을 깬 뒤부터) */
      campaign: async (runs = 200, sloppy = 0.85, doubles = 0) => { // 무기는 새 사용자 기본값(추천 무기 자동, 결정 083)
        meta = MT.freshMeta(); saveMeta();
        const log: string[] = [];
        let maxedAt = 0;
        const used: Record<string, number> = {}, tenAt: Record<string, string> = {}; // 무기별 쓴 판 수, 숙련 10단계가 된 때
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
          if (r % 10 === 0) log.push(`${r}판: ${meta.cleared}스테이지 깸, 코인 ${meta.coins}, 강화 ${MT.PERKS.map((p) => meta.perks[p]).join('/')}, 숙련 ${MT.WEAPONS.map((w) => R.masteryLevel(meta.mastery[w])).join('/')}`);
          used[g.weapon] = (used[g.weapon] ?? 0) + 1;
          for (const w of MT.WEAPONS) if (!tenAt[w] && R.masteryLevel(meta.mastery[w]) >= R.MASTERY_MAX) tenAt[w] = `${r}판(${used[w]}번째)`;
        }
        return { maxedAt, cleared: meta.cleared, used, tenAt, log };
      },
      /** 강화 단계를 바로 정한다(강화별 효과를 봇으로 비교할 때) */
      setPerks: (p: Partial<Record<MT.Perk, number>>) => { meta = { ...meta, perks: { ...MT.freshMeta().perks, ...p } }; },
      /** 주무기를 바로 바꾼다(열림 조건 무시, 다음 판부터). 무기별 봇 비교용 */
      /** 무기 숙련 단계를 바로 정한다(0~10) */
      setMastery: (id: MT.WeaponId, n: number) => { meta = { ...meta, mastery: { ...meta.mastery, [id]: R.MASTERY_K * n * n } }; },
      setWeapon: (id: MT.WeaponId) => { meta = { ...meta, weapon: id, autoWeapon: false }; g.weapon = id; },
      /** 무기 8종을 주인공 앞에 한 줄로 세운다(휴대폰 크기에서 실루엣·색으로 구분되는지 보는 용도, 결정 088). lv: 카드 레벨(재질) */
      lineup: async (lv = 1) => {
        await stageReady;
        startRun();
        g.enemies.length = 0;
        overlay.hidden = true;
        mode = 'pause';
        MT.WEAPONS.forEach((w, i) => {
          for (const left of w === 'twin' ? [false, true] : [false]) {
            const m = new THREE.Mesh(WL.weaponGeo(w, WL.tierOf(lv), false, left), weaponMat);
            m.position.set(-4.0 + i * 1.15 + (left ? 0.3 : 0), 0.15, 2.2);
            m.rotation.set(-1.25, Math.PI + (left ? 0.3 : 0), 0, 'YXZ');
            m.scale.setScalar(0.9 + 0.08 * lv);
            m.castShadow = true;
            scene.add(m);
          }
        });
      },
      /** 박자 장면을 멈춰 세운다: 준비(windup, p = 진행 0~1)·타격(swing, p = 잔상 진행)·후딜(recovery) */
      pose: async (id: MT.WeaponId, phase: 'windup' | 'swing' | 'recovery', p = 0.7, lv = 1) => {
        await stageReady;
        meta = { ...meta, weapon: id, autoWeapon: false };
        manualPick = null;
        startRun();
        g.lv.hammer = lv;
        g.enemies.length = 0;
        for (let k = 0; k < 5; k++) { spawn(); const e = g.enemies[k], a = 0.6 + (k - 2) * 0.35, d = 2 + (k % 2) * 0.8; e.x = Math.sin(a) * d; e.z = Math.cos(a) * d; e.age = 1; }
        overlay.hidden = true;
        mode = 'pause';
        g.face = g.wYaw = 0.6;
        if (phase === 'windup') { g.wPhase = 'windup'; g.wT = R.weaponWind(id, lv, g.wMods) * (1 - p); }
        else { swingNow(g.wYaw); g.wPhase = 'recovery'; g.wT = 0.2; g.swingT = phase === 'swing' ? p / 1.6 : 1; g.vis.shockT = g.vis.crackT = phase === 'swing' ? p * 0.5 : 0.5; }
        g.stop = 0;
        draw(0, performance.now());
      },
      /** 스테이지 특징을 바꿔 비교: '' 끔, undefined 스테이지 그대로(다음 enterStage부터) */
      setTrait: (t?: R.Trait | '') => { traitOverride = t; },
      /** 장 규칙을 바꿔 비교: '' 끔, undefined 장 그대로 */
      setRule: (r?: R.Rule | '') => { ruleOverride = r; },
      sweep,
      /** 스테이지 번호(0~149)로 바로 가서 장 모델을 불러온다 */
      goStage: (no: number) => enterStage(no).then(() => showTitle()),
      /** 그리기 한 번 + 베스트 컷 찍기(화면 갱신이 멈춘 미리보기에서 시험용) */
      /** 화면을 그 순간에 멈추거나(true) 다시 돌린다. 멈춘 동안은 renderOnce로만 그린다(스토어 촬영용) */
      freeze: (on = true) => { frozen = on; },
      renderOnce: () => { draw(1 / 60, performance.now()); if (shotDue()) takeShot(); composer.render(); drawHud(); return !!shotInfo; },
      /** 베스트 컷 카드(그림 주소). 판이 끝난 뒤에만 있다 */
      card: () => bestShot,
      /** 마지막 베스트 컷의 종류·표정·앵글·자세(카드 다양성 확인용) */
      shotLook: () => shotInfo && { kind: shotInfo.kind, mood: shotInfo.mood, cam: shotInfo.cam, pose: shotInfo.pose },
      end,
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
