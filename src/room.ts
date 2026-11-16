// 방 데이터(content/rooms/*.json)를 장면으로 만든다. 작업 종류별 상태도 여기서 만든다.
import * as THREE from 'three';
import type { Prop, Room, Vec3 } from './content/types';
import { buildModel, type Model } from './models';

const DEG = Math.PI / 180;
export const toEuler = (r?: Vec3) => new THREE.Euler((r?.[0] ?? 0) * DEG, (r?.[1] ?? 0) * DEG, (r?.[2] ?? 0) * DEG);

/** 같은 시드면 같은 엉망(결정 011: 오늘의 의뢰는 모두 같은 판) */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 닦기: 표면 위에 먼지 막을 덮고, 문지른 자리만 지운다 */
export class Dust {
  readonly overlay: THREE.Mesh;
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private grid: Float32Array;
  private mask: Uint8Array;
  private total = 0;
  private static N = 32;
  private static S = 256;

  constructor(surface: THREE.Mesh, seed: () => number) {
    const S = Dust.S;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    this.ctx = cv.getContext('2d')!;
    const c = this.ctx;
    c.fillStyle = 'rgba(190,180,160,0.96)';
    c.fillRect(0, 0, S, S);
    // 얼룩덜룩한 먼지(색은 한 가지 계열로, 밝기만 다르게)
    for (let i = 0; i < 260; i++) {
      const r = 4 + seed() * 22;
      const v = 140 + seed() * 60;
      c.fillStyle = `rgba(${v},${v * 0.93},${v * 0.82},${0.15 + seed() * 0.3})`;
      c.beginPath();
      c.arc(seed() * S, seed() * S, r, 0, Math.PI * 2);
      c.fill();
    }
    this.tex = new THREE.CanvasTexture(cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.overlay = new THREE.Mesh(
      surface.geometry,
      // 먼지는 어두운 방에서도 "뿌연 막"으로 읽혀야 해서 스스로 조금 밝게 한다
      new THREE.MeshStandardMaterial({
        map: this.tex, emissive: '#ffffff', emissiveMap: this.tex, emissiveIntensity: 0.35,
        transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2,
      }),
    );
    this.overlay.position.z = 0.003;
    this.overlay.renderOrder = 2;
    surface.add(this.overlay);

    const N = Dust.N;
    this.grid = new Float32Array(N * N).fill(1);
    this.mask = new Uint8Array(N * N);
    const round = surface.geometry instanceof THREE.CircleGeometry;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const u = (x + 0.5) / N - 0.5, v = (y + 0.5) / N - 0.5;
        const inside = !round || u * u + v * v < 0.2;
        this.mask[y * N + x] = inside ? 1 : 0;
        if (inside) this.total++;
      }
  }

  /** uv 자리를 문지른다. 깨끗해진 비율(0~1)을 돌려준다 */
  rub(uv: THREE.Vector2, radius = 0.09) {
    const S = Dust.S, N = Dust.N;
    const px = uv.x * S, py = (1 - uv.y) * S, pr = radius * S;
    const c = this.ctx;
    c.globalCompositeOperation = 'destination-out';
    const g = c.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(px, py, pr, 0, Math.PI * 2);
    c.fill();
    c.globalCompositeOperation = 'source-over';
    this.tex.needsUpdate = true;
    const gr = radius * N;
    for (let y = Math.max(0, Math.floor(uv.y * N - gr)); y < Math.min(N, Math.ceil(uv.y * N + gr)); y++)
      for (let x = Math.max(0, Math.floor(uv.x * N - gr)); x < Math.min(N, Math.ceil(uv.x * N + gr)); x++) {
        const d = Math.hypot(x + 0.5 - uv.x * N, y + 0.5 - uv.y * N) / gr;
        if (d < 1) this.grid[y * N + x] = Math.max(0, this.grid[y * N + x] - 0.45 * (1 - d));
      }
    return this.clean();
  }

  clean() {
    let c = 0;
    for (let i = 0; i < this.grid.length; i++) if (this.mask[i] && this.grid[i] < 0.25) c++;
    return c / this.total;
  }

  /** 남은 먼지를 서서히 걷어 낸다(마무리) */
  fadeOut(k: number) {
    (this.overlay.material as THREE.MeshStandardMaterial).opacity = 1 - k;
    this.overlay.visible = k < 1;
  }
}

export interface Shard {
  mesh: THREE.Mesh;
  placed: boolean;
  scatterPos: THREE.Vector3;
  scatterRot: THREE.Euler;
}

export interface TaskState {
  prop: Prop;
  model: Model;
  kind: 'wipe' | 'place' | 'mend';
  done: boolean;
  /** 닦기 */
  dust?: Dust;
  surface?: THREE.Mesh;
  /** 제자리 놓기: 정답 자리와 흐린 실루엣 */
  ghost?: THREE.Group;
  target?: { pos: THREE.Vector3; rot: THREE.Euler };
  from?: { pos: THREE.Vector3; rot: THREE.Euler };
  /** 붙이기 */
  shards?: Shard[];
  /** 반짝이 힌트 */
  sparkle: THREE.Sprite;
}

function sparkleTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,248,220,1)');
  g.addColorStop(0.25, 'rgba(255,220,140,0.6)');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  c.fillStyle = 'rgba(255,255,240,0.95)';
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 ? 12 : 56;
    c.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
  }
  c.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface BuiltRoom {
  group: THREE.Group;
  tasks: TaskState[];
  models: Record<string, Model>;
}

export function buildRoom(room: Room, seed: number): BuiltRoom {
  const rand = rng(seed);
  const group = new THREE.Group();
  const { wall, floor, trim } = room.palette;

  // 단면 방: 바닥 + 뒷벽 + 왼쪽 벽
  const W = 6, D = 4.5, H = 3.4;
  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, D), new THREE.MeshStandardMaterial({ color: floor, roughness: 0.8 }));
  floorMesh.position.y = -0.06;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);
  // 마룻바닥 줄
  for (let i = 1; i < 10; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(W, 0.002, 0.012), new THREE.MeshStandardMaterial({ color: '#5e3f28' }));
    line.position.set(0, 0.001, -D / 2 + (i * D) / 10);
    group.add(line);
  }
  const wallMat = new THREE.MeshStandardMaterial({ color: wall, roughness: 0.95 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.12), wallMat);
  back.position.set(0, H / 2, -D / 2 - 0.06);
  back.receiveShadow = true;
  group.add(back);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.12, H, D + 0.12), wallMat);
  left.position.set(-W / 2 - 0.06, H / 2, -0.06);
  left.receiveShadow = true;
  group.add(left);
  const trimMat = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.6 });
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(W, 0.16, 0.04), trimMat);
  b1.position.set(0, 0.08, -D / 2 + 0.02);
  group.add(b1);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, D), trimMat);
  b2.position.set(-W / 2 + 0.02, 0.08, 0);
  group.add(b2);
  // 벽지 아래쪽 판넬
  const wains = new THREE.Mesh(new THREE.BoxGeometry(W, 1.0, 0.02), new THREE.MeshStandardMaterial({ color: '#b39470', roughness: 0.8 }));
  wains.position.set(0, 0.5, -D / 2 + 0.005);
  wains.receiveShadow = true;
  group.add(wains);
  // 방 테두리(디오라마 받침)
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.3, D + 0.3), new THREE.MeshStandardMaterial({ color: '#3a281b', roughness: 0.7 }));
  base.position.set(-0.075, -0.27, -0.075);
  base.receiveShadow = true;
  group.add(base);

  const sparkTex = sparkleTexture();
  const tasks: TaskState[] = [];
  const models: Record<string, Model> = {};

  for (const prop of room.props) {
    const model = buildModel(prop.model);
    models[prop.id] = model;
    const pos = new THREE.Vector3(...prop.pos);
    const rot = toEuler(prop.rot);
    model.root.position.copy(pos);
    model.root.rotation.copy(rot);
    model.root.userData.propId = prop.id;
    group.add(model.root);
    if (!prop.task) continue;

    const sparkle = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, depthTest: false, transparent: true }));
    sparkle.scale.setScalar(0.32);
    sparkle.renderOrder = 10;
    sparkle.userData.propId = prop.id;
    group.add(sparkle);
    const t: TaskState = { prop, model, kind: prop.task.kind, done: false, sparkle };

    if (prop.task.kind === 'wipe') {
      const surface = model.surfaces[prop.task.surface];
      if (!surface) throw new Error(`${prop.id}: 표면 ${prop.task.surface} 없음`);
      t.surface = surface;
      t.dust = new Dust(surface, rand);
    } else if (prop.task.kind === 'place') {
      t.target = { pos: pos.clone(), rot: rot.clone() };
      t.from = { pos: new THREE.Vector3(...prop.task.from.pos), rot: toEuler(prop.task.from.rot) };
      model.root.position.copy(t.from.pos);
      model.root.rotation.copy(t.from.rot);
      const ghost = buildModel(prop.model).root;
      const ghostMat = new THREE.MeshBasicMaterial({ color: '#fff4d6', transparent: true, opacity: 0, depthWrite: false });
      ghost.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          (o as THREE.Mesh).material = ghostMat;
          o.castShadow = false;
        }
      });
      ghost.position.copy(pos);
      ghost.rotation.copy(rot);
      ghost.userData.mat = ghostMat;
      group.add(ghost);
      t.ghost = ghost;
    } else {
      // 붙이기: 조각을 카운터 위에 흩뜨린다(자리는 시드로)
      const spots = [
        [-0.36, 0.2], [-0.32, -0.2], [0.17, 0.26], [0.18, -0.24],
      ].sort(() => rand() - 0.5);
      t.shards = model.shards.map((mesh, i) => {
        const [dx, dz] = spots[i];
        const scatterPos = new THREE.Vector3(dx + (rand() - 0.5) * 0.05, -0.235, dz + (rand() - 0.5) * 0.05);
        const scatterRot = new THREE.Euler(-Math.PI / 2, 0, rand() * Math.PI * 2, 'XYZ');
        mesh.position.copy(scatterPos);
        mesh.rotation.copy(scatterRot);
        return { mesh, placed: false, scatterPos, scatterRot };
      });
    }
    tasks.push(t);
  }
  return { group, tasks, models };
}

/** 반짝이 힌트가 떠 있을 자리 */
export function sparklePos(t: TaskState, out: THREE.Vector3) {
  if (t.kind === 'wipe') t.surface!.getWorldPosition(out);
  else if (t.kind === 'place') t.model.root.getWorldPosition(out).add(new THREE.Vector3(0, 0.25, 0));
  else t.model.root.getWorldPosition(out);
  return out.add(new THREE.Vector3(0.08, 0.12, 0.12));
}
