// ---------------------------------------------------------------------------
// Playground tracer.
//
// Runs the user's pasted code inside a sandboxed <iframe>, with the async-
// scheduling globals (console, setTimeout, queueMicrotask, Promise reactions,
// requestAnimationFrame, fetch) instrumented. Each instrumented call records a
// TraceEvent in true execution order. We then reconstruct the event-loop
// animation from that trace (see traceToProgram.ts).
//
// Safety: the iframe is sandboxed ("allow-scripts" only — no same-origin, no
// network, no navigation). We additionally cap the number of recorded events
// and scheduled callbacks, stub fetch to resolve instantly, and bail out of
// runaway microtask loops so a pasted infinite loop can't hang the page.
// ---------------------------------------------------------------------------

export type TraceEvent =
  | { kind: 'log'; seq: number; value: string }
  | { kind: 'schedule'; seq: number; queue: 'macro' | 'micro' | 'raf'; id: number; label: string; sub?: string }
  | { kind: 'enter'; seq: number; queue: 'macro' | 'micro' | 'raf'; id: number; label: string }
  | { kind: 'exit'; seq: number; id: number }
  // fetch: a Web API that resolves a Promise without queuing a runnable cb of its own
  | { kind: 'webapi'; seq: number; id: number; label: string; sub?: string }
  | { kind: 'scriptEnd'; seq: number }
  | { kind: 'error'; seq: number; message: string }
  | { kind: 'truncated'; seq: number; reason: string }

export interface TraceResult {
  events: TraceEvent[]
  consoleOutput: string[]
  error?: string
  truncated?: string
}

const MAX_EVENTS = 600
const MAX_CALLBACKS = 250
const RUN_TIMEOUT_MS = 4000

/**
 * The instrumentation source. It runs *inside* the iframe. We inject it as a
 * string so it closes over the iframe's own globals. It posts the trace back
 * to the parent via postMessage when the run settles.
 */
function buildHarness(userCode: string): string {
  // NOTE: user code is embedded via JSON.stringify and eval'd inside the
  // sandbox. The sandbox has no same-origin access and no network, so this is
  // contained — it cannot touch the parent page or the user's data.
  return `
(function () {
  var seq = 0;
  var cbId = 0;
  var events = [];
  var consoleOut = [];
  var stopped = false;
  var pending = 0;          // outstanding macro/raf callbacks we still expect
  var scheduleCount = 0;

  function rec(e) {
    if (stopped) return;
    e.seq = seq++;
    events.push(e);
    if (events.length > ${MAX_EVENTS}) {
      events.push({ kind: 'truncated', seq: seq++, reason: 'too many event-loop steps (capped at ${MAX_EVENTS})' });
      finish();
    }
  }

  function guardSchedule() {
    if (++scheduleCount > ${MAX_CALLBACKS}) {
      if (!stopped) {
        events.push({ kind: 'truncated', seq: seq++, reason: 'too many scheduled callbacks (capped at ${MAX_CALLBACKS}) — likely an unbounded async loop' });
        finish();
      }
      return false;
    }
    return true;
  }

  // ---- console ----
  var realLog = console.log.bind(console);
  function fmt(args) {
    return Array.prototype.map.call(args, function (a) {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch (e) { return String(a); }
    }).join(' ');
  }
  console.log = function () {
    var v = fmt(arguments);
    consoleOut.push(v);
    rec({ kind: 'log', value: v });
  };
  console.info = console.warn = console.error = console.log;

  // wrap a user callback so it emits enter/exit around its synchronous run
  function wrap(queue, id, label, fn) {
    return function () {
      if (stopped) return;
      rec({ kind: 'enter', queue: queue, id: id, label: label });
      try {
        return fn.apply(this, arguments);
      } catch (err) {
        rec({ kind: 'error', message: String(err && err.message || err) });
      } finally {
        rec({ kind: 'exit', id: id });
        if (queue === 'macro' || queue === 'raf') {
          pending--;
          maybeFinish();
        }
      }
    };
  }

  // ---- setTimeout / setInterval(stub once) ----
  var _setTimeout = window.setTimeout.bind(window);
  window.setTimeout = function (fn, delay) {
    if (typeof fn !== 'function' || !guardSchedule()) return 0;
    var id = ++cbId;
    var label = 'setTimeout(' + (delay || 0) + 'ms)';
    rec({ kind: 'schedule', queue: 'macro', id: id, label: label, sub: 'macrotask' });
    pending++;
    return _setTimeout(wrap('macro', id, label, fn), delay || 0);
  };
  // setInterval -> treat as a single macrotask to keep the trace finite
  window.setInterval = function (fn) {
    if (typeof fn !== 'function' || !guardSchedule()) return 0;
    var id = ++cbId;
    var label = 'setInterval (1st tick)';
    rec({ kind: 'schedule', queue: 'macro', id: id, label: label, sub: 'macrotask' });
    pending++;
    return _setTimeout(wrap('macro', id, label, fn), 0);
  };
  window.clearTimeout = function () {};
  window.clearInterval = function () {};

  // ---- queueMicrotask ----
  var _qmt = window.queueMicrotask ? window.queueMicrotask.bind(window) : function (f) { Promise.resolve().then(f); };
  window.queueMicrotask = function (fn) {
    if (typeof fn !== 'function' || !guardSchedule()) return;
    var id = ++cbId;
    rec({ kind: 'schedule', queue: 'micro', id: id, label: 'queueMicrotask', sub: 'microtask' });
    _qmt(wrap('micro', id, 'queueMicrotask', fn));
  };

  // ---- requestAnimationFrame ----
  window.requestAnimationFrame = function (fn) {
    if (typeof fn !== 'function' || !guardSchedule()) return 0;
    var id = ++cbId;
    rec({ kind: 'schedule', queue: 'raf', id: id, label: 'requestAnimationFrame', sub: 'before paint' });
    pending++;
    // drive rAF off a macrotask so the trace is deterministic in the sandbox
    return _setTimeout(wrap('raf', id, 'requestAnimationFrame', fn), 0);
  };

  // ---- Promise reactions (.then) ----
  var P = window.Promise;
  var _then = P.prototype.then;
  P.prototype.then = function (onF, onR) {
    var self = this;
    function tag(handler, kind) {
      if (typeof handler !== 'function') return handler;
      if (!guardSchedule()) return handler;
      var id = ++cbId;
      var scheduled = false;
      return function (val) {
        // schedule event is recorded the moment the reaction is about to run,
        // which in microtask terms is when it's enqueued.
        if (!scheduled) { scheduled = true; }
        rec({ kind: 'schedule', queue: 'micro', id: id, label: '.then(' + kind + ')', sub: 'microtask' });
        rec({ kind: 'enter', queue: 'micro', id: id, label: '.then(' + kind + ')' });
        try {
          return handler(val);
        } catch (err) {
          rec({ kind: 'error', message: String(err && err.message || err) });
          throw err;
        } finally {
          rec({ kind: 'exit', id: id });
        }
      };
    }
    return _then.call(self, tag(onF, 'fulfilled'), tag(onR, 'rejected'));
  };

  // ---- fetch stub (no network in sandbox) -> resolves instantly ----
  window.fetch = function (url) {
    if (!guardSchedule()) return P.reject(new Error('too many calls'));
    rec({ kind: 'webapi', id: ++cbId, label: 'fetch ' + (url || ''), sub: 'network (stubbed)' });
    return P.resolve({
      ok: true, status: 200,
      json: function () { return P.resolve({ stubbed: true, url: String(url) }); },
      text: function () { return P.resolve('stubbed response'); },
    });
  };

  // Settle detection by QUIESCENCE: we finish only once a full macrotask turn
  // passes during which (a) no macro/raf callbacks are pending AND (b) no new
  // events were recorded. This lets Promise/microtask chains (e.g. fetch().then
  // ().then()) fully drain before we snapshot the trace.
  var settleScheduled = false;
  function maybeFinish() {
    if (finished || settleScheduled) return;
    settleScheduled = true;
    var snapshot = events.length;
    // a macrotask turn flushes all pending microtasks + 0ms timers first
    _setTimeout(function () {
      settleScheduled = false;
      if (finished) return;
      if (pending <= 0 && events.length === snapshot) {
        finish();           // quiet for a whole turn -> done
      } else {
        maybeFinish();      // activity continued -> check again next turn
      }
    }, 0);
  }

  var finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    stopped = true;
    parent.postMessage({ __elp: true, events: events, consoleOut: consoleOut }, '*');
  }

  // hard timeout guard
  _setTimeout(function () {
    if (!finished) {
      events.push({ kind: 'truncated', seq: seq++, reason: 'execution timed out (${RUN_TIMEOUT_MS}ms)' });
      finish();
    }
  }, ${RUN_TIMEOUT_MS});

  // ---- run the user's top-level script ----
  try {
    (0, eval)(${JSON.stringify(userCode)});
  } catch (err) {
    rec({ kind: 'error', message: String(err && err.message || err) });
  }
  rec({ kind: 'scriptEnd' });

  // if nothing async is pending, settle now (after a microtask flush)
  maybeFinish();
})();
`
}

/** Run user code in a sandbox and resolve with the recorded trace. */
export function runTrace(userCode: string): Promise<TraceResult> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    // sandbox WITHOUT allow-same-origin: scripts run but are fully isolated.
    iframe.setAttribute('sandbox', 'allow-scripts')
    iframe.style.display = 'none'
    let settled = false

    const cleanup = () => {
      window.removeEventListener('message', onMsg)
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }

    const onMsg = (e: MessageEvent) => {
      if (!e.data || !e.data.__elp || e.source !== iframe.contentWindow) return
      if (settled) return
      settled = true
      const events: TraceEvent[] = e.data.events
      const truncated = events.find((ev) => ev.kind === 'truncated') as Extract<TraceEvent, { kind: 'truncated' }> | undefined
      const errEv = events.find((ev) => ev.kind === 'error') as Extract<TraceEvent, { kind: 'error' }> | undefined
      cleanup()
      resolve({
        events,
        consoleOutput: e.data.consoleOut as string[],
        error: errEv?.message,
        truncated: truncated?.reason,
      })
    }

    window.addEventListener('message', onMsg)

    // outer wall-clock guard in case the iframe never reports back
    window.setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      resolve({ events: [], consoleOutput: [], error: 'The sandbox did not respond (possible infinite synchronous loop).' })
    }, RUN_TIMEOUT_MS + 1500)

    const harness = buildHarness(userCode)
    // srcdoc so the iframe has its own document; the script self-runs.
    iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${harness}<\/script></body></html>`
    document.body.appendChild(iframe)
  })
}
