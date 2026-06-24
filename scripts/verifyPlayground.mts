// Verifies the playground pipeline WITHOUT a browser:
//  1. Run each example with real timers/promises under instrumentation that
//     mirrors tracer.ts, collecting a TraceEvent[].
//  2. Convert with the real traceToProgram().
//  3. Fold through the real engine and assert the visualized console output
//     equals the actual console output of running the code for real.
//
// This exercises the exact ordering logic the browser sandbox uses.
import { traceToProgram } from '../src/playground/traceToProgram'
import { stateAt, totalSteps } from '../src/engine/eventLoopEngine'
import type { TraceEvent } from '../src/playground/tracer'

// ---- Node-side instrumentation mirroring buildHarness() in tracer.ts -------
function instrumentAndRun(code: string): Promise<{ events: TraceEvent[]; real: string[] }> {
  return new Promise((resolve) => {
    const events: TraceEvent[] = []
    const real: string[] = []
    let seq = 0
    let cbId = 0
    let pending = 0
    let finished = false
    const rec = (e: any) => { e.seq = seq++; events.push(e) }

    const sandboxConsole = {
      log: (...args: any[]) => {
        const v = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
        real.push(v)
        rec({ kind: 'log', value: v })
      },
    }

    function wrap(queue: 'macro' | 'micro' | 'raf', id: number, label: string, fn: Function) {
      return function (this: any, ...a: any[]) {
        rec({ kind: 'enter', queue, id, label })
        try { return fn.apply(this, a) }
        finally {
          rec({ kind: 'exit', id })
          if (queue === 'macro' || queue === 'raf') { pending--; maybeFinish() }
        }
      }
    }

    const _setTimeout = (fn: any, d?: number) => setTimeout(fn, d)

    const sandboxSetTimeout = (fn: Function, delay?: number) => {
      const id = ++cbId
      const label = 'setTimeout(' + (delay || 0) + 'ms)'
      rec({ kind: 'schedule', queue: 'macro', id, label, sub: 'macrotask' })
      pending++
      return _setTimeout(wrap('macro', id, label, fn), delay || 0)
    }

    const sandboxQueueMicrotask = (fn: Function) => {
      const id = ++cbId
      rec({ kind: 'schedule', queue: 'micro', id, label: 'queueMicrotask', sub: 'microtask' })
      queueMicrotask(wrap('micro', id, 'queueMicrotask', fn))
    }

    const sandboxRAF = (fn: Function) => {
      const id = ++cbId
      rec({ kind: 'schedule', queue: 'raf', id, label: 'requestAnimationFrame', sub: 'before paint' })
      pending++
      return _setTimeout(wrap('raf', id, 'requestAnimationFrame', fn), 0)
    }

    // instrument Promise.prototype.then GLOBALLY, exactly like the browser
    // harness does — this catches every .then in a chain, regardless of how the
    // promise was created. We restore it once the run settles.
    const _origThen = Promise.prototype.then
    function tag(h: any, kind: string) {
      if (typeof h !== 'function') return h
      const id = ++cbId
      return (val: any) => {
        rec({ kind: 'schedule', queue: 'micro', id, label: '.then(' + kind + ')', sub: 'microtask' })
        rec({ kind: 'enter', queue: 'micro', id, label: '.then(' + kind + ')' })
        try { return h(val) } finally { rec({ kind: 'exit', id }) }
      }
    }
    ;(Promise.prototype as any).then = function (this: any, onF?: any, onR?: any) {
      return _origThen.call(this, tag(onF, 'fulfilled'), tag(onR, 'rejected'))
    }
    const restoreThen = () => { Promise.prototype.then = _origThen }
    const TracedPromise = Promise

    const sandboxFetch = (url: string) => {
      rec({ kind: 'webapi', id: ++cbId, label: 'fetch ' + url, sub: 'network (stubbed)' })
      return TracedPromise.resolve({ ok: true, json: () => TracedPromise.resolve({ stubbed: true, url }) })
    }

    let settleScheduled = false
    function maybeFinish() {
      if (finished || settleScheduled) return
      settleScheduled = true
      const snapshot = events.length
      _setTimeout(() => {
        settleScheduled = false
        if (finished) return
        if (pending <= 0 && events.length === snapshot) finish()
        else maybeFinish()
      }, 0)
    }
    function finish() {
      if (finished) return
      finished = true
      restoreThen()
      resolve({ events, real })
    }

    // Build a runner function with instrumented names in scope.
    const runner = new Function(
      'console', 'setTimeout', 'queueMicrotask', 'requestAnimationFrame', 'Promise', 'fetch',
      code,
    )
    try {
      runner(sandboxConsole, sandboxSetTimeout, sandboxQueueMicrotask, sandboxRAF, TracedPromise, sandboxFetch)
    } catch (err: any) {
      rec({ kind: 'error', message: String(err?.message || err) })
    }
    rec({ kind: 'scriptEnd' })
    maybeFinish()
    _setTimeout(() => finish(), 2000)
  })
}

// Ground truth: run the same code with REAL globals, capture console order.
function runForReal(code: string): Promise<string[]> {
  return new Promise((resolve) => {
    const out: string[] = []
    const c = { log: (...a: any[]) => out.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')) }
    const fakeFetch = (url: string) => Promise.resolve({ ok: true, json: () => Promise.resolve({ stubbed: true, url }) })
    const fn = new Function('console', 'fetch', code)
    try { fn(c, fakeFetch) } catch { /* ignore */ }
    // wait for all async to settle
    setTimeout(() => resolve(out), 200)
  })
}

const EXAMPLES = [
  { name: 'classic race', code: `console.log('script start')
setTimeout(() => { console.log('timeout') }, 0)
Promise.resolve().then(() => console.log('promise 1')).then(() => console.log('promise 2'))
queueMicrotask(() => console.log('queueMicrotask'))
console.log('script end')` },
  { name: 'async/await', code: `async function run() { console.log('A'); await null; console.log('B') }
console.log('start'); run(); Promise.resolve().then(() => console.log('then')); console.log('end')` },
  { name: 'nested timers + micro', code: `console.log('1')
setTimeout(() => { console.log('2'); Promise.resolve().then(() => console.log('3')) }, 0)
Promise.resolve().then(() => console.log('4'))
console.log('5')` },
  { name: 'fetch stub', code: `console.log('requesting')
fetch('/api').then(r => r.json()).then(d => console.log('got', d.stubbed))
console.log('sent')` },
]

let failures = 0
for (const ex of EXAMPLES) {
  const real = await runForReal(ex.code)
  const { events } = await instrumentAndRun(ex.code)
  const prog = traceToProgram(ex.code, events)
  const final = stateAt(prog, totalSteps(prog))
  const visualized = final.console.map((c) => c.value)

  const ok = JSON.stringify(visualized) === JSON.stringify(real)
  if (ok) {
    console.log(`✓ ${ex.name}: ${JSON.stringify(visualized)}`)
  } else {
    failures++
    console.error(`✗ ${ex.name} MISMATCH`)
    console.error(`   real (ground truth): ${JSON.stringify(real)}`)
    console.error(`   visualized         : ${JSON.stringify(visualized)}`)
  }
  // also assert the program fully drains
  if (final.callStack.length || final.taskQueue.length || final.microtaskQueue.length) {
    console.error(`   ⚠ not fully drained: stack=${final.callStack.length} macro=${final.taskQueue.length} micro=${final.microtaskQueue.length}`)
    failures++
  }
}
console.log(failures === 0 ? '\nPLAYGROUND PIPELINE OK ✅' : `\n${failures} FAILURE(S) ❌`)
process.exit(failures === 0 ? 0 : 1)
