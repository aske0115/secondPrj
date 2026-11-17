# 스토어 이미지 (Google Play)

`kr` = 한국어 등록정보, `en` = 영어(기본 언어). 파일 번호 순서가 스토어에 올리는 순서입니다(1-strike가 맨 앞).

```
store/
  play/
    kr/            휴대폰 스크린샷 1080×1920(9:16) 6장 + feature-graphic-1024x500.png
    en/            같은 구성(영어)
    icon-512.png   Play 고해상도 아이콘 512×512 (docs/art/icon.png를 줄인 것, 알파 없음)
  raw/             ↓ 위 이미지를 만드는 「원본 게임 캡처」(스토어에 직접 올리지 않음)
    kr/ en/        405×720 화면을 3배로(1215×2160). 3-isle-*는 섬 4칸 묶음용, banner는 그래픽 이미지 배경(1024×500의 2배, 글씨 없는 촬영 모드)
```

모든 PNG는 24bit(알파 없음)입니다. 확인: `sips -g pixelWidth -g pixelHeight -g hasAlpha store/play/*/*.png store/play/icon-512.png`

## 다시 만들기
개발 서버를 먼저 띄웁니다: `npm run dev` (포트 5317, `?debug` 없이 찍으므로 개발용 글씨는 안 나옵니다)

```bash
# 전부(찍기 + 합성, 한·영) 약 1~2분
npm exec --yes --package=playwright@1.65.0 -- node scripts/capture-store.mjs
# 문구만 바꿨을 때: raw를 그대로 쓰고 합성만(몇 초)
npm exec --yes --package=playwright@1.65.0 -- node scripts/capture-store.mjs compose
# 장면 하나만 다시 찍기(한·영 둘 다), 그 뒤 compose
npm exec --yes --package=playwright@1.65.0 -- node scripts/capture-store.mjs raw 2-boss
```

- 문구는 `scripts/capture-store.mjs` 맨 위 `SLIDES`(스크린샷)·`BANNER`(그래픽 이미지)에서 고칩니다. 한 줄에 안 들어가면 글자가 자동으로 작아집니다.
- 장면은 `__demo` 훅(`goStage`·`step`·`sweep`·`charge`·`stress`·`g`)으로 연출합니다. 체력은 계속 채우고 적을 주인공 둘레로 모으는 등 **보기 좋게 꾸민 장면**이며 실제 난이도와는 무관합니다.
- 일부는 실제 시간으로 그려서 찍을 때마다 조금씩 다릅니다(소품 배치는 장면마다 같은 난수로 고정). 마음에 안 드는 장면은 그 장면만 다시 찍으면 됩니다.
- 휴대폰 화면을 늘려 태블릿용으로 쓰지 않습니다. 태블릿 스크린샷이 필요하면 태블릿 크기로 따로 찍는 장면을 추가해야 합니다.

## 문구 목록 (임시 — `docs/STORE_LISTING.md` 확정 후 맞출 것)
원칙: 경쟁 게임 이름 금지, 플레이 시간 숫자 금지.

| 장면 | 한국어 제목 / 부제 | English title / subtitle |
|---|---|---|
| 1-strike | 쾅! 한 방에 우르르 / 망치로 쳐서 섬 밖으로 날려 버리세요 | BONK! Off They Go / Knock the horde off your tiny island |
| 2-boss | 왕좀비도 떨어뜨려라 / 때릴수록 % 가 올라 더 멀리 날아갑니다 | Topple the Zombie King / Every hit raises his % and sends him farther |
| 3-isles | 장마다 새로운 섬 / 풀밭·해적 해변·눈 마을·과자 섬·달 기지 | A New Isle Every Chapter / Meadows, pirate beaches, snow, candy and the moon |
| 4-levelup | 고를 때마다 강해진다 / 레벨 업 카드로 나만의 망치 조합 | Stronger With Every Pick / Level-up cards build your own mallet |
| 5-bonus | 보너스 판, 몸통 돌진! / 끌었다 놓으면 해골 볼링 | Bonus Round: Dash! / Drag, release and bowl the skeletons over |
| 6-shop | 캐릭터를 모으고 강화 / 모험가·오크·묘지기·흡혈귀·유령 | Collect Heroes, Power Up / Adventurer, Orc, Keeper, Vampire, Ghost |
| 그래픽 이미지 | 망치섬 / 쳐서 날려라! 하늘섬 망치 서바이벌 | Tumble Isle / Bonk the horde off your tiny island |
