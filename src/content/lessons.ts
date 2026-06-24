// ---------------------------------------------------------------------------
// The "docs". Each lesson pairs prose with a program id from snippets.ts so the
// Learn section can render an animated demo right next to the explanation.
// `body` is a tiny block list so we can render headings/paras/lists/callouts.
// ---------------------------------------------------------------------------

export type Block =
  | { t: 'p'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'callout'; kind?: 'key' | 'warn'; text: string }
  | { t: 'code'; code: string }

export interface Lesson {
  id: string
  nav: string          // short nav label
  title: string
  programId: string    // demo to show alongside
  body: Block[]
}

export const LESSONS: Lesson[] = [
  {
    id: 'l1',
    nav: '1 · Call stack',
    title: 'JavaScript runs one thing at a time',
    programId: 'sync',
    body: [
      { t: 'p', text: 'JavaScript has a single thread of execution. There is exactly one place where code runs: the call stack. When you call a function, a frame is pushed; when it returns, the frame is popped. Last in, first out (LIFO).' },
      { t: 'p', text: 'Because there is only one stack and one thread, two pieces of JS never run at literally the same moment. Everything you will learn about the event loop exists to answer one question: while the stack is busy, where does asynchronous work wait, and in what order does it get its turn?' },
      { t: 'callout', kind: 'key', text: 'Mental model: the call stack is the "now". The queues are "later". The event loop decides what becomes "now" next.' },
      { t: 'p', text: 'Step through the demo. Notice the stack only ever shrinks back to empty by popping the exact frame on top — never one underneath.' },
    ],
  },
  {
    id: 'l2',
    nav: '2 · Web APIs',
    title: 'The browser does work off the JS thread',
    programId: 'fetch',
    body: [
      { t: 'p', text: 'If JS is single-threaded, how can a 5-second network request not freeze the page? Because the request does not run in JS. Functions like setTimeout, fetch, XHR, addEventListener, and the geolocation API are provided by the host environment (the browser, or Node), not by the JS language itself.' },
      { t: 'p', text: 'When you call them, JS hands the work to these Web APIs and returns immediately. The slow part runs elsewhere (a timer thread, the network stack, the OS). Your JS keeps executing the next line with no waiting.' },
      { t: 'ul', items: [
        'setTimeout / setInterval → a timer in the host',
        'fetch / XMLHttpRequest → the network stack',
        'addEventListener → the browser routes the event when it happens',
        'requestAnimationFrame → the rendering pipeline',
      ] },
      { t: 'callout', text: 'Key insight: the Web APIs are where async work *waits*. They are NOT part of the queues yet — a callback only joins a queue once its Web API has finished.' },
    ],
  },
  {
    id: 'l3',
    nav: '3 · Macrotasks',
    title: 'The task (macrotask) queue',
    programId: 'timers',
    body: [
      { t: 'p', text: 'When a Web API finishes — a timer elapses, a network response arrives, a click happens — it does not call your callback immediately. It places the callback into the task queue (often called the macrotask queue).' },
      { t: 'p', text: 'The event loop has one simple job: when the call stack is empty, take the oldest task from the queue and run it. The queue is FIFO — first in, first out.' },
      { t: 'callout', text: 'This is why setTimeout(fn, 0) does not run "immediately". The 0 means "schedule as soon as possible", but it still has to (1) go through the Web API, (2) join the back of the task queue, and (3) wait for the stack to be empty and its turn to come up.' },
      { t: 'p', text: 'Macrotask sources include: setTimeout, setInterval, setImmediate (Node), I/O, UI events, and postMessage / MessageChannel.' },
    ],
  },
  {
    id: 'l4',
    nav: '4 · Microtasks',
    title: 'The microtask queue — and the drain rule',
    programId: 'classic',
    body: [
      { t: 'p', text: 'There is a second, higher-priority queue: the microtask queue. Promises (.then/.catch/.finally), await continuations, queueMicrotask(), and MutationObserver callbacks go here.' },
      { t: 'callout', kind: 'key', text: 'THE central rule of the event loop: after the current task finishes (and after the top-level script), the engine drains the ENTIRE microtask queue before doing anything else — before the next macrotask, and before rendering.' },
      { t: 'p', text: 'This is why the classic snippet prints script start, script end, promise, timeout. Both the timer callback and the Promise callback are "later", but the microtask (promise) jumps ahead of the macrotask (timeout) because microtasks drain first.' },
      { t: 'callout', text: 'Draining means: keep running microtasks until the queue is empty — including any microtasks that earlier microtasks add while running. (Next lesson shows that.)' },
    ],
  },
  {
    id: 'l5',
    nav: '5 · Drain depth',
    title: 'Microtasks can queue more microtasks',
    programId: 'chained',
    body: [
      { t: 'p', text: 'A microtask checkpoint does not run a fixed number of microtasks — it runs until the queue is genuinely empty. If a microtask schedules another microtask, that new one is part of the same drain and runs before any macrotask.' },
      { t: 'p', text: 'In the demo, a Promise chain (.then.then.then) produces its callbacks one at a time: resolving the first creates the second, and so on. All three drain back-to-back, and only then does the setTimeout macrotask get to run.' },
      { t: 'callout', kind: 'warn', text: 'Foreshadowing: if microtasks NEVER stop queuing themselves, the drain never ends. That is starvation — covered in lesson 8.' },
    ],
  },
  {
    id: 'l6',
    nav: '6 · async/await',
    title: 'async / await is microtasks in disguise',
    programId: 'async',
    body: [
      { t: 'p', text: 'async/await is not a new concurrency mechanism — it is syntax over Promises. An async function runs synchronously up to its first await. At the await, the function suspends and schedules "the rest of the function" as a microtask, then returns control to the caller.' },
      { t: 'code', code: "async function run() {\n  console.log('A')   // runs now, synchronously\n  await null         // suspend; queue the rest as a microtask\n  console.log('B')   // runs later, as a microtask\n}" },
      { t: 'p', text: 'So the code after every await behaves exactly like a .then callback. In the demo, A prints synchronously, then start/end finish, then B and the separate .then run as microtasks in the order they were queued.' },
      { t: 'callout', text: 'Rule of thumb: mentally replace every `await x` with `Promise.resolve(x).then(() => { /* rest */ })`. The ordering falls right out.' },
    ],
  },
  {
    id: 'l7',
    nav: '7 · Timers',
    title: 'setTimeout(0) is a minimum, not a guarantee',
    programId: 'timers',
    body: [
      { t: 'p', text: 'setTimeout’s delay is the *minimum* time before the callback may run, not an exact schedule. The callback only runs once: the delay has elapsed, the stack is empty, all microtasks have drained, and earlier macrotasks ahead of it are done.' },
      { t: 'ul', items: [
        'Nested timers are clamped to ~4ms minimum after 5 levels deep (HTML spec).',
        'Background/inactive tabs throttle timers heavily (often ≥1s).',
        'Two setTimeout(0) calls fire in registration order — the queue is FIFO.',
      ] },
      { t: 'callout', text: 'If you need "after the current synchronous work but before the browser does anything else", you want a microtask (queueMicrotask / Promise.resolve().then), not setTimeout(0).' },
    ],
  },
  {
    id: 'l8',
    nav: '8 · Rendering',
    title: 'Where rendering and requestAnimationFrame fit',
    programId: 'raf',
    body: [
      { t: 'p', text: 'Rendering (style → layout → paint) is something the browser does between tasks, typically ~60 times per second. It is not a macrotask you queue; it is a step the event loop takes when it decides to produce a frame.' },
      { t: 'p', text: 'requestAnimationFrame callbacks run as part of that rendering step — after microtasks, right before the browser paints. That makes rAF the correct place to do visual updates: your change is painted in the same frame.' },
      { t: 'callout', kind: 'key', text: 'Order within a turn: run a task → drain ALL microtasks → (if it is time to render) run rAF callbacks → paint. Then the loop comes back around for the next task.' },
      { t: 'p', text: 'This is why animating with setTimeout is janky but rAF is smooth: rAF is synced to the paint cadence; setTimeout is not.' },
    ],
  },
  {
    id: 'l9',
    nav: '9 · Starvation',
    title: 'Starvation: when microtasks never stop',
    programId: 'starvation',
    body: [
      { t: 'p', text: 'The drain rule has a dark side. Because microtasks run to completion before any macrotask OR rendering, a microtask that keeps re-queuing itself will run forever — and the page will freeze. No timers fire, no clicks process, no frames paint.' },
      { t: 'code', code: "function spin() {\n  Promise.resolve().then(spin) // re-queues itself every drain\n}\nspin() // the tab is now frozen" },
      { t: 'callout', kind: 'warn', text: 'A long-running *synchronous* loop blocks too, but it eventually ends. An infinite microtask loop is worse: it satisfies the event loop’s "keep draining" rule indefinitely.' },
      { t: 'p', text: 'Practical takeaway: do not schedule unbounded recursive microtasks. If you must do repeated async work and let the page breathe, use setTimeout or break work across macrotasks.' },
    ],
  },
  {
    id: 'l10',
    nav: '10 · Node.js',
    title: 'Node.js: phases and process.nextTick',
    programId: 'node',
    body: [
      { t: 'p', text: 'The browser and Node share the microtask idea but differ in the macrotask machinery. Node’s event loop (libuv) has ordered phases: timers, pending callbacks, poll, check (setImmediate), close. It drains microtasks between each phase.' },
      { t: 'p', text: 'Node also has an extra, even-higher-priority queue: process.nextTick. The nextTick queue is drained before the Promise microtask queue, which is drained before the loop moves to the next phase.' },
      { t: 'callout', text: 'Node priority order between operations: synchronous code → process.nextTick queue → Promise microtask queue → next libuv phase (timers/setImmediate/etc.).' },
      { t: 'callout', kind: 'warn', text: 'Browser-only code has no process.nextTick or setImmediate. Do not rely on Node ordering in the browser.' },
    ],
  },
  {
    id: 'l11',
    nav: '11 · Everything',
    title: 'Putting it all together',
    programId: 'finale',
    body: [
      { t: 'p', text: 'This program combines synchronous code, a timer, a top-level Promise, an async function with await, and a microtask queued from inside the timer. If you can predict its output before stepping through, you understand the event loop.' },
      { t: 'p', text: 'Try to predict the order first, then step through and check the console. The summary checklist:' },
      { t: 'ul', items: [
        '1. Run all synchronous top-level code first.',
        '2. Reach a checkpoint → drain ALL microtasks (await continuations + .then), in queue order.',
        '3. Take ONE macrotask (the timeout).',
        '4. After it finishes, drain microtasks again (the one the timeout queued) before any further macrotask.',
        '5. Rendering, if any, happens between turns after microtasks.',
      ] },
      { t: 'callout', kind: 'key', text: 'One sentence to remember it all: run a task → empty the microtask queue → maybe render → repeat.' },
    ],
  },
]
