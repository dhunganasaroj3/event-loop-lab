# Event Loop Lab

An animated, interactive deep-dive into the JavaScript event loop — call stack, Web APIs, macrotasks, microtasks, rendering, and the exact ordering rules — with a graded quiz and a live code playground.

**Live demo:** https://dhunganasaroj3.github.io/event-loop-lab/

## Features

- **📖 Learn** — 11 ordered lessons, each next to an animated demo you can play / step through.
- **🧪 Simulator** — 10 preset programs animated through a deterministic event-loop engine; predict-the-output mode.
- **⌨️ Playground** — paste your own JavaScript and watch the real event-loop process it. Runs in a sandboxed iframe with instrumented `setTimeout` / `Promise` / `queueMicrotask` / `requestAnimationFrame` / `fetch` (stubbed), then animates the recorded trace.
- **🧠 Quiz** — 16 graded questions with explanations and "replay in the visualizer" deep-links.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build to dist/
```

## Verify (headless correctness checks)

```bash
npx tsx scripts/verify.mts            # preset programs match real browser/Node output
npx tsx scripts/verifyPlayground.mts  # playground trace pipeline matches real execution
```

## Deploy

```bash
npm run deploy   # builds and publishes dist/ to the gh-pages branch
```

## Tech

React 19 · Vite · TypeScript · Framer Motion. No backend — everything runs client-side.
