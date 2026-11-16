# secondPrj (가칭)

Daeun.dev의 두 번째 모바일 게임 실험. 작은 방 디오라마 복원 게임을 프로토타입까지 만들었다가 **중단**했습니다(2026-11-16, [결정 018](docs/DECISIONS.md)). 다음 게임의 골격과 아이디어 선정 기준으로 남겨 둡니다.

- 작업 규칙: [AGENTS.md](AGENTS.md)
- 결정 기록: [docs/DECISIONS.md](docs/DECISIONS.md)
- 최신 상태: [docs/HANDOFF.md](docs/HANDOFF.md)
- 할 일: [docs/TODO.md](docs/TODO.md)

## 실행
```bash
npm install
npm run dev      # http://localhost:5317 (영어: ?lang=en)
npm test         # content:check
npm run ios      # iOS: 웹 빌드 → 동기화 → Xcode 열기(서명은 Xcode에서), 자세히는 docs/IOS.md
```
