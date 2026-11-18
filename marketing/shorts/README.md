# 쇼츠·릴스 홍보 영상 — 망치섬(Tumble Isle)

| 파일 | 내용 |
|---|---|
| `tumble-isle-short-ko.mp4` | 한국어 자막, 1080×1920, 30fps, H.264 + AAC, 약 23초 |
| `tumble-isle-short-en.mp4` | 영어 자막(같은 구성), 약 24초 |
| `make-short.mjs` | 다시 만드는 스크립트(게임 장면을 가상 시계로 한 프레임씩 찍고 자막·소리를 얹음) |

## 다시 만들기
```
npm run dev &        # 포트 5317
npm exec --yes --package=playwright@1.65.0 -- node marketing/shorts/make-short.mjs        # 한·영 두 벌(약 2분)
npm exec --yes --package=playwright@1.65.0 -- node marketing/shorts/make-short.mjs ko     # 한 벌만
```
- 자막·장면 순서·끝 카드 문구는 스크립트 맨 위 `SCENES`·`END`에서 고칩니다.
- 기획이 바뀌면(무기 이름·왕좀비·공유 카드) 이 영상도 다시 굽습니다(옛 기획 문구가 남지 않게).
- 게임 HUD·버튼은 숨기고, 게임 안 알림은 `STRIKE!`·「홈런!」·「낙하 ×N」·「공중 콤보!」·「왕좀비를 떨어뜨렸다!」만 보입니다(버티기 시간 알림은 숨김 — 시간 숫자 문구 금지).

## 장면 순서(한국어판 기준, 초)
| 초 | 장면 | 자막 |
|---|---|---|
| 0~3.2 | 망치 쾅!(STRIKE) — 둘러싼 적이 한꺼번에 섬 밖으로 | 쾅! 한 방에 우르르 |
| 3.2~6.0 | 대형 해머 내려찍기 | 무기마다 손맛이 달라요 / 대형 해머 — 쿵! |
| 6.0~8.8 | 야구방망이 「홈런!」 | 야구방망이 — 딱! |
| 8.8~11.2 | 스펀지 쌍검 연타 | 스펀지 쌍검 — 다다닥! |
| 11.2~13.6 | 큰 부채 바람 | 큰 부채 — 휘이잉~ |
| 13.6~17.0 | 왕좀비 % 오름 → 망치로 날림(약 15.5초) | 왕좀비도 섬 밖으로! |
| 17.0~20.2 | 공유 카드(그 판의 베스트 컷 「왕좀비, 퇴장!」) | 제일 멀리 날린 순간을 / 카드로 공유! |
| 20.2~23.4 | 끝 카드: 아이콘·망치섬·한 줄 소개·프로필 링크에서 다운로드 | — |

자막은 위쪽 약 230~420px(1920 기준)에 두어 플랫폼 UI가 덮는 위 10%·아래 20%를 피했습니다. 영어판은 왕좀비가 떨어지는 때가 조금 달라 0.5초쯤 깁니다.

## 소리(저작권 확인)
- 효과음: 게임에 들어 있는 Kenney CC0 녹음(`public/sfx`, 라이선스 `public/sfx/License-*.txt`).
- 배경음: 게임 배경음(`src/audio.ts` 마림바 아르페지오, 직접 합성)을 스크립트에서 같은 음으로 다시 합성. 유행 음원·저작권 음원 없음.
- 음량: 평균 약 −22dB, 최고 −1.1dB. 플랫폼 음악을 따로 얹지 않아도 됩니다(얹는다면 게임 소리를 줄이지 않는 쪽 권장).

## 게시 문구

### 유튜브 쇼츠
- 제목(한): `망치로 쾅! 섬 밖으로 날려 버려 🔨` → 이모지를 빼려면 `망치로 쾅! 섬 밖으로 날려 버려`
- 설명(한):
  ```
  하늘에 뜬 작은 섬, 몰려드는 적을 망치로 쳐서 섬 밖으로 날려 보내는 서바이벌 액션.
  대형 해머·야구방망이·스펀지 쌍검·큰 부채… 무기마다 손맛이 달라요.
  왕좀비까지 날려 보내고, 제일 멀리 날린 순간은 카드로 공유하세요.
  망치섬 — 프로필 링크에서 다운로드
  #망치섬 #모바일게임 #인디게임 #손맛게임 #서바이벌게임 #로우폴리 #shorts
  ```
- Title (EN): `Bonk them right off the island!`
- Description (EN):
  ```
  A tiny floating island, a horde closing in — bonk them all off the edge.
  Sledgehammer, Bat, Foam Twins, Giant Fan… every weapon feels different.
  Knock off the King Zombie, then share your best knock-off as a card.
  Tumble Isle — download via the link in bio
  #TumbleIsle #mobilegame #indiegame #indiedev #survivalgame #lowpoly #shorts
  ```

### 인스타그램 릴스
- 캡션(한): `쳐서 날려라! 하늘섬 망치 서바이벌 🔨 무기마다 손맛이 달라요. 망치섬, 프로필 링크에서 다운로드` + 해시태그 `#망치섬 #모바일게임 #인디게임 #게임개발 #손맛게임 #로우폴리 #서바이벌게임`
- Caption (EN): `Bonk the horde off your tiny island 🔨 Every weapon hits different. Tumble Isle — download via the link in bio` + `#TumbleIsle #mobilegame #indiegame #gamedev #indiedev #lowpoly #survivalgame`

해시태그는 플랫폼마다 5~8개. 경쟁 게임 이름·플레이 시간 숫자·「1위·최고」 같은 과장은 넣지 않습니다.

## 업로드 전 확인(사용자가 직접)
- [ ] 쇼츠: 세로 영상 그대로 올리면 쇼츠로 분류(60초 이하). 표지는 0.5초 또는 15.5초(왕좀비가 날아가는 장면) 권장
- [ ] 릴스: 표지 사진은 끝 카드(21초 이후) 또는 공유 카드 장면, 격자 미리보기(가운데 1:1)에 자막이 들어가는지 확인
- [ ] 출시 전이라 「지금 다운로드」·스토어 링크는 넣지 않음. 출시 뒤에는 끝 카드 문구를 바꿔 다시 굽기(`END.store`)
- [ ] 업로드·게시·광고 집행은 사용자 몫(마케팅 담당은 파일까지만)
