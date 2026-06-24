// ---------------------------------------------------------------------------
// Preset programs. Each is hand-authored so its step list reproduces the EXACT
// semantics of the real engine. The `expectedOutput` is the canonical console
// output you'd actually see in a browser (or Node, where noted).
// ---------------------------------------------------------------------------

import type { Instruction, Program } from './types'

// Small helpers to keep instruction lists readable.
const push = (label: string, line?: number, sub?: string): Instruction => ({ op: 'push', label, line, sub })
const pop = (): Instruction => ({ op: 'pop' })
const log = (value: string, line?: number): Instruction => ({ op: 'log', value, line })
const note = (n: string): Instruction => ({ op: 'note', note: n })
const endScript = (): Instruction => ({ op: 'endScript' })
const checkpoint = (): Instruction => ({ op: 'phase', phase: 'drain-microtasks', note: 'Microtask checkpoint: drain the ENTIRE microtask queue before anything else.' })
const pickMacro = (): Instruction => ({ op: 'phase', phase: 'pick-macrotask', note: 'Microtask queue empty. The event loop dequeues the next macrotask.' })

// ===========================================================================
// 1. Synchronous baseline — just the call stack.
// ===========================================================================
const sync: Program = {
  id: 'sync',
  title: '1 · Synchronous call stack',
  blurb: 'No async at all. Watch frames push and pop in LIFO order. This is "the program counter" of JS.',
  source: [
    'function greet(name) {',
    '  return "Hi " + name',
    '}',
    'function main() {',
    '  const msg = greet("Ada")',
    '  console.log(msg)',
    '}',
    'main()',
  ],
  expectedOutput: ['Hi Ada'],
  instructions: [
    push('main()', 8, 'global calls main'),
    push('greet("Ada")', 5, 'called from main'),
    { op: 'pop', line: 2, note: 'greet returns "Hi Ada" and is popped.' },
    log('Hi Ada', 6),
    { op: 'pop', line: 7, note: 'main returns and is popped.' },
  ],
}

// ===========================================================================
// 2. The classic: setTimeout(0) vs Promise.then — micro beats macro.
// ===========================================================================
const classic: Program = {
  id: 'classic',
  title: '2 · setTimeout(0) vs Promise.then',
  blurb: 'The single most important ordering rule. Microtasks always run before the next macrotask — even a 0ms timer.',
  source: [
    "console.log('script start')",
    '',
    'setTimeout(() => {',
    "  console.log('timeout')",
    '}, 0)',
    '',
    'Promise.resolve().then(() => {',
    "  console.log('promise')",
    '})',
    '',
    "console.log('script end')",
  ],
  expectedOutput: ['script start', 'script end', 'promise', 'timeout'],
  instructions: [
    push('<script>', 1, 'top-level script'),
    log('script start', 1),
    { op: 'webapi', id: 'to1', label: 'Timer(0ms)', sub: 'setTimeout cb', line: 3, note: 'setTimeout hands the timer to the Web APIs; JS keeps going immediately.' },
    { op: 'microtask', id: 'mt1', label: '.then cb', sub: "prints 'promise'", line: 7, note: 'Promise is already resolved, so its .then callback is queued as a microtask.' },
    log('script end', 11),
    note('Meanwhile the 0ms timer elapses in the Web APIs and its callback moves to the macrotask queue.'),
    { op: 'webapiToMacro', id: 'to1', label: 'timeout cb', sub: "prints 'timeout'" },
    { op: 'pop', line: 11, note: 'Top-level script finishes; the stack is now empty.' },
    endScript(),
    { op: 'runMicrotask', id: 'mt1', note: 'Microtask checkpoint: run the .then callback.' },
    push('.then cb', 7),
    log('promise', 8),
    pop(),
    note('Microtask queue is empty. Only now may the loop take a macrotask.'),
    pickMacro(),
    { op: 'runMacrotask', id: 'to1', note: 'Dequeue the timeout callback.' },
    push('timeout cb', 3),
    log('timeout', 4),
    pop(),
  ],
}

// ===========================================================================
// 3. Microtasks added during the drain — the queue keeps draining.
// ===========================================================================
const chained: Program = {
  id: 'chained',
  title: '3 · Microtasks that spawn microtasks',
  blurb: 'A microtask can queue more microtasks. The checkpoint keeps draining until truly empty — they all run before any macrotask.',
  source: [
    "setTimeout(() => console.log('macro'), 0)",
    '',
    'Promise.resolve()',
    "  .then(() => console.log('micro 1'))",
    "  .then(() => console.log('micro 2'))",
    "  .then(() => console.log('micro 3'))",
  ],
  expectedOutput: ['micro 1', 'micro 2', 'micro 3', 'macro'],
  instructions: [
    push('<script>', 1),
    { op: 'webapi', id: 'to', label: 'Timer(0ms)', sub: 'macro cb', line: 1 },
    { op: 'microtask', id: 'm1', label: '.then #1', sub: "'micro 1'", line: 4, note: 'Only the FIRST .then is queued now; later .thens are created as each resolves.' },
    { op: 'webapiToMacro', id: 'to', label: 'macro cb', sub: "'macro'" },
    pop(),
    endScript(),
    { op: 'runMicrotask', id: 'm1' },
    push('.then #1', 4), log('micro 1', 4), pop(),
    { op: 'microtask', id: 'm2', label: '.then #2', sub: "'micro 2'", note: 'Resolving #1 queues #2 as a NEW microtask — added to the same drain.' },
    { op: 'runMicrotask', id: 'm2' },
    push('.then #2', 5), log('micro 2', 5), pop(),
    { op: 'microtask', id: 'm3', label: '.then #3', sub: "'micro 3'", note: 'And #2 queues #3. Still draining microtasks.' },
    { op: 'runMicrotask', id: 'm3' },
    push('.then #3', 6), log('micro 3', 6), pop(),
    note('Microtask queue finally empty. NOW the macrotask runs.'),
    pickMacro(),
    { op: 'runMacrotask', id: 'to' },
    push('macro cb', 1), log('macro', 1), pop(),
  ],
}

// ===========================================================================
// 4. async / await desugaring.
// ===========================================================================
const asyncAwait: Program = {
  id: 'async',
  title: '4 · async / await is just .then',
  blurb: 'await pauses the function and schedules the rest as a microtask. Watch how it interleaves with a Promise and a timer.',
  source: [
    'async function run() {',
    "  console.log('A')",
    '  await null',
    "  console.log('B')",          // resumes as a microtask
    '}',
    "console.log('start')",
    'run()',
    "Promise.resolve().then(() => console.log('then'))",
    "console.log('end')",
  ],
  expectedOutput: ['start', 'A', 'end', 'B', 'then'],
  instructions: [
    push('<script>', 6),
    log('start', 6),
    push('run()', 7, 'enters async fn'),
    log('A', 2),
    { op: 'microtask', id: 'cont', label: 'run() resume', sub: "after await -> 'B'", line: 3, note: 'await suspends run(). The continuation (everything after await) is queued as a microtask.' },
    { op: 'pop', line: 7, note: 'run() returns a pending Promise to its caller; its frame leaves the stack.' },
    { op: 'microtask', id: 'then', label: '.then cb', sub: "'then'", line: 8, note: '.then is queued AFTER the await continuation — order matters.' },
    log('end', 9),
    pop(),
    endScript(),
    { op: 'runMicrotask', id: 'cont', note: 'First microtask: resume run() after the await.' },
    push('run() (resumed)', 4),
    log('B', 4),
    pop(),
    { op: 'runMicrotask', id: 'then', note: 'Second microtask: the .then callback.' },
    push('.then cb', 8),
    log('then', 8),
    pop(),
  ],
}

// ===========================================================================
// 5. setTimeout ordering / "0ms" is a minimum, not exact.
// ===========================================================================
const timers: Program = {
  id: 'timers',
  title: '5 · setTimeout(0) is a minimum delay',
  blurb: 'Two timers fire in the order they were registered. "0ms" really means "after the current work, as soon as possible" (browsers also clamp nested timers to ~4ms).',
  source: [
    "console.log('1')",
    "setTimeout(() => console.log('2 (timer A 0ms)'), 0)",
    "setTimeout(() => console.log('3 (timer B 0ms)'), 0)",
    "console.log('4')",
  ],
  expectedOutput: ['1', '4', '2 (timer A 0ms)', '3 (timer B 0ms)'],
  instructions: [
    push('<script>', 1),
    log('1', 1),
    { op: 'webapi', id: 'A', label: 'Timer A(0ms)', sub: 'cb -> 2', line: 2 },
    { op: 'webapi', id: 'B', label: 'Timer B(0ms)', sub: 'cb -> 3', line: 3 },
    log('4', 4),
    { op: 'webapiToMacro', id: 'A', label: 'timer A cb', sub: '-> 2', note: 'Timer A elapsed first, so its callback is queued first.' },
    { op: 'webapiToMacro', id: 'B', label: 'timer B cb', sub: '-> 3', note: 'Timer B next. The macrotask queue is FIFO.' },
    pop(),
    endScript(),
    checkpoint(),
    note('No microtasks. Take the first macrotask.'),
    pickMacro(),
    { op: 'runMacrotask', id: 'A' }, push('timer A cb', 2), log('2 (timer A 0ms)', 2), pop(),
    note('Back to the loop — drain microtasks (none), take the next macrotask.'),
    pickMacro(),
    { op: 'runMacrotask', id: 'B' }, push('timer B cb', 3), log('3 (timer B 0ms)', 3), pop(),
  ],
}

// ===========================================================================
// 6. fetch / Promise from a real async Web API.
// ===========================================================================
const fetchDemo: Program = {
  id: 'fetch',
  title: '6 · fetch() and the network',
  blurb: 'fetch returns immediately with a pending Promise. The network lives in the Web APIs; when it resolves, the .then runs as a microtask.',
  source: [
    "console.log('requesting...')",
    "fetch('/api')",
    '  .then(res => {',
    "    console.log('got response')",
    '  })',
    "console.log('request sent')",
  ],
  expectedOutput: ['requesting...', 'request sent', 'got response'],
  instructions: [
    push('<script>', 1),
    log('requesting...', 1),
    { op: 'webapi', id: 'net', label: 'fetch /api', sub: 'network I/O', line: 2, note: 'The network request runs off-thread in the Web APIs. JS does NOT block.' },
    log('request sent', 6),
    pop(),
    endScript(),
    checkpoint(),
    note('Stack empty, no microtasks yet. The loop idles, waiting on the network…'),
    { op: 'phase', phase: 'idle', note: 'Idle: waiting for the Web API (network) to complete.' },
    note('…the response arrives. The Web API resolves the Promise, queuing its .then as a microtask.'),
    { op: 'webapiToMacro', id: 'net', label: 'resolve fetch', sub: 'queues .then' },
    // model the resolution producing a microtask (simplify: move resolve task, then queue microtask)
    { op: 'runMacrotask', id: 'net', note: 'The network completion is delivered as a task that resolves the Promise…' },
    { op: 'microtask', id: 'thenF', label: '.then cb', sub: "'got response'", note: '…which schedules the .then callback as a microtask.' },
    checkpoint(),
    { op: 'runMicrotask', id: 'thenF' },
    push('.then cb', 3), log('got response', 4), pop(),
  ],
}

// ===========================================================================
// 7. requestAnimationFrame vs setTimeout — where rendering sits.
// ===========================================================================
const raf: Program = {
  id: 'raf',
  title: '7 · requestAnimationFrame & rendering',
  blurb: 'rAF callbacks run right BEFORE the browser paints, after microtasks. A setTimeout(0) registered alongside usually runs in a later turn.',
  source: [
    "console.log('frame setup')",
    'requestAnimationFrame(() => {',
    "  console.log('rAF — just before paint')",
    '})',
    'Promise.resolve().then(() => {',
    "  console.log('microtask')",
    '})',
    "setTimeout(() => console.log('timeout'), 0)",
  ],
  expectedOutput: ['frame setup', 'microtask', 'rAF — just before paint', 'timeout'],
  instructions: [
    push('<script>', 1),
    log('frame setup', 1),
    { op: 'raf', id: 'r1', label: 'rAF cb', sub: 'before paint', line: 2 },
    { op: 'microtask', id: 'm', label: '.then cb', sub: "'microtask'", line: 5 },
    { op: 'webapi', id: 't', label: 'Timer(0ms)', sub: 'cb -> timeout', line: 8 },
    { op: 'webapiToMacro', id: 't', label: 'timeout cb', sub: "'timeout'" },
    pop(),
    endScript(),
    { op: 'runMicrotask', id: 'm', note: 'Microtasks drain first, before rendering.' },
    push('.then cb', 5), log('microtask', 6), pop(),
    { op: 'phase', phase: 'render', note: 'Rendering opportunity: run rAF callbacks, then style/layout/paint.' },
    { op: 'runRaf', id: 'r1' },
    push('rAF cb', 2), log('rAF — just before paint', 3), pop(),
    { op: 'paint', note: 'The browser paints the frame here.' },
    note('After the frame, the loop continues to the pending macrotask.'),
    pickMacro(),
    { op: 'runMacrotask', id: 't' }, push('timeout cb', 8), log('timeout', 8), pop(),
  ],
}

// ===========================================================================
// 8. Starvation — infinite microtasks block rendering & timers.
// ===========================================================================
const starvation: Program = {
  id: 'starvation',
  title: '8 · Microtask starvation',
  blurb: 'Because microtasks fully drain before the next macrotask OR render, an endless microtask loop freezes the page. We show 3 rounds — imagine it never ending.',
  source: [
    'function spin() {',
    '  Promise.resolve().then(spin) // re-queues itself forever',
    '}',
    "setTimeout(() => console.log('I never run'), 0)",
    'spin()',
  ],
  expectedOutput: ['(timeout never runs — the page is frozen)'],
  instructions: [
    push('<script>', 1),
    { op: 'webapi', id: 'to', label: 'Timer(0ms)', sub: 'starved cb', line: 4 },
    { op: 'webapiToMacro', id: 'to', label: 'timeout cb', sub: 'waits forever' },
    push('spin()', 5),
    { op: 'microtask', id: 's1', label: 'spin #1', sub: 're-queues self', line: 2 },
    pop(),
    pop(),
    endScript(),
    { op: 'runMicrotask', id: 's1' }, push('spin', 2),
    { op: 'microtask', id: 's2', label: 'spin #2', sub: 're-queues self', note: 'spin queues spin again — the queue never empties.' }, pop(),
    { op: 'runMicrotask', id: 's2' }, push('spin', 2),
    { op: 'microtask', id: 's3', label: 'spin #3', sub: 're-queues self' }, pop(),
    { op: 'runMicrotask', id: 's3' }, push('spin', 2),
    { op: 'microtask', id: 's4', label: 'spin #4', sub: '…and so on forever' }, pop(),
    note('The macrotask (and any rendering) can NEVER be reached. This is starvation — the tab hangs.'),
    { op: 'phase', phase: 'drain-microtasks', note: '⚠️ Stuck draining microtasks forever. setTimeout never fires.' },
  ],
}

// ===========================================================================
// 9. Node.js: process.nextTick beats Promise microtasks.
// ===========================================================================
const node: Program = {
  id: 'node',
  title: '9 · Node.js: process.nextTick',
  blurb: 'Node has its own loop with phases. Its nextTick queue runs before the Promise microtask queue, and both run between phases. (Node-only.)',
  env: 'node',
  source: [
    "console.log('start')",
    "setTimeout(() => console.log('timeout'), 0)",
    "Promise.resolve().then(() => console.log('promise'))",
    "process.nextTick(() => console.log('nextTick'))",
    "console.log('end')",
  ],
  expectedOutput: ['start', 'end', 'nextTick', 'promise', 'timeout'],
  instructions: [
    push('<script>', 1),
    log('start', 1),
    { op: 'webapi', id: 'to', label: 'Timer(0ms)', sub: 'timers phase', line: 2 },
    { op: 'microtask', id: 'p', label: 'Promise .then', sub: 'microtask q', line: 3 },
    { op: 'microtask', id: 'nt', label: 'process.nextTick', sub: 'nextTick q (priority)', line: 4, note: 'In Node, nextTick has its OWN higher-priority queue, drained before Promises.' },
    { op: 'webapiToMacro', id: 'to', label: 'timeout cb', sub: 'timers phase' },
    log('end', 5),
    pop(),
    endScript(),
    note('Between phases Node drains nextTick FIRST, then the Promise microtask queue.'),
    { op: 'runMicrotask', id: 'nt', note: 'nextTick queue drains before Promise microtasks.' },
    push('nextTick cb', 4), log('nextTick', 4), pop(),
    { op: 'runMicrotask', id: 'p', note: 'Now the Promise microtask queue.' },
    push('.then cb', 3), log('promise', 3), pop(),
    pickMacro(),
    { op: 'runMacrotask', id: 'to', note: 'Then the timers phase runs the setTimeout callback.' },
    push('timeout cb', 2), log('timeout', 2), pop(),
  ],
}

// ===========================================================================
// 10. Grand finale — everything interleaved.
// ===========================================================================
const finale: Program = {
  id: 'finale',
  title: '10 · Putting it all together',
  blurb: 'Sync + timer + Promise chain + await, traced end to end. If you can predict this output, you understand the event loop.',
  source: [
    "console.log('1: sync')",
    'setTimeout(() => {',
    "  console.log('2: timeout')",
    "  Promise.resolve().then(() => console.log('3: promise in timeout'))",
    '}, 0)',
    'async function go() {',
    "  console.log('4: sync in async')",
    '  await null',
    "  console.log('5: after await')",
    '}',
    'go()',
    "Promise.resolve().then(() => console.log('6: top-level promise'))",
    "console.log('7: sync end')",
  ],
  expectedOutput: [
    '1: sync',
    '4: sync in async',
    '7: sync end',
    '5: after await',
    '6: top-level promise',
    '2: timeout',
    '3: promise in timeout',
  ],
  instructions: [
    push('<script>', 1),
    log('1: sync', 1),
    { op: 'webapi', id: 'to', label: 'Timer(0ms)', sub: 'timeout cb', line: 2 },
    push('go()', 11),
    log('4: sync in async', 7),
    { op: 'microtask', id: 'await', label: 'go() resume', sub: "-> '5'", line: 8, note: 'await suspends go(); its continuation is queued as a microtask.' },
    { op: 'pop', line: 11, note: 'go() returns a pending Promise; frame leaves.' },
    { op: 'microtask', id: 'top', label: '.then cb', sub: "-> '6'", line: 12 },
    log('7: sync end', 13),
    { op: 'webapiToMacro', id: 'to', label: 'timeout cb', sub: "-> '2'" },
    pop(),
    endScript(),
    { op: 'runMicrotask', id: 'await', note: 'Microtask 1: resume go() after await.' },
    push('go() (resumed)', 9), log('5: after await', 9), pop(),
    { op: 'runMicrotask', id: 'top', note: 'Microtask 2: the top-level .then.' },
    push('.then cb', 12), log('6: top-level promise', 12), pop(),
    note('Microtasks empty. Run the macrotask (the timeout).'),
    pickMacro(),
    { op: 'runMacrotask', id: 'to' },
    push('timeout cb', 2),
    log('2: timeout', 3),
    { op: 'microtask', id: 'inner', label: '.then cb', sub: "-> '3'", line: 4, note: 'The timeout callback queues a NEW microtask while it runs.' },
    pop(),
    note('A macrotask just finished → microtask checkpoint again before the next macrotask.'),
    checkpoint(),
    { op: 'runMicrotask', id: 'inner', note: 'Drain the microtask queued by the timeout.' },
    push('.then cb', 4), log('3: promise in timeout', 4), pop(),
  ],
}

export const PROGRAMS: Program[] = [
  sync, classic, chained, asyncAwait, timers, fetchDemo, raf, starvation, node, finale,
]

export const programById = (id: string) => PROGRAMS.find((p) => p.id === id) ?? PROGRAMS[0]
