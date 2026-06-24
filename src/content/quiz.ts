// ---------------------------------------------------------------------------
// Quiz bank. Each question can deep-link to a snippet via `replayId` so the
// learner can "replay this in the visualizer" after seeing the explanation.
// ---------------------------------------------------------------------------

export interface Question {
  id: string
  prompt: string
  code?: string         // optional code block shown above the options
  options: string[]
  answer: number        // index of correct option
  explanation: string
  replayId?: string     // a program id to offer as a visual replay
}

export const QUIZ: Question[] = [
  {
    id: 'q1',
    prompt: 'How many things can the JavaScript call stack execute at the exact same moment?',
    options: ['As many as there are CPU cores', 'Exactly one', 'One per Promise', 'Unlimited'],
    answer: 1,
    explanation: 'JS has a single thread and a single call stack. Concurrency comes from offloading work to Web APIs and queuing callbacks — not from running JS in parallel.',
  },
  {
    id: 'q2',
    prompt: 'What does this print?',
    code: "console.log('A')\nsetTimeout(() => console.log('B'), 0)\nPromise.resolve().then(() => console.log('C'))\nconsole.log('D')",
    options: ['A B C D', 'A D C B', 'A D B C', 'A C D B'],
    answer: 1,
    explanation: 'Synchronous logs run first: A, D. At the microtask checkpoint the Promise callback C runs (microtasks drain before macrotasks). Then the timer macrotask B runs last. → A D C B.',
    replayId: 'classic',
  },
  {
    id: 'q3',
    prompt: 'A Promise.then callback is a…',
    options: ['Macrotask', 'Microtask', 'Web API', 'Render task'],
    answer: 1,
    explanation: 'Promise reactions (.then/.catch/.finally), await continuations, queueMicrotask, and MutationObserver are all microtasks. They drain fully before the next macrotask.',
  },
  {
    id: 'q4',
    prompt: 'setTimeout(fn, 0) guarantees fn runs after exactly 0 milliseconds.',
    options: ['True', 'False'],
    answer: 1,
    explanation: 'False. 0 is a MINIMUM. fn only runs once the stack is empty, all microtasks have drained, earlier macrotasks are done, and the (possibly clamped/throttled) delay has elapsed.',
    replayId: 'timers',
  },
  {
    id: 'q5',
    prompt: 'During a microtask checkpoint, a microtask schedules another microtask. When does that new microtask run?',
    options: [
      'In the next event-loop turn',
      'After the next macrotask',
      'In the same drain, before any macrotask',
      'It is dropped',
    ],
    answer: 2,
    explanation: 'The checkpoint drains until the queue is truly empty, including microtasks added during the drain. They all run before the next macrotask.',
    replayId: 'chained',
  },
  {
    id: 'q6',
    prompt: 'What does this print?',
    code: "async function run() {\n  console.log('1')\n  await null\n  console.log('2')\n}\nconsole.log('0')\nrun()\nconsole.log('3')",
    options: ['0 1 2 3', '0 1 3 2', '0 3 1 2', '1 2 0 3'],
    answer: 1,
    explanation: 'run() runs synchronously to the await: prints 1. await suspends and queues the rest (print 2) as a microtask. Top-level continues: 3. Then the microtask runs: 2. So 0 1 3 2. (0 prints before run() is called.)',
    replayId: 'async',
  },
  {
    id: 'q7',
    prompt: 'Mentally, `await x` is closest to which of these?',
    options: [
      'setTimeout(() => rest(), 0)',
      'Promise.resolve(x).then(() => rest())',
      'A synchronous blocking wait',
      'requestAnimationFrame(rest)',
    ],
    answer: 1,
    explanation: 'await desugars to a Promise continuation: the code after it is scheduled as a microtask, exactly like a .then callback. It is NOT a macrotask (setTimeout) and does NOT block the thread.',
  },
  {
    id: 'q8',
    prompt: 'requestAnimationFrame callbacks run…',
    options: [
      'Immediately, synchronously',
      'As macrotasks in the task queue',
      'Just before the browser paints, after microtasks',
      'Only when the tab is in the background',
    ],
    answer: 2,
    explanation: 'rAF callbacks run during the rendering step, after the microtask drain and right before paint. That is why rAF is the right tool for smooth visual updates.',
    replayId: 'raf',
  },
  {
    id: 'q9',
    prompt: 'What does this print?',
    code: "console.log('start')\nrequestAnimationFrame(() => console.log('raf'))\nPromise.resolve().then(() => console.log('micro'))\nconsole.log('end')",
    options: ['start end micro raf', 'start end raf micro', 'start micro end raf', 'start raf micro end'],
    answer: 0,
    explanation: 'Sync first: start, end. Microtasks drain before rendering: micro. Then the rendering step runs the rAF callback: raf. → start end micro raf.',
    replayId: 'raf',
  },
  {
    id: 'q10',
    prompt: 'Why can an infinite microtask loop freeze the page, but a normal setInterval does not?',
    options: [
      'setInterval has lower priority',
      'Microtasks must fully drain before any macrotask or rendering, so an endless drain blocks everything',
      'Microtasks run on a different thread that crashes',
      'It is a browser bug',
    ],
    answer: 1,
    explanation: 'The drain-to-empty rule means an ever-self-requeuing microtask never lets the loop reach a macrotask or a render. setInterval callbacks are macrotasks, so the loop returns between them and the page stays responsive.',
    replayId: 'starvation',
  },
  {
    id: 'q11',
    prompt: 'A callback passed to fetch().then() is queued as a macrotask once the response arrives.',
    options: ['True', 'False'],
    answer: 1,
    explanation: 'False. The network I/O happens in the Web APIs (off-thread), but the .then reaction is a MICROTASK. The completion is delivered and then the Promise reaction is scheduled on the microtask queue.',
    replayId: 'fetch',
  },
  {
    id: 'q12',
    prompt: 'In Node.js, what runs first?',
    code: "setTimeout(() => console.log('timeout'), 0)\nPromise.resolve().then(() => console.log('promise'))\nprocess.nextTick(() => console.log('nextTick'))",
    options: ['timeout, promise, nextTick', 'nextTick, promise, timeout', 'promise, nextTick, timeout', 'nextTick, timeout, promise'],
    answer: 1,
    explanation: 'Node drains process.nextTick first, then the Promise microtask queue, then moves to the timers phase. → nextTick, promise, timeout. (This is Node-specific; browsers have no process.nextTick.)',
    replayId: 'node',
  },
  {
    id: 'q13',
    prompt: 'Which sits OUTSIDE the JavaScript thread while it is pending?',
    options: ['A Promise.then callback', 'A queued microtask', 'A setTimeout’s timer / a fetch’s network request', 'A call-stack frame'],
    answer: 2,
    explanation: 'The waiting part of timers and network requests lives in the Web APIs, off the JS thread. The callbacks they eventually produce are what land in the queues.',
  },
  {
    id: 'q14',
    prompt: 'After a macrotask finishes running, what does the event loop do before picking the next macrotask?',
    options: [
      'Nothing — it grabs the next macrotask immediately',
      'It drains the entire microtask queue',
      'It always paints a frame',
      'It runs every macrotask in the queue',
    ],
    answer: 1,
    explanation: 'After each macrotask, the microtask queue is drained to empty. Rendering MAY happen, but it is not guaranteed every turn. Only one macrotask runs per turn.',
    replayId: 'finale',
  },
  {
    id: 'q15',
    prompt: 'What does this print?',
    code: "console.log('1')\nsetTimeout(() => {\n  console.log('2')\n  Promise.resolve().then(() => console.log('3'))\n}, 0)\nPromise.resolve().then(() => console.log('4'))\nconsole.log('5')",
    options: ['1 5 4 2 3', '1 5 2 3 4', '1 5 4 3 2', '1 2 3 4 5'],
    answer: 0,
    explanation: 'Sync: 1, 5. Microtask drain: 4. Then the timeout macrotask runs: 2, and it queues a new microtask. After the macrotask, drain microtasks: 3. → 1 5 4 2 3.',
    replayId: 'finale',
  },
  {
    id: 'q16',
    prompt: 'You want code to run after the current synchronous work but before the browser does anything else (paint, timers). Best choice?',
    options: ['setTimeout(fn, 0)', 'queueMicrotask(fn) or Promise.resolve().then(fn)', 'requestAnimationFrame(fn)', 'setInterval(fn, 0)'],
    answer: 1,
    explanation: 'Microtasks run at the very next checkpoint, before rendering and before any macrotask. setTimeout(0) is a macrotask (later); rAF runs at paint time (later still for this purpose).',
  },
]
