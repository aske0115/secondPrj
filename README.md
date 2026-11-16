# secondPrj (가칭)

Daeun.dev의 두 번째 모바일 게임. 양치기 개가 늑대를 밀어 양을 지키는 한 손 전술 퍼즐을 프로토타입 중입니다([결정 019](docs/DECISIONS.md), [규칙](docs/GAME_RULES.md)). 앞서 만든 디오라마 복원은 중단했습니다(결정 018, 태그 `diorama-prototype`).

- 작업 규칙: [AGENTS.md](AGENTS.md)
- 결정 기록: [docs/DECISIONS.md](docs/DECISIONS.md)
- 최신 상태: [docs/HANDOFF.md](docs/HANDOFF.md)
- 할 일: [docs/TODO.md](docs/TODO.md)

## 실행
```bash
npm install
npm run dev      # http://localhost:5317 (?stage=3, ?lang=en)
npm test         # 규칙 + 스테이지 검사(풀이기)
npm run ios      # iOS: 웹 빌드 → 동기화 → Xcode 열기(서명은 Xcode에서), docs/IOS.md
```
