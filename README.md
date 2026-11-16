# secondPrj (가칭)

Daeun.dev의 두 번째 게임 실험 저장소. 2026-11-16 하루 동안 디오라마 복원(`diorama-prototype`), 전술 퍼즐(`tactics-prototype`), 사주·타로 운세 펫(`fortune-pet-prototype`)을 프로토타입까지 만들고 모두 중단했습니다. 이유와 교훈은 [결정 기록](docs/DECISIONS.md).

- 작업 규칙: [AGENTS.md](AGENTS.md)
- 결정 기록: [docs/DECISIONS.md](docs/DECISIONS.md)
- 최신 상태: [docs/HANDOFF.md](docs/HANDOFF.md)
- 할 일: [docs/TODO.md](docs/TODO.md)

## 실행
```bash
npm install
npm run dev      # http://localhost:5317 (?lang=en)
npm test         # 사주 정답표 + 콘텐츠 검사
npm run ios      # iOS: 웹 빌드 → 동기화 → Xcode 열기(서명은 Xcode에서), docs/IOS.md
```
