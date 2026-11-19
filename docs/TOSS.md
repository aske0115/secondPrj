# 망치섬 토스(앱인토스) 미니앱

근거: 앱인토스 개발자 문서(https://developers-apps-in-toss.toss.im/, SDK 3.x). 콘솔: https://apps-in-toss.toss.im (워크스페이스 「다은아빠」).
콘솔에 넣을 글(앱 이름·부제·상세 설명·출시 노트·메모)은 **`docs/TOSS_LISTING.md`**에 있습니다.

## 지금 상태 (2026-11-19 16시)

| 항목 | 상태 |
|---|---|
| 콘솔 앱 등록 | ✅ 앱 이름 「망치섬」, `appName` `tumble-isle`(못 바꿈) |
| SDK·설정 | ✅ `@apps-in-toss/web-framework@3.10.0`, `apps-in-toss.config.ts` |
| 토스판 코드 | ✅ `src/toss.ts`의 `TOSS`·`ait()`로 광고·진동·뒤로가기·위 여백만 갈라 씀 |
| 번들 업로드 | ✅ 사용자가 테스트 광고 번들 업로드, 토스앱 QR 테스트로 실행 확인 |
| 실기기 고친 것 | ✅ 일시정지 버튼이 토스 닫기 버튼과 겹침 → 토스판만 위 여백 +54px(`html.toss { --top }`, 94121ec). **다시 올려 확인 필요** |
| 콘솔 「기본 정보」 | ⏳ 값은 TOSS_LISTING.md에 준비됨, 입력은 아직 |
| 사업자·정산 정보 | ⏳ 안 함 |
| 리워드 광고 그룹 | ⏳ 안 만듦 → 실제 ID 출시 빌드도 아직 |
| 게임 등급분류 증빙 | ⏳ Play 심사 승인 뒤(스토어 URL·등급분류 번호 필요) |
| 검토 요청 | ⏳ 사용자가 직접 |

---

## 집에서 이어 하기 (사람 또는 Codex 등 AI 도우미용)

> **AI 도우미가 꼭 지킬 것**
> 1. **「검토 요청하기」, 「출시하기」 버튼은 누르지 않습니다.** 임시저장까지만 하고 사람에게 넘깁니다.
> 2. 사업자등록증·통장 사본·대표자 사인·인감 같은 서류는 사람이 직접 올립니다. 대신 입력하거나 파일을 찾아 올리지 않습니다.
> 3. 실제 광고 그룹 ID가 들어간 빌드로 광고를 보거나 누르지 않습니다(정책 위반). 광고 확인은 테스트 빌드(`build:toss`)로만.
> 4. 이 문서와 TOSS_LISTING.md에 없는 값은 지어내지 말고 사람에게 묻습니다.
> 5. 사람이 로그인해 둔 브라우저 탭을 닫거나 다른 주소로 옮기지 않습니다.
> 6. 커밋은 한국어, 작성자 `GeunHwa Lee <26166444+aske0115@users.noreply.github.com>`, 강제 푸시 금지(AGENTS.md).

### 0. 준비
```bash
cd ~/Projects/secondPrj && git pull && npm install
npm run build:toss          # → 저장소 루트 tumble-isle.ait (테스트 광고 ID, git 제외)
```
확인: `npx tsc --noEmit`, `npm test`(53개 통과), Play 빌드에 토스 코드가 섞이지 않았는지
`npm run build && grep -l "loadFullScreenAd\|ait-ad-test" dist/assets/*.js` → 아무것도 안 나와야 정상.

### 1. 최신 테스트 번들 다시 올리고 QR 확인 (사람)
콘솔 → 망치섬 → 앱 출시 → 등록하기 → `tumble-isle.ait` → 「토스앱 테스트」 QR. 확인할 것:
- 게임 중 오른쪽 위 일시정지 버튼이 토스 닫기 버튼 **아래**에 있고 눌리는지(틈이 너무 크거나 아직 겹치면 `src/style.css`의 `html.toss { --top: … + 54px }` 숫자만 조정)
- 시작 화면 위 코인 표시 위치가 어색하지 않은지
- 테스트 광고(이어 하기·코인 2배 등)가 뜨고 끝까지 보면 보상이 들어오는지
- 안드로이드 뒤로가기: 게임 중 → 일시정지, 일시정지 → 이어 하기, 다른 화면 → 시작 화면, 시작 화면 → 종료 확인
- 설정에서 음악·효과음·진동 끄고 켜기, 앱을 내렸다 올렸을 때 소리 멈춤·다시 재생
- 결과 화면 베스트 컷 「공유」가 동작하는지(`navigator.share`, 안 되면 SDK `share`로 바꿔야 함)
- 앱을 완전히 닫았다 다시 열어도 코인·진행이 남아 있는지

### 2. 콘솔 「기본 정보」 입력
`docs/TOSS_LISTING.md` 표 그대로. 사용 연령은 Play 콘솔 「콘텐츠 등급」 결과와 같게(확인 필요). 「임시저장」.
「카테고리 및 노출」 화면: 카테고리 **게임**(장르는 목록에서 액션 또는 캐주얼). 아이콘·이미지를 요구하면 `store/play/icon-512.png`, 스크린샷은 `store/play/kr/*-kr.png`(규격이 다르면 사람에게 알림).

### 3. 사업자·정산 정보 (사람)
- 사업자 정보: 콘솔 → 워크스페이스 「내 정보」. 검토 영업일 1~2일.
- 정산 정보: 나의 워크스페이스 → 파트너 정보 → 정산 정보. 검토 영업일 평균 2~3일.
- (예상 수익 5,000원까지는 미룰 수 있지만, 넘으면 5영업일 안에 끝내야 미니앱이 계속 노출됨)

### 4. 리워드 광고 그룹 만들기
콘솔 → 인앱 광고 → 광고 그룹 생성:

| 칸 | 값 |
|---|---|
| 광고 그룹 이름 | `게임_리워드광고` |
| 광고 유형 | **리워드** |
| 보상 이름 / 수량 | `보상` / `1` (보상은 게임이 직접 줌: 코인 2배·이어 하기·무료 캡슐·무기 체험·카드 다시 뽑기 전부 이 그룹 하나로) |
| 미디에이션 | 자동(그대로) |

만든 뒤 상세 화면의 **광고 그룹 ID**를 복사합니다. 구글 등록까지 최대 2시간.
「인앱 광고」가 곧 토스 광고입니다(Toss Ads·AdMob 중 SDK가 고름). 따로 「토스애즈」를 신청할 필요 없음.

### 5. 실제 광고 출시 빌드
```bash
echo 'VITE_TOSS_REWARDED=<광고 그룹 ID>' > .env.toss-release   # Play의 .env.release처럼 커밋해도 되는 값
npm run build:toss-release                                      # → tumble-isle.ait (실제 ID)
grep -l "ait-ad-test-rewarded-id" dist/assets/*.js              # 아무것도 안 나와야 실제 ID만 들어간 것
```
이 번들을 콘솔에 올리고, 출시 노트·메모(TOSS_LISTING.md, 메모의 「테스트 광고 ID」는 「실제 광고 그룹」으로 바꿈) 입력.
**실제 ID 번들로는 광고를 눌러 보지 않습니다.** 앱이 켜지는지만 QR로 확인.
그 뒤 `npm run build:toss`로 테스트 빌드로 되돌려 두면 안전합니다.

### 6. 게임 등급분류 (Play 승인 뒤)
콘솔 「게임 등급분류」 → 오픈마켓 자체등급분류 경로. 필요한 것:
스토어 URL `https://play.google.com/store/apps/details?id=kr.co.daeun.tumbleisle`, Play 등급분류 번호·일자·이용등급·내용정보(Play 콘솔에서 확인),
등록자명(= 사업자명, 다르면 반려), 대표자 사인, **플레이 화면 2장 + 앱인토스(토스앱 안) 화면 2장**(토스앱 화면은 사람이 휴대폰으로 캡처).
플레이 화면은 `store/play/kr/1-strike-kr.png` 등을 써도 됨.

### 7. 검토 요청 (사람)
토스앱 테스트를 1번 이상 한 상태여야 버튼이 열림. 검토 영업일 3~7일, 결과는 콘솔·메일.
끝나면 이 문서 「지금 상태」 표와 `docs/HANDOFF.md` 맨 위를 고치고 커밋·푸시.

---

## 코드 구조 (참고)

| 기능 | Play·iOS(Capacitor) | 토스판(`TOSS`가 참일 때) |
|---|---|---|
| 보상형 광고 `src/ads.ts` | AdMob 플러그인 | `loadFullScreenAd` → `loaded` → `showFullScreenAd`, 보상은 `userEarnedReward`에서만, 반환된 구독 해제 함수 호출. 그룹 ID: `toss-release` 모드 + `VITE_TOSS_REWARDED`, 그 밖엔 `ait-ad-test-rewarded-id` |
| 진동 `src/audio.ts` `buzz` | `Haptics.impact` | `Device.triggerHaptic`(`tickWeak`/`tickMedium`) |
| 뒤로가기 `src/main.ts` `onBack` | `App` `backButton`, 종료 `App.exitApp` | `graniteEvent` `backEvent`, 종료 `Screen.close` |
| 위 여백 `src/style.css` `--top` | `env(safe-area-inset-top)` | +54px(`html.toss`, 토스 닫기 버튼 줄) |

- `TOSS`는 `import.meta.env.MODE`가 `toss`/`toss-release`일 때만 참. 비교식이라 Play 빌드에선 거짓으로 접혀 토스 SDK가 번들에 안 들어감(`ait()`도 `TOSS ?` 안에서만 `import()`).
- `ait init`은 쓰지 않음: 기존 `build` 스크립트 뒤에 `ait build`를 붙이고 vite 설정에 devtools를 끼워 Play 빌드까지 바꾸기 때문. 설정 파일은 손으로 만듦.
- 앱인토스는 **만 19세 이상**에게만 보임. 3.x로 낸 뒤 2.x로 되돌릴 수 없음.
- 문서 링크: [WebView](https://developers-apps-in-toss.toss.im/ai-vibe-coding/tutorials/webview.md) · [광고 API](https://developers-apps-in-toss.toss.im/documentation/common/monetization/iaa/interstitial-rewarded-ad.md) · [인앱 광고 콘솔](https://developers-apps-in-toss.toss.im/guide/monetization/in-app-ad.md) · [게임 체크리스트](https://developers-apps-in-toss.toss.im/checklist/app-game.md) · [콘솔·등급분류](https://developers-apps-in-toss.toss.im/guide/operation/console-workspace.md) · [사업자 등록](https://developers-apps-in-toss.toss.im/guide/operation/register-business.md) · [배포](https://developers-apps-in-toss.toss.im/guide/operation/deploy.md)
