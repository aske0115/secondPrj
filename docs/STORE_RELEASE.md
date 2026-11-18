# Google Play 출시 준비 (망치섬 / Tumble Isle)

Google Play 먼저, iOS는 개발자 계정 문제로 나중. 패키지 `kr.co.daeun.tumbleisle`(Play에 앱을 만든 뒤엔 바꿀 수 없음).
쓸어킬(`~/Projects/neon-survivor/docs/TODO.md` 0-3)과 같은 Play Console **조직 계정 Daeun**을 쓰는 것을 전제로 한다.

> 이 문서는 준비 절차다. 콘솔 「저장」「검토를 위해 전송」, 사이트 배포는 **사용자가 직접** 한다.

## 0. 사용자가 할 일 — 순서대로

1. 업로드 키 준비(§1): 쓸어킬 키를 링크로 연결(이 PC는 완료). 다른 PC는 §1-2(비공개 저장소 `aske0115/app-signing-keys`)로 받기.
2. 서명된 출시 AAB 만들기(§2) → `~/keys/release/tumble-isle-1.0.0-1.aab`로 복사.
3. 개인정보 처리방침을 daeun.dev에 올리기(§4) → `https://daeun.dev/privacy/tumble-isle/` 열리는지 확인.
4. Play Console 앱 만들기 → 앱 콘텐츠 선언(§3) → 스토어 등록정보(§5).
5. 비공개 테스트 조건 확인(§3-0). 조건 없으면 내부 테스트로 설치 확인(권장) → 프로덕션.
6. 게시 개요에서 「검토를 위해 전송」.
7. 공개된 뒤 AdMob → 앱(Tumble Isle 안드로이드) → **앱 스토어 추가**로 Play 등록정보 연결(그 뒤 AdMob 검토·게재 시작, 결정 075).

## 1. 업로드 키 (서명) — 쓸어킬과 같은 키를 쓴다(결정 084)

Play 앱 서명이 켜져 있으면 실제 배포 키는 Google이 앱마다 따로 보관하고, 개발자의 **업로드 키는 "올린 사람 확인"용**이라 여러 앱이 같은 키를 써도 된다. 망치섬은 쓸어킬의 업로드 키(`~/keys/neon-rush-upload.jks`, 별칭 `upload`)를 그대로 쓴다.
- 장점: 키·비밀번호를 하나만 관리. 위험: 키를 잃거나 새면 두 앱 모두 영향(Play Console → 앱 무결성 → 업로드 키 재설정 요청으로 복구 가능).

`android/app/build.gradle`은 저장소 밖 `~/keys/tumble-isle-signing.properties`를 읽는다(다른 위치는 환경 변수 `TUMBLE_SIGNING=<경로>`). 이 파일은 **쓸어킬 설정 파일을 가리키는 링크**로 둔다 — 비밀번호를 복사하지 않고 위치만 가리킨다.

### 1-1. 키가 이 컴퓨터에 있을 때 (한 번만)

```bash
ln -s ~/keys/neon-rush-signing.properties ~/keys/tumble-isle-signing.properties
ls -l ~/keys/tumble-isle-signing.properties   # → … -> …/neon-rush-signing.properties 이면 됨
```

(2026-11-17 회사 PC에는 만들어 둠.)

### 1-2. 키가 이 컴퓨터에 없을 때 (새 PC·집 PC)

키·비밀번호 파일은 **공개 저장소(secondPrj·neon-rush 등)에 절대 올리지 않는다.** 백업해 둔 비공개 보관 위치에서 받아 같은 자리에 둔 뒤 1-1을 한다.

1. 비공개 저장소 **`aske0115/app-signing-keys`**(2026-11-18 만듦, `~/keys` 폴더 그대로)를 `~/keys`에 받는다. 키·서명 설정·망치섬 링크(`tumble-isle-signing.properties`)가 함께 들어 있어 1-1의 링크를 따로 만들 필요가 없다.
   ```bash
   gh repo clone aske0115/app-signing-keys ~/keys   # 개인 계정(aske0115)으로 gh 로그인 필요
   chmod 700 ~/keys && chmod 600 ~/keys/neon-rush-upload.jks ~/keys/neon-rush-signing.properties
   ```
   - 이미 `~/keys`가 있으면 그 폴더에서 `git pull`.
   - 이 저장소는 **비공개를 유지**한다. 공개로 바꾸거나 다른 저장소에 파일을 복사하지 않는다.
2. 설정 파일 안의 `storeFile=` 경로가 **이 컴퓨터의 경로**인지 본다(지금 값 `/Users/a1101249/keys/neon-rush-upload.jks`). 사용자 이름이 다르면 그 한 줄만 고치고, 그 수정은 커밋하지 않는다.
3. `ls -l ~/keys/tumble-isle-signing.properties`로 링크가 살아 있는지 본다.
4. 확인: `cd android && ./gradlew bundleRelease` 뒤 `jarsigner -verify app/build/outputs/bundle/release/app-release.aab` → `jar verified.` (실제 광고가 들어가지 않은 빌드로 확인해도 서명 확인은 된다. 확인 뒤 AAB는 지운다.)

- 키를 아예 잃어버렸다면: 새 키를 만들고(`keytool -genkeypair -v -keystore ~/keys/upload-new.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`) Play Console → 앱 무결성 → **업로드 키 재설정 요청**(두 앱 모두). 승인까지 며칠 걸린다.
- 역할(에이전트)은 키·비밀번호 파일을 열거나 복사하지 않는다. 받기·두기는 사용자가 하고, 역할은 링크·경로 확인과 서명 확인(`jarsigner -verify`)만 한다.

## 2. 출시 AAB 만들기

| 단계 | 명령 | 확인 |
|---|---|---|
| ① 버전 | `android/app/build.gradle` → `versionCode 1`, `versionName "1.0.0"` | 다음 올릴 때마다 versionCode +1(한 번 올린 번호는 재사용 불가) |
| ② 실제 광고로 웹 빌드·동기화 | `npm run native:release` | `grep -rl 5960388113203280/ android/app/src/main/assets/public` → 1개 |
| ③ AAB | `cd android && ./gradlew bundleRelease` | `android/app/build/outputs/bundle/release/app-release.aab`, `jarsigner -verify <aab>` → `jar verified.`(키가 없으면 `jar is unsigned.`) |
| ④ 보관 | `cp android/app/build/outputs/bundle/release/app-release.aab ~/keys/release/tumble-isle-1.0.0-1.aab` | 저장소 밖 |
| ⑤ **되돌리기** | `npm run native` | 아래 두 줄이 모두 `0` |

```bash
grep -rl 5960388113203280/ android/app/src/main/assets/public | wc -l
grep -rl 5960388113203280/ ios/App/App/public | wc -l
```

- 실제 광고 빌드는 기기에 설치해서 광고를 보거나 누르지 않는다(AdMob 계정 정지 위험). 기기 확인은 ⑤ 뒤의 테스트 광고 빌드로.
- targetSdk 36(Android 16), minSdk 24. Play의 새 앱 요구 수준(2025-08부터 API 35 이상)을 넘는다. 제출 직전 Play Console 경고가 없는지만 본다.

## 3. Play Console 체크리스트

### 3-0. 비공개 테스트(테스터 12명·14일)가 필요한가

이 조건은 **2023-11-13 이후 만든 개인(personal) 개발자 계정**에만 붙는다. 쓸어킬을 올린 계정은 **조직 계정 Daeun**이라 조건이 없었다(쓸어킬 TODO 0-3, 내부 테스트 없이 바로 프로덕션 제출).

확인 방법: Play Console → 앱 만든 뒤 **대시보드**. 「프로덕션 액세스 신청」 또는 「비공개 테스트 실행(테스터 12명 이상, 14일)」 카드가 보이면 해당, 프로덕션 트랙이 바로 열려 있으면 해당 없음. (계정 유형은 설정 → 개발자 계정 → 계정 세부정보.)

해당하면:
1. 테스트 및 출시 → 테스트 → **비공개 테스트** → 트랙 만들기 → 테스터: 이메일 목록(12명 이상, Google 계정) → AAB 올리고 검토 전송.
2. 테스터가 참여 링크로 **옵트인하고 설치**, 14일 연속 참여 유지.
3. 14일 뒤 대시보드 → 「프로덕션 액세스 신청」 설문(테스트 방식·받은 의견·출시 준비 상태) → 승인(보통 7일 이내) 뒤 프로덕션.

### 3-1. 앱 만들기 (모든 앱 → 앱 만들기)

| 칸 | 값 |
|---|---|
| 앱 이름 | `docs/STORE_LISTING.md`(기획 담당) 값. 영어 기본이면 Tumble Isle 계열 |
| 기본 언어 | 영어(미국) — 쓸어킬과 같게, 한국어 등록정보는 뒤에 추가 |
| 앱 또는 게임 | 게임 |
| 무료 또는 유료 | 무료(한 번 무료로 내면 유료로 못 바꿈) |
| 선언 | 개발자 프로그램 정책 ☑, 미국 수출 법규 ☑ |

### 3-2. 앱 콘텐츠 (정책 및 프로그램 → 앱 콘텐츠)

| 화면 | 값 | 근거 |
|---|---|---|
| 개인정보처리방침 | `https://daeun.dev/privacy/tumble-isle/` | §4 배포 뒤 |
| 앱 액세스 권한 | 모든 기능을 특별한 액세스 권한 없이 사용 가능 | 로그인·계정 없음 |
| 광고 | **예, 광고가 포함되어 있습니다** | AdMob 보상형(결정 073) |
| 콘텐츠 등급 | IARC 설문 → 아래 3-3 | |
| 타겟층 및 콘텐츠 | **13~15세, 16~17세, 18세 이상**(13세 미만 선택 안 함) | 아래 설명 |
| 뉴스 앱 | 아니요 | |
| 데이터 보안 | 아래 3-4 | |
| 정부 앱 | 아니요 | |
| 금융 기능 | 해당 없음(금융 기능 없음) | |
| 건강 | 해당 없음(건강 기능 없음) | |
| 광고 ID | 예, 광고 ID 사용 → 용도: 광고 또는 마케팅, 분석, 사기 방지·보안 | AdMob SDK가 `com.google.android.gms.permission.AD_ID`를 병합 매니페스트에 넣음(빌드 결과로 확인) |

**타겟 연령을 13세 이상으로 두는 이유**: 13세 미만을 고르면 Families 정책이 붙어 광고 SDK를 「가족용 자체 인증 SDK」 설정으로 바꾸고(아동 대상 처리 태그, 맞춤 광고 금지 등) 광고 ID 사용도 제한된다. 지금 광고 코드(`src/ads.ts`)는 그 설정이 없다. 다만 로우폴리 캐릭터라 「아동에게 매력적일 수 있음」 질문이 나오면 사실대로 답하고, Play가 아동 대상으로 판단하면 광고 담당이 Families 설정을 넣어야 한다. 쓸어킬도 13세 이상으로 통과.

### 3-3. 콘텐츠 등급 설문(IARC) 예상 답

카테고리: **게임**(퍼즐·카드·소셜 카지노 아님). 이메일: 개발자 이메일.

| 질문 | 답 | 코드에서 확인한 것 |
|---|---|---|
| 폭력 | **예 — 비현실적·만화풍 폭력**. 주인공이 망치로 만화풍 좀비·해골·몬스터를 쳐서 섬 밖으로 날려 떨어뜨림 | 적은 Kenney 로우폴리 모델. 쓰러지면 작은 조각 파티클만(색: 미색·초록·흙색·주황, 빨간 피 없음, `src/main.ts` `C_SMALL`·`C_BIG`·`C_DIRT`·`C_PUMPKIN`) |
| 피·유혈·신체 훼손 | 아니요 | 위와 같음 |
| 사람 대상 사실적 폭력 | 아니요 | |
| 공포·무서운 요소 | 아니요(만화풍 좀비·해골, 깜짝 놀래기 없음) | |
| 성적 내용·노출 | 아니요 | |
| 욕설·저속한 언어 | 아니요 | |
| 약물·술·담배 | 아니요 | |
| 도박(실제 돈·모의 도박) | 아니요 | 캡슐(무작위 캐릭터)은 **게임 안 코인**으로만, 실제 돈 결제·인앱 결제 없음 |
| 실제 돈으로 사는 무작위 아이템 | 아니요 | 인앱 결제 없음(`package.json`에 결제 플러그인 없음) |
| 사용자 간 상호작용·채팅·콘텐츠 공유 | 아니요 | 앱 안 채팅·온라인 없음. 결과 그림 공유는 기기 공유 창(`navigator.share`)으로 넘기기만 |
| 위치 공유 | 아니요 | |
| 디지털 상품 구매 | 아니요 | |

예상 등급: 한국 전체이용가, ESRB Everyone(또는 E10+ Fantasy Violence), PEGI 3~7. 쓸어킬(비슷한 만화풍 처치)은 전체이용가·Everyone·PEGI 3. **결과 등급은 설문 뒤 화면 값을 그대로 기록**한다(나중에 다른 스토어 등급 증빙).

### 3-4. 데이터 보안

앱 자체는 서버가 없고 진행은 기기에만 저장(로그인 없음). 수집은 **Google AdMob·UMP(동의) SDK**가 한다. Google의 「Google Mobile Ads SDK 데이터 공개」 안내 기준:

| 칸 | 값 |
|---|---|
| 데이터 수집·공유 여부 | 예 |
| 전송 중 암호화 | 예 |
| 삭제 요청 방법 | 계정이 없어 개발자가 보관하는 데이터 없음(방침 5항) |
| 위치 | 대략적인 위치(IP에서 추정) |
| 앱 활동 | 앱 상호작용(광고 노출·탭 등) |
| 앱 정보 및 성능 | 비정상 종료 로그, 진단 |
| 기기 또는 기타 ID | 기기 또는 기타 ID(광고 ID, 앱 세트 ID) |
| 각 항목 목적 | 광고 또는 마케팅, 분석, 사기 방지·보안·규정 준수 |
| 처리 방식 | 일시적 처리 아님, 수집은 필수(사용자가 끌 수 없음, 단 맞춤 광고는 동의 창·기기 설정으로 끌 수 있음) |

- 「수집」과 「공유」 표시는 **쓸어킬 Play Console → 앱 콘텐츠 → 데이터 보안**에 이미 낸 답과 똑같이 맞춘다(같은 SDK·같은 계정). 다르면 쓸어킬 쪽 답을 따른다.
- 이름·이메일·연락처·사진·결제 정보는 수집하지 않음.

### 3-5. 스토어 설정 (스토어 노출 → 스토어 설정)

| 칸 | 값 |
|---|---|
| 앱 카테고리 | 게임 → 액션(또는 캐주얼, 기획 담당 `docs/STORE_LISTING.md` 값) |
| 태그 | 최대 5개, STORE_LISTING 값 |
| 이메일 | daeun.dev0217@gmail.com (방침과 같게) |
| 웹사이트 | `https://daeun.dev` (app-ads.txt가 이 루트에 있어야 함) |

## 4. 개인정보 처리방침·app-ads.txt

- 초안: `docs/privacy-tumble-isle.html`(쓸어킬 방침과 같은 구조·한·영, 수집 항목 같음, 결과 그림 공유 한 문단 추가).
- **사용자 확인 필요**: `~/Projects/daeun-site/public/privacy/tumble-isle/index.html`로 복사, `README.md` 경로 표에 한 줄 추가, 배포. 배포는 사이트 전체 교체형이라 daeun-site 최신 상태에서:
  `npx firebase-tools deploy --only hosting --project hosting-be56d --account <개인 Google 계정>`
- **app-ads.txt**: 지금 `https://daeun.dev/app-ads.txt` 내용 `google.com, pub-5960388113203280, DIRECT, f08c47fec0942fa0`. 망치섬 AdMob 앱 ID도 같은 게시자 `pub-5960388113203280`이라 **파일은 그대로 충분**. Play 등록정보의 웹사이트를 `https://daeun.dev`로 적기만 하면 된다. AdMob이 확인하는 데 최대 하루쯤 걸린다.

## 5. 스토어 등록정보 (스토어 노출 → 기본 스토어 등록정보, 언어별)

문구는 기획 담당 `docs/STORE_LISTING.md`, 이미지는 디자인 담당 `store/play/` 값을 넣는다.

| 칸 | 규격 |
|---|---|
| 앱 이름 | 30자 이내 |
| 간단한 설명 | 80자 이내 |
| 자세한 설명 | 4,000자 이내 |
| 앱 아이콘 | 512×512 PNG(32비트, 1MB 이하). 원본 `docs/art/icon.png`(1024)를 줄여 쓰면 됨 |
| 그래픽 이미지 | **필수** 1024×500, JPG 또는 24비트 PNG(투명 없음) |
| 휴대폰 스크린샷 | 2~8장, PNG/JPG, 한 변 320~3840px, 긴 변이 짧은 변의 2배 이하. 추천 노출 받으려면 1080px 이상 4장 이상 |
| 태블릿 스크린샷(7·10인치) | 선택. 태블릿 추천 노출을 원하면 각 4장 이상, 1080px 이상 |
| 동영상 | 선택, YouTube URL(광고 없음·공개 또는 일부 공개) |

- 한국어 등록정보: 기본 스토어 등록정보 → 번역 관리 → 한국어 추가 → 같은 칸.
- 등록정보는 「임시보관함에 저장」만으로는 제출 목록에 안 들어간다. **다음 → 리뷰(AI 애셋 선언) → 저장**까지 해야 게시 개요에 잡힌다(쓸어킬 1.0.1 때 확인).
- 홍보 문구 원칙(AGENTS.md): 경쟁 게임 이름·플레이 시간 숫자 금지.

## 6. 트랙·출시

1. (권장) 테스트 및 출시 → 테스트 → **내부 테스트** → 새 버전 → AAB 업로드 → 출시 노트(한·영) → 본인 기기에 설치해 실행만 확인(광고는 누르지 않음).
2. 프로덕션 → 국가/지역(전체) → 새 버전 → 같은 AAB(또는 내부 테스트에서 승격) → 출시 노트.
3. 게시 개요 → 변경사항 확인 → **검토를 위해 전송**(사용자). 관리형 게시가 꺼져 있으면 통과 즉시 공개.
