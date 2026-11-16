import * as THREE from 'three';
import roomData from '../content/rooms/clock-shop.json';
import type { Room } from './content/types';
import { L, T, lang, setLang } from './i18n';
import { buildRoom, sparklePos, type TaskState } from './room';
import * as sfx from './audio';

const room = roomData as Room;
const params = new URLSearchParams(location.search);
const today = new Date();
const seed = Number(params.get('seed')) || today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

// ── 렌더러: 바뀐 게 있을 때만 그린다(정지 화면이 대부분이라 휴대폰 발열·배터리에 유리, 결정 013)
const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// 전후 비교 캡처가 어두워지지 않게 캔버스는 불투명하게 그린다(투명 캔버스를 JPEG로 뽑으면 반투명 픽셀이 검게 섞인다)

const scene = new THREE.Scene();
scene.background = new THREE.Color('#241b14');
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

const hemi = new THREE.HemisphereLight('#fff1dc', '#3a2a1c', 0.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffe2b0', 0.6);
sun.position.set(4, 7, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -5;
sun.shadow.camera.right = 5;
sun.shadow.camera.top = 5;
sun.shadow.camera.bottom = -5;
sun.shadow.bias = -0.0004;
sun.shadow.radius = 4;
scene.add(sun);
const lampLight = new THREE.PointLight('#ffc77a', 0, 4.5, 1.6);
lampLight.castShadow = true;
lampLight.shadow.mapSize.set(512, 512);
scene.add(lampLight);
// 창으로 드는 빛줄기(창문을 닦으면 보인다)
const beam = new THREE.Mesh(
  new THREE.PlaneGeometry(1.0, 3.2),
  new THREE.MeshBasicMaterial({ color: '#fff0c8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
);
scene.add(beam);

const built = buildRoom(room, seed);
scene.add(built.group);
const tasks = built.tasks;

// 공기 중 먼지(방이 살아날수록 사라진다)
const motesGeo = new THREE.BufferGeometry();
const moteCount = 160;
const motePos = new Float32Array(moteCount * 3);
for (let i = 0; i < moteCount; i++) {
  motePos[i * 3] = (Math.random() - 0.5) * 5.6;
  motePos[i * 3 + 1] = Math.random() * 3.2;
  motePos[i * 3 + 2] = (Math.random() - 0.5) * 4.2;
}
motesGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
const motes = new THREE.Points(motesGeo, new THREE.PointsMaterial({ color: '#e8d8b8', size: 0.025, transparent: true, opacity: 0.6, depthWrite: false }));
scene.add(motes);

// ── 카메라: 방 둘레를 좌우로 조금 돌리고(±약 20°), 가까이 볼 때는 물건 앞으로
interface Rig { target: THREE.Vector3; yaw: number; pitch: number; dist: number }
const BASE_YAW = 0.42;
const rig: Rig = { target: new THREE.Vector3(0, 1.1, 0), yaw: BASE_YAW, pitch: 0.5, dist: 14 };
const goal: Rig = { ...rig, target: rig.target.clone() };
let zoom = 1;

function fitDist(size: number) {
  const vfov = (camera.fov * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  return Math.max(size / 2 / Math.tan(hfov / 2), (size * 0.9) / 2 / Math.tan(vfov / 2));
}
function roomRig(): Rig {
  return { target: new THREE.Vector3(0, 1.1, 0), yaw: goal.yaw, pitch: 0.5, dist: fitDist(6.3) * zoom };
}
function applyRig() {
  const { target, yaw, pitch, dist } = rig;
  camera.position.set(
    target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    target.y + Math.sin(pitch) * dist,
    target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  camera.lookAt(target);
}
function stepRig(dt: number) {
  const k = 1 - Math.exp(-dt * 7);
  rig.target.lerp(goal.target, k);
  rig.yaw += (goal.yaw - rig.yaw) * k;
  rig.pitch += (goal.pitch - rig.pitch) * k;
  rig.dist += (goal.dist - rig.dist) * k;
  applyRig();
  return rig.target.distanceTo(goal.target) + Math.abs(goal.yaw - rig.yaw) + Math.abs(goal.dist - rig.dist) * 0.1 > 0.001;
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (mode === 'room') Object.assign(goal, roomRig());
  else if (focused) Object.assign(goal, focusRig(focused));
  invalidate();
}

// ── HUD
const $ = (id: string) => document.getElementById(id)!;
const noteEl = $('note');
const hintEl = $('hint');
const backEl = $('back') as HTMLButtonElement;
const finaleEl = $('finale');
noteEl.innerHTML = `<b>${T(room.title)}</b>${T(room.note)}`;
backEl.textContent = L('← 돌아가기', '← Back');
const langEl = $('lang') as HTMLButtonElement;
langEl.textContent = lang === 'ko' ? 'English' : '한국어';
langEl.addEventListener('click', () => setLang(lang === 'ko' ? 'en' : 'ko'));
let toastUntil = 0;

function remaining() {
  return tasks.filter((t) => !t.done).length;
}
function updateHint() {
  if (performance.now() < toastUntil) return;
  hintEl.style.fontStyle = 'normal';
  if (finished) hintEl.textContent = '';
  else if (mode === 'focus' && focused?.kind === 'wipe') hintEl.textContent = L('문질러서 닦아 주세요', 'Rub to clean');
  else if (mode === 'focus' && focused?.kind === 'mend') hintEl.textContent = L('조각을 끌어다 맞춰 주세요', 'Drag the pieces into place');
  else if (dragging) hintEl.textContent = L('제자리로 옮겨 주세요', 'Move it back where it belongs');
  else hintEl.textContent = L(`반짝이는 곳을 눌러 보세요 · 남은 곳 ${remaining()}`, `Tap the sparkles · ${remaining()} left`);
}
function toast(text: string) {
  hintEl.textContent = `“${text}”`;
  hintEl.style.fontStyle = 'italic';
  toastUntil = performance.now() + 3200;
  setTimeout(updateHint, 3300);
}

// ── 상태
let mode: 'room' | 'focus' = 'room';
let focused: TaskState | null = null;
let finished = false;
let dirty = true;
const invalidate = () => (dirty = true);

function focusRig(t: TaskState): Rig {
  const f = (t.prop.task as { focus: { yaw: number; pitch: number; size: number } }).focus;
  const c = new THREE.Vector3();
  if (t.kind === 'wipe') t.surface!.getWorldPosition(c);
  else t.model.root.getWorldPosition(c);
  if (t.kind === 'mend') c.add(new THREE.Vector3(0, -0.12, 0.05));
  return { target: c, yaw: f.yaw, pitch: f.pitch, dist: fitDist(f.size) };
}
function enterFocus(t: TaskState) {
  mode = 'focus';
  focused = t;
  Object.assign(goal, focusRig(t));
  backEl.hidden = false;
  noteEl.style.opacity = '0';
  updateHint();
  invalidate();
}
function exitFocus() {
  mode = 'room';
  focused = null;
  Object.assign(goal, roomRig());
  backEl.hidden = true;
  noteEl.style.opacity = '1';
  updateHint();
  invalidate();
}
backEl.addEventListener('click', exitFocus);

// ── 방이 살아나는 반응
let ticking = false;
let sunlit = false;
let lampOn = false;
let lastTick = 0;
let nextChirp = 0;
let life = 0;

function complete(t: TaskState) {
  if (t.done) return;
  t.done = true;
  t.sparkle.visible = false;
  if (t.ghost) t.ghost.visible = false;
  if (t.prop.effect === 'ticking') ticking = true;
  if (t.prop.effect === 'sunlight') sunlit = true;
  if (t.prop.effect === 'lampOn') lampOn = true;
  if (t.prop.story) setTimeout(() => toast(T(t.prop.story!)), 500);
  else updateHint();
  if (mode === 'focus' && focused === t) setTimeout(exitFocus, 900);
  if (remaining() === 0) setTimeout(finish, 1400);
  invalidate();
}

function updateLife(dt: number) {
  const p = 1 - remaining() / tasks.length;
  const before = life;
  life += (p - life) * (1 - Math.exp(-dt * 1.5));
  hemi.intensity = 0.62 + life * 0.55;
  hemi.color.setRGB(0.85 + life * 0.15, 0.82 + life * 0.13, 0.78 + life * 0.08);
  sun.intensity = 0.7 + life * 0.6 + (sunlit ? 1.1 : 0);
  (motes.material as THREE.PointsMaterial).opacity = 0.6 * (1 - life);
  const lampTarget = lampOn ? 2.2 : 0;
  lampLight.intensity += (lampTarget - lampLight.intensity) * (1 - Math.exp(-dt * 4));
  const bulbGlass = built.models.bulb?.parts.glass as THREE.Mesh | undefined;
  if (bulbGlass) (bulbGlass.material as THREE.MeshStandardMaterial).emissive.setRGB(lampLight.intensity * 0.6, lampLight.intensity * 0.42, lampLight.intensity * 0.2);
  const beamMat = beam.material as THREE.MeshBasicMaterial;
  beamMat.opacity += ((sunlit ? 0.09 : 0) - beamMat.opacity) * (1 - Math.exp(-dt * 2));
  return Math.abs(life - before) > 0.0005 || Math.abs(lampLight.intensity - lampTarget) > 0.01;
}

// 창 빛줄기와 전등 위치는 소품 자리에서 가져온다
{
  const w = built.models.window?.root;
  if (w) {
    beam.position.copy(w.position).add(new THREE.Vector3(0.25, -0.95, 1.1));
    beam.rotation.set(-0.85, 0.15, 0);
  }
  const b = built.models.bulb?.root;
  const bt = tasks.find((t) => t.prop.id === 'bulb');
  if (b && bt?.target) lampLight.position.copy(bt.target.pos).add(new THREE.Vector3(0, -0.08, 0.02));
}

// ── 입력
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pointers = new Map<number, { x: number; y: number }>();
let pinchStart = 0;
let pinchZoom = 1;
let downAt = { x: 0, y: 0, t: 0 };
let rotating = false;
let wiping: { t: TaskState; last: THREE.Vector2 | null; lastTime: number } | null = null;
let dragging: { t: TaskState; obj: THREE.Object3D; plane: THREE.Plane; offset: THREE.Vector3; shard?: number } | null = null;

function setNdc(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}
function rootOf(o: THREE.Object3D) {
  while (o.parent && o.userData.propId === undefined) o = o.parent;
  return o;
}
function hitTask(objects: THREE.Object3D[]) {
  const hits = raycaster.intersectObjects(objects, true);
  for (const h of hits) {
    const id = rootOf(h.object).userData.propId;
    const t = tasks.find((x) => x.prop.id === id && !x.done);
    if (t) return { t, hit: h };
  }
  return null;
}
/** 잡은 점에서 물건 원점까지의 차이를 화면과 나란한 면 위로만 남긴다(깊이 차이는 버려 물건이 손가락 아래로 온다) */
function grabOffset(origin: THREE.Vector3, grabbed: THREE.Vector3, plane: THREE.Plane) {
  const d = origin.clone().sub(grabbed);
  return d.sub(plane.normal.clone().multiplyScalar(d.dot(plane.normal)));
}
function planeFacingCamera(through: THREE.Vector3) {
  const n = new THREE.Vector3();
  camera.getWorldDirection(n);
  return new THREE.Plane().setFromNormalAndCoplanarPoint(n.negate(), through);
}

canvas.addEventListener('pointerdown', (e) => {
  sfx.unlockAudio();
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
    pinchZoom = zoom;
    rotating = false;
    dragging = null;
    wiping = null;
    return;
  }
  if (finished) return;
  downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  setNdc(e);

  if (mode === 'focus' && focused) {
    if (focused.kind === 'wipe') {
      // 바깥에서 쓸어 들어와도 닦이도록, 손가락을 대면 어디서든 닦기를 시작한다
      wiping = { t: focused, last: null, lastTime: performance.now() };
      const h = raycaster.intersectObject(focused.dust!.overlay, false)[0];
      if (h?.uv) {
        rubAt(h.uv);
      }
    } else if (focused.kind === 'mend') {
      const open = focused.shards!.filter((s) => !s.placed).map((s) => s.mesh);
      const h = raycaster.intersectObjects(open, false)[0];
      if (h) {
        const i = focused.shards!.findIndex((s) => s.mesh === h.object);
        const root = focused.model.root;
        const center = root.getWorldPosition(new THREE.Vector3());
        const plane = planeFacingCamera(center);
        const p = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
        const shardWorld = h.object.getWorldPosition(new THREE.Vector3());
        if (p) dragging = { t: focused, obj: h.object, plane, offset: grabOffset(shardWorld, h.point, plane), shard: i };
      }
    }
    return;
  }

  // 방 보기: 흩어진 물건을 잡으면 옮기기, 반짝이·닦을 곳·접시를 누르면 가까이 보기
  // 바닥의 작은 물건은 손가락으로 맞히기 어려워 반짝이를 잡아도 물건을 잡은 것으로 본다
  const placeOpen = tasks.filter((t) => t.kind === 'place' && !t.done);
  const grab = hitTask(placeOpen.flatMap((t) => [t.model.root, t.sparkle]));
  if (grab) {
    const t = grab.t;
    const plane = planeFacingCamera(t.target!.pos);
    const p = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    if (p) {
      dragging = { t, obj: t.model.root, plane, offset: grabOffset(t.model.root.position, grab.hit.point, plane) };
      (t.ghost!.userData.mat as THREE.MeshBasicMaterial).opacity = 0.35;
      updateHint();
      invalidate();
      return;
    }
  }
  rotating = true;
});

canvas.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId);
  if (!prev) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2 && mode === 'room') {
    const [a, b] = [...pointers.values()];
    zoom = THREE.MathUtils.clamp((pinchZoom * pinchStart) / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), 0.55, 1.1);
    goal.dist = fitDist(6.3) * zoom;
    invalidate();
    return;
  }
  if (wiping) {
    // 빠르게 쓸면 이벤트 사이가 수십 픽셀 벌어진다. 화면에서 이전 위치~지금 위치를 촘촘히 따라가며 닦는다
    const steps = Math.max(1, Math.ceil(Math.hypot(e.clientX - prev.x, e.clientY - prev.y) / 10));
    const r = canvas.getBoundingClientRect();
    for (let i = 1; i <= steps && wiping; i++) {
      const x = prev.x + ((e.clientX - prev.x) * i) / steps, y = prev.y + ((e.clientY - prev.y) * i) / steps;
      ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const h = raycaster.intersectObject(wiping.t.dust!.overlay, false)[0];
      if (h?.uv) rubAt(h.uv);
      else wiping.last = null; // 표면 밖으로 나갔다 들어오면 그 사이는 잇지 않는다
    }
    return;
  }
  setNdc(e);
  if (dragging) {
    const p = raycaster.ray.intersectPlane(dragging.plane, new THREE.Vector3());
    if (!p) return;
    const world = p.add(dragging.offset);
    if (dragging.shard !== undefined) {
      const s = dragging.t.shards![dragging.shard];
      const local = dragging.t.model.root.worldToLocal(world.clone());
      s.mesh.position.copy(local);
      const k = THREE.MathUtils.clamp(1 - local.length() / 0.5, 0, 1);
      s.mesh.rotation.set(s.scatterRot.x * (1 - k), 0, s.scatterRot.z * (1 - k));
    } else {
      const t = dragging.t;
      t.model.root.position.copy(world);
      const k = THREE.MathUtils.clamp(1 - world.distanceTo(t.target!.pos) / 1.4, 0, 1);
      const q = new THREE.Quaternion().setFromEuler(t.from!.rot).slerp(new THREE.Quaternion().setFromEuler(t.target!.rot), k);
      t.model.root.quaternion.copy(q);
      (t.ghost!.userData.mat as THREE.MeshBasicMaterial).opacity = 0.3 + k * 0.35;
    }
    invalidate();
    return;
  }
  if (rotating && mode === 'room') {
    goal.yaw = THREE.MathUtils.clamp(goal.yaw - (e.clientX - prev.x) * 0.004, BASE_YAW - 0.35, BASE_YAW + 0.35);
    invalidate();
  }
});

function endPointer(e: PointerEvent) {
  pointers.delete(e.pointerId);
  if (wiping) {
    wiping = null;
    sfx.wipeStop();
  }
  if (dragging) {
    const d = dragging;
    dragging = null;
    if (d.shard !== undefined) {
      const s = d.t.shards![d.shard];
      if (s.mesh.position.length() < 0.12) {
        animateTo(s.mesh, new THREE.Vector3(), new THREE.Euler(), () => {
          s.placed = true;
          sfx.click();
          sfx.buzz();
          if (d.t.shards!.every((x) => x.placed)) {
            (d.t.model.parts.seams as THREE.Object3D).visible = true;
            sfx.sparkle();
            complete(d.t);
          }
        });
      } else animateTo(s.mesh, s.scatterPos, s.scatterRot);
    } else {
      const t = d.t;
      (t.ghost!.userData.mat as THREE.MeshBasicMaterial).opacity = 0;
      if (t.model.root.position.distanceTo(t.target!.pos) < 0.4) {
        animateTo(t.model.root, t.target!.pos, t.target!.rot, () => {
          sfx.click();
          sfx.buzz();
          complete(t);
        });
      } else animateTo(t.model.root, t.from!.pos, t.from!.rot);
    }
    updateHint();
    return;
  }
  // 짧게 누르면 가까이 보기
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  if (rotating && moved < 8 && performance.now() - downAt.t < 400 && mode === 'room' && !finished) {
    setNdc(e);
    const targets = tasks.filter((t) => !t.done && t.kind !== 'place').flatMap((t) => [t.sparkle, t.model.root]);
    const h = hitTask(targets);
    if (h) enterFocus(h.t);
    else {
      // 옮기기 작업의 반짝이를 누르면 옮기는 법을 알려 준다
      const sp = hitTask(tasks.filter((t) => !t.done && t.kind === 'place').map((t) => t.sparkle));
      if (sp) {
        hintEl.textContent = L('꾹 잡고 제자리로 끌어 주세요', 'Hold and drag it back into place');
        toastUntil = performance.now() + 1800;
      }
    }
  }
  rotating = false;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

function rubAt(uv: THREE.Vector2) {
  const w = wiping!;
  const now = performance.now();
  const speed = w.last ? w.last.distanceTo(uv) / Math.max(1, now - w.lastTime) * 60 : 0;
  // 빠르게 문지르면 이벤트 사이가 벌어지므로 사이를 메워 붓질이 끊기지 않게 한다
  let clean = 0;
  const from = w.last ?? uv;
  const steps = Math.max(1, Math.ceil(from.distanceTo(uv) / 0.03));
  for (let i = 1; i <= steps; i++) clean = w.t.dust!.rub(from.clone().lerp(uv, i / steps));
  w.last = uv.clone();
  w.lastTime = now;
  sfx.wipe(speed);
  invalidate();
  if (clean > 0.88 && !w.t.done) {
    sfx.wipeStop();
    sfx.sparkle();
    sfx.buzz(20);
    const t = w.t;
    wiping = null;
    fade(t, 0);
    complete(t);
  }
}

// ── 짧은 움직임(손을 놓은 뒤 자리로 들어가는 동작 등)
const anims: { step: (dt: number) => boolean }[] = [];
function animateTo(obj: THREE.Object3D, pos: THREE.Vector3, rot: THREE.Euler, done?: () => void) {
  const p0 = obj.position.clone();
  const q0 = obj.quaternion.clone();
  const q1 = new THREE.Quaternion().setFromEuler(rot);
  let k = 0;
  anims.push({
    step(dt) {
      k = Math.min(1, k + dt / 0.22);
      const e = 1 - Math.pow(1 - k, 3);
      obj.position.lerpVectors(p0, pos, e);
      obj.quaternion.slerpQuaternions(q0, q1, e);
      if (k >= 1) done?.();
      return k < 1;
    },
  });
  invalidate();
}
function fade(t: TaskState, k: number) {
  anims.push({
    step(dt) {
      k = Math.min(1, k + dt / 0.5);
      t.dust!.fadeOut(k);
      return k < 1;
    },
  });
}

// ── 마무리: 전후 비교와 공유 카드의 원본
let beforeShot = '';
let afterShot = '';
function capture() {
  const vis = tasks.map((t) => t.sparkle.visible);
  tasks.forEach((t) => (t.sparkle.visible = false));
  renderer.render(scene, camera);
  const url = canvas.toDataURL('image/jpeg', 0.88);
  tasks.forEach((t, i) => (t.sparkle.visible = vis[i]));
  return url;
}

function finish() {
  finished = true;
  langEl.hidden = true;
  if (mode === 'focus') exitFocus();
  goal.yaw = BASE_YAW;
  zoom = 1;
  Object.assign(goal, roomRig());
  sfx.finale();
  updateHint();
  setTimeout(() => {
    rig.target.copy(goal.target);
    Object.assign(rig, { yaw: goal.yaw, pitch: goal.pitch, dist: goal.dist });
    applyRig();
    afterShot = capture();
    finaleEl.innerHTML = `<h2>${L('복원 완료', 'Restored')}</h2><p>“${T(room.reply)}”</p>
      <div class="row"><button class="pill gold" id="btn-cmp">${L('전후 비교', 'Before / After')}</button>
      <button class="pill" id="btn-again">${L('다시 하기', 'Play again')}</button></div>`;
    finaleEl.hidden = false;
    $('btn-cmp').addEventListener('click', openCompare);
    $('btn-again').addEventListener('click', () => location.reload());
  }, 1800);
}

const cmp = $('compare');
const cmpBefore = $('cmp-before') as HTMLImageElement;
const cmpRange = $('cmp-range') as HTMLInputElement;
const cmpLine = $('cmp-line');
($('cmp-close') as HTMLButtonElement).textContent = L('닫기', 'Close');
function setCmp(v: number) {
  cmpBefore.style.clipPath = `inset(0 ${100 - v}% 0 0)`;
  cmpLine.style.left = `${v}%`;
}
function openCompare() {
  ($('cmp-after') as HTMLImageElement).src = afterShot;
  cmpBefore.src = beforeShot;
  cmp.hidden = false;
  cmpRange.value = '50';
  setCmp(50);
}
cmpRange.addEventListener('input', () => setCmp(Number(cmpRange.value)));
$('cmp-close').addEventListener('click', () => (cmp.hidden = true));

// ── 루프: 움직임이 있을 때만 그린다. 공기 먼지·시계 추는 초당 30번으로 아껴 그린다
let last = performance.now();
let lastIdle = 0;
const tmp = new THREE.Vector3();
const stats = { frames: 0, renderMs: 0 };

function loop(now: number) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  let active = stepRig(dt);
  for (let i = anims.length - 1; i >= 0; i--) if (!anims[i].step(dt)) anims.splice(i, 1);
  active ||= anims.length > 0;
  active ||= updateLife(dt);

  // 반짝이 힌트: 남은 작업 위에서 숨 쉬듯
  const pulse = 0.26 + Math.sin(now / 380) * 0.05;
  for (const t of tasks) {
    if (t.done) continue;
    sparklePos(t, t.sparkle.position);
    t.sparkle.scale.setScalar(mode === 'focus' ? 0.0001 : pulse);
  }

  if (ticking) {
    const parts = built.models['wall-clock'].parts;
    parts.bob.position.x = Math.sin(now / 318) * 0.05;
    if (now - lastTick > 1000) {
      lastTick = now;
      parts.second.rotation.z -= Math.PI / 30;
      parts.minute.rotation.z -= Math.PI / 1800;
      sfx.tick(Math.round(now / 1000) % 2 === 0);
    }
  }
  if (sunlit && now > nextChirp) {
    nextChirp = now + 4000 + Math.random() * 6000;
    sfx.chirp();
  }

  const idleAnim = life < 0.98 || ticking;
  if (!active && !dirty && !(idleAnim && now - lastIdle > 33)) return;
  if (idleAnim) {
    lastIdle = now;
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3 + 1] += Math.sin(now / 1700 + i) * 0.0008;
      motePos[i * 3] += Math.cos(now / 2300 + i * 1.7) * 0.0006;
    }
    motesGeo.attributes.position.needsUpdate = true;
  }
  dirty = false;
  const t0 = performance.now();
  renderer.render(scene, camera);
  stats.frames++;
  stats.renderMs += performance.now() - t0;
  tmp.set(0, 0, 0);
}

let resizeTimer = 0;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(resize, 50);
});
resize();
rig.target.copy(goal.target);
Object.assign(rig, { yaw: goal.yaw, pitch: goal.pitch, dist: goal.dist });
applyRig();
updateHint();
requestAnimationFrame(loop);
setTimeout(() => (beforeShot = capture()), 400);

// 개발·촬영용 훅(쓸어킬의 __neon 과 같은 역할)
Object.assign(window, {
  __demo: {
    seed,
    tasks: () => tasks.map((t) => ({ id: t.prop.id, kind: t.kind, done: t.done })),
    complete: (id: string) => {
      const t = tasks.find((x) => x.prop.id === id);
      if (!t || t.done) return;
      if (t.kind === 'wipe') t.dust!.fadeOut(1);
      if (t.kind === 'place') {
        t.model.root.position.copy(t.target!.pos);
        t.model.root.rotation.copy(t.target!.rot);
      }
      if (t.kind === 'mend') {
        t.shards!.forEach((s) => {
          s.mesh.position.set(0, 0, 0);
          s.mesh.rotation.set(0, 0, 0);
          s.placed = true;
        });
        (t.model.parts.seams as THREE.Object3D).visible = true;
      }
      complete(t);
    },
    focus: (id: string) => {
      const t = tasks.find((x) => x.prop.id === id);
      if (t && t.kind !== 'place') enterFocus(t);
    },
    back: exitFocus,
    /** 물건의 지금 자리와 정답 자리가 화면(CSS 픽셀) 어디인지(촬영·자동 시험용) */
    screen: (id: string) => {
      const t = tasks.find((x) => x.prop.id === id);
      if (!t) return null;
      const r = canvas.getBoundingClientRect();
      const toScreen = (v: THREE.Vector3) => {
        const p = v.clone().project(camera);
        return [Math.round(r.left + ((p.x + 1) / 2) * r.width), Math.round(r.top + ((1 - p.y) / 2) * r.height)];
      };
      const now = t.model.root.getWorldPosition(new THREE.Vector3());
      return { now: toScreen(now), target: t.target ? toScreen(t.target.pos) : null, shards: t.shards?.map((s) => {
          s.mesh.geometry.computeBoundingSphere();
          return { origin: toScreen(s.mesh.getWorldPosition(new THREE.Vector3())), body: toScreen(s.mesh.localToWorld(s.mesh.geometry.boundingSphere!.center.clone())), placed: s.placed };
        }) };
    },
    stats: () => ({ ...stats, avgRenderMs: stats.renderMs / Math.max(1, stats.frames), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    hideHud: (hide = true) => ($('hud').style.display = hide ? 'none' : ''),
  },
});
