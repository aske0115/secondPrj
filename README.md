# secondPrj (가칭)

Daeun.dev의 두 번째 모바일 게임. **사주·타로로 태어나 매일의 운세로 자라는 펫**을 프로토타입 중입니다([결정 024](docs/DECISIONS.md)). 앞서 디오라마 복원(태그 `diorama-prototype`)과 전술 퍼즐(태그 `tactics-prototype`)은 중단했습니다.

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
