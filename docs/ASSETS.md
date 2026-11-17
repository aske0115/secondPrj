# 외부 에셋 (결정 005·033)

모두 CC0(퍼블릭 도메인)이라 공개 저장소에 커밋합니다. 크레딧은 의무가 아니지만 스토어 설명·크레딧 화면에 "Kenney (www.kenney.nl)"를 적을 예정입니다.

| 팩 | 받은 곳 | 라이선스 원문 | 쓰는 파일 |
|---|---|---|---|
| Kenney Mini Dungeon 2.0 | https://opengameart.org/sites/default/files/kenney_mini-dungeon_2.0.zip (1,796,820 B) | zip 안 `License.txt`: "License: (Creative Commons Zero, CC0)" | `public/models/dungeon/character-human.glb`, `Textures/colormap.png` |
| Kenney Graveyard Kit 5.0 | https://opengameart.org/sites/default/files/kenney_graveyard-kit_5.0.zip (3,623,408 B) | 같음 | `public/models/graveyard/` 해골·좀비·묘지기(character-keeper, 도우미)·pine·pine-crooked·rocks·rocks-tall·trunk·pumpkin, `Textures/colormap.png` |

- kenney.nl 본 사이트는 직접 내려받기 주소가 막혀 있어(2026-11-17) Kenney가 직접 올린 OpenGameArt 사본을 씁니다.
- 두 팩의 `colormap.png`는 이름이 같고 내용이 달라 폴더를 나눴습니다. GLB는 `Textures/colormap.png`를 상대 경로로 찾습니다.
- 모델에는 걷기·달리기·죽기 등 애니메이션(`idle`, `walk`, `sprint`, `die` …)이 들어 있습니다. 적은 수백 마리를 한 번에 그리려고 애니메이션 없이 굳힌 모양을 씁니다.
- 다른 후보: KayKit(CC0, 캐릭터 파일이 3~5MB로 무거움), Quaternius(CC0, Google Drive라 자동 내려받기 불가), Kenney Nature Kit(풀·꽃, 10.5MB).

## 효과음(결정 046)

| 팩 | 받은 곳 | 라이선스 원문 | 쓰는 파일 |
|---|---|---|---|
| Kenney RPG Sounds | https://opengameart.org/sites/default/files/RPGsounds_Kenney.zip (690,952 B) | zip 안 `license.txt`: "License (CC0) … Credit … would be nice but is not mandatory" | chop→`whack`, bookPlace1~3→`bonk1~3`, creak1·2, dropLeather→`squish`, metalPot1→`clang`, cloth4·2→`swish1·2`, handleCoins→`coins` |
| Kenney Interface Sounds | https://opengameart.org/sites/default/files/kenney_interfaceSounds.zip (834,536 B) | zip 안 `License.txt`: "License: (Creative Commons Zero, CC0)" | drop_002→`pop`, confirmation_001→`chime`, confirmation_004→`fanfare`, pluck_001→`tap` |

- 모두 `ffmpeg -ac 1 -c:a aac -b:a 64k`로 m4a 변환(`public/sfx/`), 라이선스 원문은 같은 폴더 `License-*.txt`.
- 배경음악은 코드로 합성(`src/audio.ts`), 외부 파일 없음.

