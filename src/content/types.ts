// 콘텐츠 데이터 형식(결정 012). 방은 코드가 아니라 content/rooms/*.json 으로 추가한다.
// AI가 이 파일과 예시 방(clock-shop.json)만 읽고 새 방을 쓸 수 있도록 칸마다 뜻을 적는다.
import type { Text } from '../i18n';

export type Vec3 = [number, number, number];

/** 방이 살아나는 반응. 작업을 끝내면 방에 일어나는 일 */
export type Effect = 'ticking' | 'lampOn' | 'sunlight';

export type Task =
  /** 닦기: 모델의 표면(surface) 위 먼지를 문질러 지운다. focus는 가까이 볼 때 카메라 */
  | { kind: 'wipe'; surface: string; focus: Focus }
  /** 제자리 놓기: from 자리에 흐트러져 있다가 prop의 pos/rot(정답 자리)로 끌어 놓는다 */
  | { kind: 'place'; from: { pos: Vec3; rot: Vec3 } }
  /** 붙이기: 모델의 조각(shards)이 흩어져 있고, 하나씩 끌어 맞춘다. 흩어짐은 시드로 정해진다 */
  | { kind: 'mend'; focus: Focus };

export interface Focus {
  /** 가까이 볼 때 카메라 방향(라디안). 0이면 뒷벽 정면, π/2면 왼쪽 벽 정면 */
  yaw: number;
  pitch: number;
  /** 화면에 담을 크기(미터) */
  size: number;
}

export interface Prop {
  id: string;
  /** src/models.ts 의 모델 이름. 나중에 무료 3D 모델(glTF)로 바뀌어도 이름은 유지 */
  model: string;
  pos: Vec3;
  /** 도(degree) 단위 회전 */
  rot?: Vec3;
  task?: Task;
  /** 작업을 끝냈을 때 방의 반응 */
  effect?: Effect;
  /** 작업을 끝냈을 때 열리는 이야기 한 줄 */
  story?: Text;
  /** 작업 이름(안내 문구에 쓰임) */
  name?: Text;
}

export interface Room {
  id: string;
  title: Text;
  /** 손님 쪽지(도착할 때) */
  note: Text;
  /** 손님 답장(복원을 마쳤을 때) */
  reply: Text;
  palette: { wall: string; floor: string; trim: string };
  props: Prop[];
}
