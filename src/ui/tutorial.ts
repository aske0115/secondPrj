// 따라 하는 튜토리얼(결정 020). 화면을 어둡게 하고 할 곳만 밝혀, 정해진 동작만 받는다.
// 1부(1스테이지): 빨간 칸 → 아무것도 안 하면 지는 장면 → 같은 판에서 개 이동·늑대 밀기로 이기는 장면 / 2부(3스테이지): 늑대가 늑대를 물게 하기 → 턴 끝내기 → 마지막은 스스로
import { L } from '../i18n';

type Gate = { tile: [number, number] } | 'end' | 'next';
interface Step {
  text: () => string;
  /** 밝힐 칸들(없으면 화면 가운데 안내) */
  tiles?: [number, number][];
  /** 칸 대신 밝힐 요소 */
  el?: string;
  gate: Gate;
  /** '다음'을 누른 뒤 할 일(판 다시 놓기 등) */
  after?: (host: Host) => void;
}

export interface Host {
  load(stageIndex: number): void;
  tileRect(x: number, y: number): DOMRect;
}

const PART1: Step[] = [
  { text: () => L('🐕 양치기 개로 🐺 늑대에게서 🐑 양을 지키는 게임이에요.', '🐕 Use your sheepdog to protect the 🐑 sheep from the 🐺 wolves.'), gate: 'next' },
  {
    text: () => L('늑대는 <b>화살표 쪽 칸</b>을 물어요.<br>빨간 칸이 이번 턴에 물릴 자리예요. 양이 위험해요!', 'A wolf bites the tile its <b>arrow</b> points to.<br>The red tile will be bitten this turn — the sheep is in danger!'),
    tiles: [[2, 2], [3, 2]],
    gate: 'next',
  },
  // 지는 장면을 먼저 직접 본다
  {
    text: () => L('먼저 <b>아무것도 안 하면</b> 어떻게 되는지 볼까요?<br>턴 끝내기를 눌러 보세요.', 'First, let’s see what happens if you <b>do nothing</b>.<br>Tap End turn.'),
    el: 'end',
    gate: 'end',
  },
  {
    text: () => L('<span class="big lose">패배 😢</span>늑대가 빨간 칸의 양을 물었어요.<br><b>양을 모두 잃으면 져요.</b>', '<span class="big lose">Defeat 😢</span>The wolf bit the sheep on the red tile.<br><b>Lose all your sheep and you lose.</b>'),
    gate: 'next',
    after: (host) => host.load(0),
  },
  { text: () => L('이번엔 개로 양을 지켜 봐요. 같은 판을 다시 놓았어요.', 'Now let’s protect it with the dog. Same board again.'), gate: 'next' },
  {
    text: () => L('개는 <b>흰 점</b> 칸으로 2칸까지 움직여요.<br>늑대 바로 위 칸을 눌러 보세요.', 'Your dog can move up to 2 tiles to the <b>white dots</b>.<br>Tap the tile right above the wolf.'),
    tiles: [[1, 1], [2, 1]],
    gate: { tile: [2, 1] },
  },
  {
    text: () => L('늑대에 <b>▼</b> 화살표가 떴어요.<br>늑대를 누르면 그쪽으로 밀어요.', 'A <b>▼</b> appeared on the wolf.<br>Tap the wolf to push it that way.'),
    tiles: [[2, 2]],
    gate: { tile: [2, 2] },
  },
  {
    text: () => L('늑대가 강에 떠내려갔어요! 🌊<br>강·바위·다른 늑대 쪽으로 밀어서 늑대를 막아요.', 'Swept away by the river! 🌊<br>Push wolves into rivers, rocks or other wolves.'),
    tiles: [[0, 3], [4, 3]],
    gate: 'next',
  },
  {
    text: () => L('<span class="big win">승리! ★★★</span>늑대를 모두 물리치거나 정해진 턴을 버티면 이겨요.<br>양을 <b>하나도 안 잃으면 별 3개</b>예요.', '<span class="big win">Victory! ★★★</span>Defeat every wolf, or hold out for the set turns.<br>Lose <b>no sheep</b> for 3 stars.'),
    tiles: [[3, 2]],
    gate: 'next',
  },
];

const PART2: Step[] = [
  {
    text: () => L('이번엔 늑대가 둘이에요.<br>오른쪽 늑대가 양을 노리고 있어요.', 'Two wolves this time.<br>The right one is after the sheep.'),
    tiles: [[2, 2], [3, 2]],
    gate: 'next',
  },
  {
    text: () => L('위쪽 늑대는 아래를 보고 있어요.<br><b>밀려도 보는 방향은 그대로</b>예요. 이걸 이용해요!', 'The top wolf faces down.<br><b>Pushed wolves keep facing the same way.</b> Use that!'),
    tiles: [[1, 1], [1, 2]],
    gate: 'next',
  },
  { text: () => L('개를 늑대 왼쪽 칸으로 옮기세요.', 'Move your dog to the left of that wolf.'), tiles: [[0, 0], [0, 1]], gate: { tile: [0, 1] } },
  { text: () => L('늑대를 오른쪽으로 밀어 보세요.', 'Now push the wolf to the right.'), tiles: [[1, 1]], gate: { tile: [1, 1] } },
  {
    text: () => L('보세요! 위쪽 늑대의 빨간 칸이<br>이제 <b>다른 늑대</b> 위에 있어요.', 'Look! The top wolf’s red tile<br>is now on <b>the other wolf</b>.'),
    tiles: [[2, 1], [2, 2]],
    gate: 'next',
  },
  { text: () => L('할 일을 마치면 <b>턴 끝내기</b>.<br>이제 늑대 차례예요.', 'When you’re done, tap <b>End turn</b>.<br>Then the wolves move.'), el: 'end', gate: 'end' },
  {
    text: () => L('늑대가 늑대를 물었어요! 🐺💥<br>남은 늑대가 다시 양을 노려요. <b>이번엔 혼자 막아 보세요.</b>', 'A wolf bit a wolf! 🐺💥<br>The last wolf is after the sheep. <b>Stop it on your own.</b>'),
    gate: 'next',
  },
];

export class Tutorial {
  active = false;
  private steps: Step[] = [];
  private i = 0;
  private part = 0;
  private coach: HTMLDivElement;
  private spot: HTMLDivElement;
  private bubble: HTMLDivElement;

  constructor(private host: Host) {
    this.coach = document.createElement('div');
    this.coach.id = 'coach';
    this.spot = document.createElement('div');
    this.spot.className = 'spot';
    this.bubble = document.createElement('div');
    this.bubble.className = 'bubble';
    this.coach.append(this.spot, this.bubble);
    this.coach.hidden = true;
    document.body.appendChild(this.coach);
  }

  /** 늑대 차례 동안은 덮개를 걷어 물기 장면이 잘 보이게 한다(끝나면 notify가 다음 안내를 띄움) */
  pause() {
    if (this.active) this.coach.hidden = true;
  }

  /** 판 크기가 바뀌면 밝힌 자리를 다시 맞춘다 */
  refresh() {
    if (this.active) this.show();
  }

  static done() {
    try {
      return localStorage.getItem('tutorialDone') === '1';
    } catch {
      return false;
    }
  }

  start() {
    this.active = true;
    this.part = 1;
    this.host.load(0);
    this.run(PART1);
  }

  private run(steps: Step[]) {
    this.steps = steps;
    this.i = 0;
    requestAnimationFrame(() => this.show());
  }

  /** 지금 단계가 이 동작을 막는지(튜토리얼 밖이면 아무것도 막지 않음) */
  blocks(action: { tile: [number, number] } | 'end' | 'other') {
    if (!this.active) return false;
    const g = this.steps[this.i]?.gate;
    if (!g || g === 'next') return true;
    if (g === 'end') return action !== 'end';
    return !(typeof action === 'object' && action.tile[0] === g.tile[0] && action.tile[1] === g.tile[1]);
  }

  /** 본 화면이 동작을 마쳤다고 알려 준다 */
  notify(action: { tile: [number, number] } | 'end') {
    if (!this.active || this.blocks(action)) return;
    this.next();
  }

  private next() {
    this.steps[this.i]?.after?.(this.host);
    this.i++;
    if (this.i < this.steps.length) return this.show();
    if (this.part === 1) {
      this.part = 2;
      this.host.load(2);
      return this.run(PART2);
    }
    this.finish();
  }

  finish() {
    this.active = false;
    this.coach.hidden = true;
    try {
      localStorage.setItem('tutorialDone', '1');
    } catch {
      /* 저장 실패 시 다음 실행에 다시 나옴 */
    }
  }

  private show() {
    const step = this.steps[this.i];
    if (!step) return;
    this.coach.hidden = false;
    // '다음' 단계는 화면 전체를 막고, 동작 단계는 밝힌 곳 아래로 손가락이 지나가게 한다
    this.coach.classList.toggle('blocking', step.gate === 'next');
    let rect: DOMRect | null = null;
    if (step.tiles) rect = step.tiles.map(([x, y]) => this.host.tileRect(x, y)).reduce(union);
    else if (step.el) rect = document.getElementById(step.el)!.getBoundingClientRect();
    const pad = 6;
    if (rect) {
      Object.assign(this.spot.style, {
        display: 'block', left: `${rect.left - pad}px`, top: `${rect.top - pad}px`,
        width: `${rect.width + pad * 2}px`, height: `${rect.height + pad * 2}px`,
      });
    } else Object.assign(this.spot.style, { display: 'block', left: '50%', top: '40%', width: '0px', height: '0px' });
    this.spot.classList.toggle('pulse', step.gate !== 'next');

    const last = this.part === 2 && this.i === this.steps.length - 1;
    const btn = step.gate === 'next' ? `<button class="pill gold">${last ? L('해 볼게요', 'Let me try') : L('다음', 'Next')}</button>` : '';
    this.bubble.innerHTML = `<p>${step.text()}</p>${btn}<span class="skip">${L('건너뛰기', 'Skip')}</span>`;
    this.bubble.querySelector('button')?.addEventListener('click', () => this.next());
    this.bubble.querySelector('.skip')!.addEventListener('click', () => this.finish());
    // 밝힌 곳과 겹치지 않게 위나 아래에 말풍선
    const h = innerHeight;
    const b = this.bubble;
    b.style.top = b.style.bottom = '';
    if (!rect) b.style.bottom = `${h * 0.16}px`; // 첫 안내는 판을 가리지 않게 아래쪽에
    else if (rect.top + rect.height / 2 > h * 0.62) b.style.bottom = `${h - rect.top + pad + 14}px`;
    else {
      // 판 아래 빈자리(버튼 바로 위)에 두어 늑대·양을 가리지 않게. 그래도 밝힌 곳과 겹치면 그 바로 아래로
      const bar = document.getElementById('bar')!.getBoundingClientRect();
      b.style.bottom = `${h - bar.top + 6}px`;
      if (b.getBoundingClientRect().top < rect.bottom + pad + 8) {
        b.style.bottom = '';
        b.style.top = `${rect.bottom + pad + 14}px`;
      }
    }
  }
}

function union(a: DOMRect, b: DOMRect) {
  const l = Math.min(a.left, b.left), t = Math.min(a.top, b.top);
  return new DOMRect(l, t, Math.max(a.right, b.right) - l, Math.max(a.bottom, b.bottom) - t);
}
