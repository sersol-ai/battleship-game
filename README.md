# Battleship

Browser Battleship — play the computer or a friend online. TypeScript, Vite, Node + `ws`.

```bash
npm ci
npm run dev          # client on http://localhost:5173
npm run dev:server   # server on :8080 (needed for online play in dev)
npm run check        # typecheck + format + unit tests
npm run build && npm start
```

- Design: `docs/ARCHITECTURE.md`, UI/test contract: `docs/UI-CONTRACT.md`
- Work is split into small agent tasks: `tasks/BOARD.md`; agent rules: `AGENTS.md`
- Deployed via `sersol-ai/portainer-iac` at `battleship.sonic.wtf` (see `tasks/D-03-deploy-portainer.md`)
