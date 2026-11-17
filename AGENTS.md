# AGENTS.md — 두 번째 게임 망치섬(Tumble Isle) 작업 규칙

이 저장소에서 작업하는 사람·AI 에이전트가 먼저 읽는 문서입니다.

> 시작할 때: `docs/TODO.md`(할 일) → `docs/DECISIONS.md`(결정) → `docs/HANDOFF.md`(최신 상태) → 최신 `docs/worklogs/`를 읽습니다.
> 마칠 때: TODO의 끝난 항목을 ✅로 바꾸고, `docs/worklogs/<날짜>.md`에 기록하고, HANDOFF 맨 위 "최신"을 고친 뒤 **커밋·푸시까지** 합니다(결정 006).

## 대화·문서 언어
- 사용자와의 대화, 커밋 메시지, 문서, 코드 주석은 **한국어(존댓말)**로 씁니다. 코드 식별자·명령어·경로만 영어로 씁니다.
- 게임 안 문구는 **처음부터 한국어·영어 두 벌**로 씁니다(쓸어킬의 `L("한국어", "English")` 방식).

## 프로젝트 한 줄
하늘에 뜬 작은 섬에서 적을 쓸어 떨어뜨리는 **2분짜리 미니어처 서바이버**(결정 032). 네온 도형이 아니라 **Kenney CC0 로우폴리 모델**을 쓰는 화풍입니다(결정 033, `docs/ASSETS.md`).

## 콘텐츠 추가 규칙
- 새 방·소품·고장 유형·이야기는 **`content/` 데이터 파일로만** 추가합니다. 게임 코드를 고치지 않습니다(결정 012, `docs/CONTENT_PIPELINE.md`).
- 추가 뒤 자동 검사(`content:check`, 예정)를 통과시키고 미리보기 이미지로 사람의 승인을 받습니다.

## 저장소 규칙
- 원격: `https://github.com/aske0115/secondPrj` (**공개 저장소**).
- 작업이 끝날 때마다 한국어 커밋 → `git fetch` → 정상 푸시합니다. **강제 푸시 금지.** 원격이 앞서 있으면 통합 후 검증하고 다시 푸시합니다.
- 커밋 작성자는 개인 계정(`GeunHwa Lee <26166444+aske0115@users.noreply.github.com>`)입니다. 회사 계정으로 커밋하지 않습니다.
- **재배포가 금지된 그래픽·사운드 에셋 원본은 커밋하지 않습니다**(결정 005). 공개 저장소에 올리는 것 자체가 재배포입니다. 그런 에셋은 `assets/vendor/`(git 제외)에 두고, 받는 방법을 `docs/ASSETS.md`에 적습니다. CC0 에셋과 직접 만든 에셋만 커밋할 수 있습니다.

## 마케팅·문구 원칙 (쓸어킬에서 이어받음)
- 스토어·홍보 문구에 **경쟁 게임 이름을 쓰지 않습니다.** "정리 퍼즐·복원·힐링 퍼즐" 같은 장르어만 씁니다.
- 홍보 문구에 **플레이 시간 숫자(3분·1분 등)를 넣지 않습니다.**
- 홍보는 **무료 방법만** 씁니다. 커뮤니티(카페·게시판·레딧) 홍보 글은 하지 않습니다.
- 결과 공유 카드·홍보 촬영 모드(HUD 숨김)·스토어 리뷰 요청은 **v1에 넣습니다.**
- 기획이 바뀌면 마케팅·스토어 문서도 **같은 커밋에서** 고칩니다(쓸어킬에서 옛 기획 문구가 영상에 들어간 교훈).

## 역할별 담당 (에이전트 팀)
역할 정의는 개인 저장소 `aske0115/agent-team`(설치: `python3 install.py` → `~/.claude/agents/`). 메인 세션이 PD로서 나눠 맡긴다. 각 역할은 **아래 자기 담당 파일만** 고친다.

> **화풍 주의(디자인 담당)**: 역할 정의에 "코드로 그린 네온 스타일"이라고 적혀 있어도 그건 쓸어킬 기준입니다. 망치섬은 **Kenney CC0 로우폴리 디오라마**(밝은 하늘·잔디·틸트시프트, 결정 033)이고 네온·빛 번짐을 섞지 않습니다. 새 모델은 CC0만, 받은 곳·라이선스는 `docs/ASSETS.md`에.

역할에게는 브라우저 도구가 없으므로 게임 안 확인은 **`scripts/demo.mjs`**(Playwright + 이 맥의 Chrome, 창 없이 실행)로 한다. 개발 서버를 먼저 띄운다: `npm run dev &` (포트 5317), 끝나면 끈다.
`npm exec --yes --package=playwright@1.65.0 -- node scripts/demo.mjs --eval "<__demo 식>" [--shot 파일.png] [--size 375x812] [--meta '{"cleared":60,"coins":5000}']`
- 실행마다 임시 프로필이라 늘 새 사용자로 시작한다. 해금된 장·코인 있는 상점을 보려면 `--meta`로 진행 상태를 넣는다.
- `--eval`은 세미콜론으로 문장을 나누므로 문자열 안에 `;`를 쓰지 않는다. 창 없는 Chrome의 `bench`·`stats` 수치는 실기기 성능이 아니다.

| 역할 | 담당 파일 | 확인 방법 |
|---|---|---|
| 기획 `planner` | `docs/DECISIONS.md`, `docs/TODO.md`, `docs/HANDOFF.md`, `docs/worklogs/`, `src/game/chapters.ts`의 장 구성(이름·모델·소품·장치), `src/game/missions.ts`의 미션 문구 | 이전 결정과 충돌 없는지 |
| 난이도 `balance` | `src/game/rules.ts`, `src/game/meta.ts`(강화 값·효과·보상), `src/game/chapters.ts`의 `stageDef` 수치, `src/game/missions.ts` 보상, `scripts/demo.mjs` | `npm test` + `demo.mjs --eval "__demo.setPerks({shove:10}); await __demo.bot(20, 0.85, 50, true)"`(스테이지 번호 0~149, 마지막 인자는 왕좀비 노림), 처음~끝 `--eval "await __demo.campaign(300)"` 전후 비교. 봇 기준: 서툼 0.85가 사람 수준(봇이 사람보다 잘함) |
| 디자인 `design` | `src/style.css`, `index.html`, `src/main.ts`의 화면 마크업(`show*` 함수들), `public/models/`·`docs/ASSETS.md`, `docs/art/`, 아이콘·시작 화면(`ios/App/App/Assets.xcassets`, `android/app/src/main/res/`의 mipmap·splash) | `demo.mjs --shot`으로 휴대폰 `--size 375x812`·태블릿 `1280x800`·펼친 폴더블 가로 `1000x780`, 장 화면은 `--eval "await __demo.goStage(45)"`. 아이콘·시작 화면 원본 촬영은 `__demo.shot('icon'\|'splash')`(→ `docs/art/`) |
| 광고 `ads` | `src/ads.ts`, `src/main.ts`의 광고 자리(`offerContinue`·`doubleBtn`·`onAd`·상점 무료 캡슐), `.env.release` | `npm test`, 개발 서버는 1초짜리 가짜 광고(`demo.mjs`로 흐름 확인 가능). 실제 단위는 `npm run build:release` 결과에만 있고 `npm run build` 결과엔 0개인지 `grep 5960388113203280/ dist/assets/*.js` |
| 배포 `release` | `ios/`, `android/`(아이콘·스플래시 제외), `capacitor.config.ts`, `package.json` 스크립트, 출시 문서 | `npm run native:release` → 빌드 → `npm run native`로 되돌린 뒤 실제 광고 단위 0개 확인. iOS·안드로이드 둘 다 동기화 |
| 검수 `qa` | 고치지 않음(보고만) | `npm test`, `npx tsc --noEmit`, 성능은 `demo.mjs --eval "__demo.bench()"`·`"__demo.stats()"`, 화면은 `demo.mjs --shot` |

- `src/main.ts`(약 2,000줄)는 여러 역할이 같이 건드린다. PD가 순서를 정해 한 번에 한 역할만 고친다.
- 되돌리기 어려운 일(스토어 제출·검토 전송·AdMob/스토어 콘솔 저장·배포)은 어느 역할도 직접 하지 않고 사용자 확인을 받는다.
- 개발 서버의 `__demo` 훅은 `src/main.ts` 끝에 모여 있다(출시 빌드에도 들어 있지만 화면에서 부를 길은 없음).
