// ---------------------------------------------------------------------------
// Convert a recorded TraceEvent[] (from the sandbox) into a Program whose
// Instruction[] the existing engine/visualizer can animate.
//
// The trace is already in TRUE execution order, so the job is mostly mapping:
//   - log                -> push <task>/log/pop-ish; we model logs as 'log'
//   - schedule(macro)    -> webapi + webapiToMacro (it's pending then queued)
//   - schedule(micro)    -> microtask
//   - schedule(raf)      -> raf
//   - enter/exit(macro)  -> runMacrotask + push + (logs) + pop
//   - enter/exit(micro)  -> runMicrotask + push + (logs) + pop
//   - enter/exit(raf)    -> runRaf + push + (logs) + pop
//   - scriptEnd          -> pop top-level <script> + endScript
//
// We insert microtask-checkpoint / pick-macrotask phase markers at the right
// boundaries so the phase banner reads correctly.
// ---------------------------------------------------------------------------

import type { Instruction, Program } from '../engine/types'
import type { TraceEvent } from './tracer'

export function traceToProgram(code: string, events: TraceEvent[], truncated?: string): Program {
  const ins: Instruction[] = []
  const source = code.replace(/\t/g, '  ').split('\n')

  // track which scheduled ids are still "queued" so enter can dequeue them
  const queuedMacro = new Set<number>()
  const queuedMicro = new Set<number>()
  const queuedRaf = new Set<number>()

  // are we currently inside the top-level script (vs inside a callback)?
  let inScript = true
  // depth of currently-running callback (to know when a turn ends)
  let runningDepth = 0
  let lastTurnQueue: 'macro' | 'micro' | 'raf' | null = null

  ins.push({ op: 'push', label: '<script>', sub: 'top-level', note: 'Your pasted code starts running on the call stack.' })

  const flushCheckpointBefore = (queue: 'macro' | 'micro' | 'raf') => {
    // entering a macro/raf turn means the prior microtask drain is done
    if (queue === 'macro') {
      ins.push({ op: 'phase', phase: 'pick-macrotask', note: 'Microtask queue empty — dequeue the next macrotask.' })
    } else if (queue === 'raf') {
      ins.push({ op: 'phase', phase: 'render', note: 'Rendering step: run requestAnimationFrame callbacks before paint.' })
    }
  }

  for (const ev of events) {
    switch (ev.kind) {
      case 'log': {
        ins.push({ op: 'log', value: ev.value })
        break
      }
      case 'webapi': {
        // fetch & friends: shown going to the Web APIs, then resolving. The
        // actual .then reaction shows up later as its own microtask schedule.
        const apiId = `pg-webapi-${ev.id}`
        ins.push({ op: 'webapi', id: apiId, label: ev.label, sub: ev.sub, note: `${ev.label} runs off-thread in the Web APIs; it returns a pending Promise immediately.` })
        break
      }
      case 'schedule': {
        if (ev.queue === 'macro') {
          // model as Web API work that then queues a macrotask
          const apiId = `pg-api-${ev.id}`
          ins.push({ op: 'webapi', id: apiId, label: ev.label, sub: ev.sub, note: `${ev.label} is handed to the Web APIs (off the JS thread).` })
          ins.push({ op: 'webapiToMacro', id: `pg-macro-${ev.id}`, label: ev.label, sub: ev.sub, note: 'Its callback is queued as a macrotask.' })
          queuedMacro.add(ev.id)
        } else if (ev.queue === 'micro') {
          ins.push({ op: 'microtask', id: `pg-micro-${ev.id}`, label: ev.label, sub: ev.sub })
          queuedMicro.add(ev.id)
        } else {
          ins.push({ op: 'raf', id: `pg-raf-${ev.id}`, label: ev.label, sub: ev.sub })
          queuedRaf.add(ev.id)
        }
        break
      }
      case 'enter': {
        // the first time we run any callback, the top-level script has ended;
        // ensure we've closed it out (handled at scriptEnd, but guard anyway).
        if (runningDepth === 0) {
          // boundary between turns
          if (ev.queue !== lastTurnQueue || ev.queue !== 'micro') {
            flushCheckpointBefore(ev.queue)
          }
          if (ev.queue === 'macro') {
            ins.push({ op: 'runMacrotask', id: `pg-macro-${ev.id}`, note: 'Dequeue and run this macrotask to completion.' })
            queuedMacro.delete(ev.id)
          } else if (ev.queue === 'raf') {
            ins.push({ op: 'runRaf', id: `pg-raf-${ev.id}`, note: 'Run the animation-frame callback.' })
            queuedRaf.delete(ev.id)
          } else {
            ins.push({ op: 'phase', phase: 'drain-microtasks', note: 'Microtask checkpoint: drain the microtask queue.' })
            ins.push({ op: 'runMicrotask', id: `pg-micro-${ev.id}`, note: 'Run one microtask.' })
            queuedMicro.delete(ev.id)
          }
          lastTurnQueue = ev.queue
        }
        ins.push({ op: 'push', label: ev.label, sub: 'callback' })
        runningDepth++
        break
      }
      case 'exit': {
        // after a macrotask/raf finishes, the microtask checkpoint that follows
        // is emitted lazily on the next micro 'enter'; nothing to do here.
        ins.push({ op: 'pop' })
        runningDepth = Math.max(0, runningDepth - 1)
        break
      }
      case 'scriptEnd': {
        if (inScript) {
          ins.push({ op: 'pop', note: 'Top-level script finished; the stack is empty.' })
          ins.push({ op: 'endScript' })
          inScript = false
        }
        break
      }
      case 'error': {
        ins.push({ op: 'note', note: `⚠ Runtime error: ${ev.message}` })
        break
      }
      case 'truncated': {
        ins.push({ op: 'note', note: `⚠ Trace stopped: ${ev.reason}` })
        break
      }
    }
  }

  // if the code was purely synchronous, scriptEnd handled the pop; if not,
  // make sure we close the script frame exactly once.
  if (inScript) {
    ins.push({ op: 'pop', note: 'Top-level script finished.' })
    ins.push({ op: 'endScript' })
  }

  const consoleOutput = events.filter((e): e is Extract<TraceEvent, { kind: 'log' }> => e.kind === 'log').map((e) => e.value)

  return {
    id: 'playground',
    title: 'Your code',
    blurb: truncated
      ? `⚠ ${truncated}. Showing the trace up to that point.`
      : 'Live trace of your pasted code, reconstructed from a real sandboxed run.',
    source,
    instructions: ins,
    expectedOutput: consoleOutput,
    env: 'browser',
  }
}
