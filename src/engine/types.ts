// ---------------------------------------------------------------------------
// Types for the deterministic event-loop simulator.
//
// A "program" is authored as an ordered list of Instructions. The engine
// executes them one at a time, mutating an EngineState that the UI animates.
// Nothing here actually evaluates JavaScript — every animation is correct by
// construction because the author encodes the *real* semantics as steps.
// ---------------------------------------------------------------------------

export type Region =
  | 'callStack'
  | 'webApis'
  | 'taskQueue'      // macrotasks
  | 'microtaskQueue'
  | 'rafQueue'       // requestAnimationFrame callbacks
  | 'console'

export type TokenKind = 'frame' | 'webapi' | 'macrotask' | 'microtask' | 'raf' | 'log'

/** A single animated chip living in some region. */
export interface Token {
  id: string
  kind: TokenKind
  label: string
  sub?: string // small secondary text (e.g. "setTimeout 0ms")
}

/** The phase label shown in the banner — mirrors the WHATWG "event loop processing model". */
export type Phase =
  | 'run-script'          // the initial top-level script is executing
  | 'run-macrotask'       // a single macrotask is being run
  | 'drain-microtasks'    // microtask checkpoint: drain until empty
  | 'render'              // rendering opportunity (rAF + paint)
  | 'idle'                // nothing left to do / waiting for Web APIs
  | 'pick-macrotask'      // event loop about to dequeue the next macrotask

export interface EngineState {
  callStack: Token[]
  webApis: Token[]
  taskQueue: Token[]
  microtaskQueue: Token[]
  rafQueue: Token[]
  console: { id: string; value: string }[]
  currentLine: number | null // 1-based line in the program's source, or null
  phase: Phase
  /** Region the UI should visually highlight on this step (where the action is). */
  activeRegion: Region | null
  /** Short human narration of what just happened — drives the Learn play-by-play. */
  note: string
  done: boolean
}

// ---- Instructions ---------------------------------------------------------

export type Instruction =
  // call stack
  | { op: 'push'; label: string; sub?: string; line?: number; note?: string }
  | { op: 'pop'; note?: string; line?: number }
  // console
  | { op: 'log'; value: string; line?: number; note?: string }
  // schedule something into the Web APIs (timers, fetch, listeners)
  | { op: 'webapi'; id: string; label: string; sub?: string; line?: number; note?: string }
  // a Web API finishes and enqueues its callback into a queue
  | { op: 'webapiToMacro'; id: string; label: string; sub?: string; note?: string }
  // schedule a macrotask directly (e.g. a posted message)
  | { op: 'macrotask'; id: string; label: string; sub?: string; line?: number; note?: string }
  // schedule a microtask (Promise.then / queueMicrotask / await continuation)
  | { op: 'microtask'; id: string; label: string; sub?: string; line?: number; note?: string }
  // schedule a requestAnimationFrame callback
  | { op: 'raf'; id: string; label: string; sub?: string; line?: number; note?: string }
  // ---- control / event-loop machinery (author marks where these happen) ----
  | { op: 'endScript'; note?: string }              // top-level script finished
  | { op: 'phase'; phase: Phase; note?: string }     // set the phase banner
  | { op: 'runMacrotask'; id: string; note?: string }// dequeue a macrotask -> (its push/log/pop follow)
  | { op: 'runMicrotask'; id: string; note?: string }// dequeue one microtask -> (its steps follow)
  | { op: 'runRaf'; id: string; note?: string }      // dequeue a rAF callback -> (its steps follow)
  | { op: 'paint'; note?: string }                   // the browser paints a frame
  | { op: 'note'; note: string }                     // pure narration, no state change

export interface Program {
  id: string
  title: string
  blurb: string
  source: string[]          // source lines (1-based via index+1)
  instructions: Instruction[]
  /** The canonical real-world console output, for the "verify your prediction" panel. */
  expectedOutput: string[]
  /** Optional environment note, e.g. "Browser" vs "Node". */
  env?: 'browser' | 'node'
}
