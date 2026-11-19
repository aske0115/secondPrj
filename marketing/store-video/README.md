# Play 스토어 등록정보용 가로 게임 영상 — 망치섬(Tumble Isle)

| 파일 | 내용 |
|---|---|
| `tumble-isle-store-ko.mp4` | 한국어 자막, 1920×1080(16:9), 30fps, H.264 + AAC, 28.2초 |
| `tumble-isle-store-en.mp4` | 영어 자막(같은 구성), 28.2초 |
| `make-store-video.mjs` | 다시 만드는 스크립트(세로 게임 화면을 가운데 iframe으로 두고 양옆에 자막·이름. 촬영 방식은 `marketing/shorts/make-short.mjs`의 것을 그대로 가져다 씀) |

mp4는 다시 만들 수 있어 git에 넣지 않습니다(`.gitignore`).

## 다시 만들기
```
npm run dev &        # 포트 5317
npm exec --yes --package=playwright@1.65.0 -- node marketing/store-video/make-store-video.mjs        # 한·영 두 벌(약 3분)
npm exec --yes --package=playwright@1.65.0 -- node marketing/store-video/make-store-video.mjs en     # 한 벌만
```
- 자막·장면 순서는 스크립트 맨 위 `SCENES`·`END`에서 고칩니다. 기획이 바뀌면(무기·왕좀비·공유 카드·장) 다시 굽습니다.
- 게임 HUD·버튼은 숨기고, 게임 안 알림은 `STRIKE!`·「홈런!」·「낙하 ×N」·「왕좀비를 떨어뜨렸다!」 등만 보입니다(버티기 시간 알림은 숨김).

## 장면 순서(초)
| 초 | 장면(스테이지) | 왼쪽 자막(한 / 영) |
|---|---|---|
| 0~3.2 | 망치 쾅!(STRIKE) — 둘러싼 적이 한꺼번에 섬 밖으로(풀밭 섬) | 쾅! 한 방에 우르르 / BONK! Off they go! |
| 3.2~5.4 | 대형 해머(해적 해변) | 무기마다 손맛이 달라요 · 대형 해머 — 쿵! / Every weapon feels different · Sledgehammer — THUD! |
| 5.4~7.6 | 야구방망이(단풍 숲) | 〃 · 야구방망이 — 딱! / 〃 · Bat — CRACK! |
| 7.6~9.6 | 스펀지 쌍검(눈 덮인 마을) | 〃 · 스펀지 쌍검 — 다다닥! / 〃 · Foam Twins — whap-whap! |
| 9.6~11.6 | 큰 부채(풀밭 섬) | 〃 · 큰 부채 — 휘이잉~ / 〃 · Giant Fan — WHOOSH! |
| 11.6~14.6 | 가장자리가 무너지며 적이 같이 떨어짐(달빛 묘지) | 버틸수록 · 섬이 무너져요! / Hold on tight — · the island crumbles! |
| 14.6~18.6 | 장 넷을 1초씩: 성벽 섬·과자 섬·달 기지·던전 섬 | 장마다 다른 섬 · (장 이름) / A new isle every chapter · (chapter name) |
| 18.6~21.6 | 왕좀비 % 오름 → 망치로 날림(약 20.1초) | 마지막엔 왕좀비 등장 · 날려 보내면 보너스! / Then the King Zombie shows up · Knock him off for a bonus! |
| 21.6~25.2 | 공유 카드 세 장(위 쾅!·방망이·왕좀비 판의 베스트 컷, 앵글·자세·표정이 서로 다름) | 판마다 다른 베스트 컷 · 카드로 공유! / A new best shot every run · Share it as a card! |
| 25.2~28.2 | 끝: 아이콘·망치섬·한 줄 소개(「프로필 링크」 문구 없음) | 쳐서 날려라! 하늘섬 망치 서바이벌 / Bonk the horde off your tiny island |

오른쪽에는 내내 아이콘과 게임 이름이 있습니다. 왕좀비는 판의 보너스이고 승리 조건이 아니므로(결정 094) 「왕좀비를 잡으면 승리」로 읽히는 문구를 쓰지 않습니다.

## 소리(저작권 확인)
쇼츠와 같습니다: 효과음은 게임에 든 Kenney CC0 녹음(`public/sfx`), 배경음은 게임 배경음(`src/audio.ts`, 직접 합성)을 같은 음으로 다시 합성. 유행 음원·저작권 음원 없음.

## YouTube 업로드 → Play 콘솔(사용자가 직접)
Play 등록정보의 「동영상」 칸은 **YouTube 주소만** 받습니다.
- [ ] YouTube에 일반 동영상으로 올림(가로라서 쇼츠로 분류되지 않음). 한국어판·영어판을 따로 올림
- [ ] 공개 범위: **공개** 또는 **일부 공개**(비공개는 Play에서 재생 안 됨)
- [ ] **수익 창출(광고) 끔** — 광고가 붙으면 Play에서 재생이 막힐 수 있음
- [ ] **연령 제한 없음**, 「아동용 아님」은 사실대로 선택, 퍼가기(삽입) 허용
- [ ] 제목 예: `망치섬 (Tumble Isle) 게임 플레이` / `Tumble Isle — Gameplay`. 설명에 경쟁 게임 이름·플레이 시간 숫자·「1위·최고」 같은 과장은 넣지 않음
- [ ] 받은 주소(`https://www.youtube.com/watch?v=...`)를 Play 콘솔 → 기본 스토어 등록정보 → 「동영상」 칸에. 영어 등록정보에는 영어판 주소
- [ ] 업로드·Play 콘솔 저장은 사용자 몫(마케팅 담당은 파일까지만)
