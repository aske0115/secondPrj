import { defineConfig } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// 개발 서버에서만: 촬영 모드(__demo.shot)가 렌더한 PNG를 docs/art/에 저장한다. 이름은 정해진 것만 받는다
const SHOTS = new Set(['icon', 'splash']);

export default defineConfig({
  plugins: [
    {
      name: 'shot-save',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/__shot', (req, res) => {
          const name = new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? '';
          if (req.method !== 'POST' || !SHOTS.has(name)) {
            res.statusCode = 400;
            return res.end('bad request');
          }
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', () => {
            const dir = join(server.config.root, 'docs/art'); // 개발 서버를 다른 폴더에서 띄워도 저장소 안에 저장
            mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, `${name}.png`), Buffer.concat(chunks));
            res.end('ok');
          });
        });
      },
    },
  ],
});
