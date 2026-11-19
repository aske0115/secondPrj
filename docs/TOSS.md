# 망치섬 토스(앱인토스) 미니앱 출시 계획

2026-11-19 작성. 근거는 앱인토스 개발자 문서(https://developers-apps-in-toss.toss.im/, SDK 3.x 기준)입니다.
콘솔: 워크스페이스 「다은아빠」 로그인 완료, 앱 0개(아직 안 만듦).

## 한 줄 요약
게임 코드는 그대로 두고, **토스판 빌드에서 Capacitor 기능 3곳(광고·진동·앱 상태/뒤로가기)만 앱인토스 SDK로 갈아 끼웁니다.**
용량(빌드 7MB)은 한도 100MB에 넉넉하고, 사운드 끄기·백그라운드 소리 정지는 이미 있습니다.

## 코드에서 바꿀 곳 (점검 결과)

| 지금(Capacitor) | 위치 | 토스판 |
|---|---|---|
| AdMob 보상형 `@capacitor-community/admob` | `src/ads.ts` | `loadFullScreenAd` → `loaded` → `showFullScreenAd`, 보상은 `userEarnedReward`에서만. 테스트 ID `ait-ad-test-rewarded-id`. 외부 광고 SDK 금지 |
| 진동 `Haptics.impact` | `src/audio.ts:155` | `Device.triggerHaptic({ type: 'tap' \| 'tickMedium' })` |
| `App.addListener('appStateChange')` | `src/audio.ts:47`, `src/main.ts:598` | 웹 `visibilitychange`로 충분(이미 같이 있음) → 토스판에선 건너뜀 |
| `App.addListener('backButton')` | `src/main.ts:2227` | 앱인토스 뒤로가기 이벤트로 교체(문서 확인 필요). 「뒤로가기 또는 종료」 규칙 |
| 공유 `navigator.share` | `src/main.ts:2019` | 웹뷰에서 동작하는지 실기기 확인, 안 되면 `Share` API |
| 저장 `localStorage` | 전체 | SDK 3.1.0 이상이면 유지됨. 재접속 후 진행 유지 필수 항목이라 실기기 확인 |

방법: `import.meta.env.MODE === 'toss'`(또는 `VITE_TARGET=toss`)로 갈라 `vite build --mode toss && ait build`.
Capacitor 쪽 빌드·광고 설정은 건드리지 않습니다(Play·iOS 판 회귀 방지).

## 순서

1. **콘솔에서 앱 만들기** — 이름 칸이 둘입니다.
   - **앱 이름**(토스 앱에 보이는 이름, 나중에 바꿀 수 있음): 한글 **망치섬**, 영문 **Tumble Isle**(15자 이내 규칙 충족). 토스 사용자는 대부분 한국인이라 한글 이름이 보이게 함(사용자 결정).
   - **`appName`**(스킴 `intoss://…`에 쓰는 내부 ID, 못 바꿈, 사용자에겐 안 보임): `tumble-isle`. 문서 예시가 모두 영문 소문자·하이픈이고 규칙을 어기면 인증서 발급이 실패할 수 있다고 해서 한글은 쓰지 않음.
   - 카테고리 게임(장르는 콘솔 목록에서 액션/캐주얼 중).
2. **SDK 붙이기** — `npm i @apps-in-toss/web-framework`, `npx ait init` → `apps-in-toss.config.ts`(`webBundleDir: "dist"`). 세로 고정.
3. **토스판 분기 코드** — 위 표. 개발 중엔 테스트 광고 ID만.
4. **게임 체크리스트 맞추기** — 10초 안에 첫 화면, 우측 상단 닫기 버튼(토스 내비게이션 바)과 겹치지 않게 Safe Area, 진입 즉시 바텀시트 금지, 광고 중 음악 정지, 광고 미리 불러오기, 실패 재시도 간격 제한(1.0.1 광고 재시도와 같은 방향).
5. **업로드·토스앱 테스트** — `npx ait deploy` 또는 콘솔에서 `.ait` 업로드 → 콘솔 QR로 휴대폰 테스트(샌드박스에선 광고 안 나옴). 최소 1회 테스트해야 검토 요청 가능.
6. **광고 그룹 만들기** — 사업자·정산 정보 검토(영업일 2~3일) → 리워드 광고 그룹 생성 → ID를 토스판 출시 설정에 넣음.
7. **등급분류 증빙** — Play 자체등급분류 정보로 제출(스토어 URL, 등급분류 번호·일자, 이용등급, 내용정보, 대표자 사인, 플레이 화면 2장 + 토스 화면 2장). **등록자명과 사업자명이 같아야 함.** Play 승인 뒤에 가능.
8. **검토 요청 → 출시** — 영업일 3~7일. 검토 요청·출시 버튼은 사용자가 누름.

## 미리 알아 둘 점
- 앱인토스는 **만 19세 이상**에게만 보입니다.
- Play 심사 승인이 먼저입니다(등급분류 증빙에 스토어 URL·번호가 필요).
- 문서에서 확인 못 한 것: 뒤로가기 이벤트 API 이름, 외부 CDN 허용 여부(우리는 모델을 번들에 넣으므로 무관), `Share` 상세.
- 3.x로 낸 뒤 2.x로 되돌릴 수 없습니다.
