// ---------------------------------------------------------------------------
// The deterministic event-loop engine.
//
// It is a pure reducer: given a list of Instructions and an index, computing
// the EngineState at that index is just folding instructions[0..i]. This makes
// stepping forward/back trivial and keeps the UI a pure function of `index`.
// ---------------------------------------------------------------------------

import type { EngineState, Instruction, Program, Token } from './types'

let counter = 0
const uid = (p: string) => `${p}-${counter++}`

export function initialState(): EngineState {
  return {
    callStack: [],
    webApis: [],
    taskQueue: [],
    microtaskQueue: [],
    rafQueue: [],
    console: [],
    currentLine: null,
    phase: 'run-script',
    activeRegion: null,
    note: 'Top-level script starts running on the call stack.',
    done: false,
  }
}

/** Apply a single instruction to a state, returning the next state (immutable copy). */
export function apply(prev: EngineState, ins: Instruction): EngineState {
  // shallow clone arrays we may mutate
  const s: EngineState = {
    ...prev,
    callStack: [...prev.callStack],
    webApis: [...prev.webApis],
    taskQueue: [...prev.taskQueue],
    microtaskQueue: [...prev.microtaskQueue],
    rafQueue: [...prev.rafQueue],
    console: [...prev.console],
    activeRegion: null,
    note: prev.note,
  }
  if ('line' in ins && typeof ins.line === 'number') s.currentLine = ins.line
  if ('note' in ins && ins.note) s.note = ins.note

  switch (ins.op) {
    case 'push': {
      const t: Token = { id: uid('frame'), kind: 'frame', label: ins.label, sub: ins.sub }
      s.callStack.push(t)
      s.activeRegion = 'callStack'
      if (!ins.note) s.note = `Push “${ins.label}” onto the call stack.`
      break
    }
    case 'pop': {
      const popped = s.callStack.pop()
      s.activeRegion = 'callStack'
      if (!ins.note) s.note = popped ? `“${popped.label}” returns and is popped off the stack.` : 'Pop frame.'
      break
    }
    case 'log': {
      s.console.push({ id: uid('log'), value: ins.value })
      s.activeRegion = 'console'
      if (!ins.note) s.note = `console.log prints “${ins.value}”.`
      break
    }
    case 'webapi': {
      const t: Token = { id: ins.id, kind: 'webapi', label: ins.label, sub: ins.sub }
      s.webApis.push(t)
      s.activeRegion = 'webApis'
      if (!ins.note) s.note = `${ins.label} is handed to the Web APIs (it runs outside the JS thread).`
      break
    }
    case 'webapiToMacro': {
      s.webApis = s.webApis.filter((t) => t.id !== ins.id)
      const t: Token = { id: ins.id, kind: 'macrotask', label: ins.label, sub: ins.sub }
      s.taskQueue.push(t)
      s.activeRegion = 'taskQueue'
      if (!ins.note) s.note = `The Web API finished; its callback (${ins.label}) is queued as a macrotask.`
      break
    }
    case 'macrotask': {
      const t: Token = { id: ins.id, kind: 'macrotask', label: ins.label, sub: ins.sub }
      s.taskQueue.push(t)
      s.activeRegion = 'taskQueue'
      if (!ins.note) s.note = `${ins.label} is queued as a macrotask.`
      break
    }
    case 'microtask': {
      const t: Token = { id: ins.id, kind: 'microtask', label: ins.label, sub: ins.sub }
      s.microtaskQueue.push(t)
      s.activeRegion = 'microtaskQueue'
      if (!ins.note) s.note = `${ins.label} is queued as a microtask.`
      break
    }
    case 'raf': {
      const t: Token = { id: ins.id, kind: 'raf', label: ins.label, sub: ins.sub }
      s.rafQueue.push(t)
      s.activeRegion = 'rafQueue'
      if (!ins.note) s.note = `${ins.label} is registered for the next animation frame.`
      break
    }
    case 'endScript': {
      s.phase = 'drain-microtasks'
      s.activeRegion = 'microtaskQueue'
      if (!ins.note) s.note = 'Top-level script finished. The event loop reaches a microtask checkpoint.'
      break
    }
    case 'phase': {
      s.phase = ins.phase
      if (ins.phase === 'drain-microtasks') s.activeRegion = 'microtaskQueue'
      else if (ins.phase === 'render') s.activeRegion = 'rafQueue'
      else if (ins.phase === 'pick-macrotask') s.activeRegion = 'taskQueue'
      break
    }
    case 'runMacrotask': {
      s.taskQueue = s.taskQueue.filter((t) => t.id !== ins.id)
      s.phase = 'run-macrotask'
      s.activeRegion = 'callStack'
      if (!ins.note) s.note = 'Dequeue one macrotask and run it to completion.'
      break
    }
    case 'runMicrotask': {
      s.microtaskQueue = s.microtaskQueue.filter((t) => t.id !== ins.id)
      s.phase = 'drain-microtasks'
      s.activeRegion = 'callStack'
      if (!ins.note) s.note = 'Run one microtask. Keep going until the microtask queue is empty.'
      break
    }
    case 'runRaf': {
      s.rafQueue = s.rafQueue.filter((t) => t.id !== ins.id)
      s.phase = 'render'
      s.activeRegion = 'callStack'
      if (!ins.note) s.note = 'Run a requestAnimationFrame callback, just before paint.'
      break
    }
    case 'paint': {
      s.phase = 'render'
      s.activeRegion = null
      if (!ins.note) s.note = 'The browser paints the frame. The user sees the update now.'
      break
    }
    case 'note': {
      s.note = ins.note
      break
    }
  }
  return s
}

/** Fold instructions[0..index-1] onto the initial state. index 0 = nothing applied yet. */
export function stateAt(program: Program, index: number): EngineState {
  // reset the uid counter deterministically so ids are stable per render
  counter = 0
  let s = initialState()
  const n = Math.max(0, Math.min(index, program.instructions.length))
  for (let i = 0; i < n; i++) s = apply(s, program.instructions[i])
  if (n >= program.instructions.length) {
    s = { ...s, done: true, phase: 'idle', activeRegion: null }
    if (n > 0) s.note = 'Done. The call stack and all queues are empty — the loop idles.'
  }
  return s
}

export const totalSteps = (program: Program) => program.instructions.length
