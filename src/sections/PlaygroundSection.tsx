import { useState } from 'react'
import { runTrace } from '../playground/tracer'
import { traceToProgram } from '../playground/traceToProgram'
import type { Program } from '../engine/types'
import PlayerPanel from '../components/PlayerPanel'

const STARTER = `console.log('script start')

setTimeout(() => {
  console.log('timeout')
}, 0)

Promise.resolve()
  .then(() => console.log('promise 1'))
  .then(() => console.log('promise 2'))

queueMicrotask(() => console.log('queueMicrotask'))

console.log('script end')`

const EXAMPLES: { label: string; code: string }[] = [
  { label: 'Classic race', code: STARTER },
  {
    label: 'async / await',
    code: `async function run() {
  console.log('A')
  await null
  console.log('B')
}
console.log('start')
run()
Promise.resolve().then(() => console.log('then'))
console.log('end')`,
  },
  {
    label: 'fetch (stubbed)',
    code: `console.log('requesting')
fetch('/api')
  .then(r => r.json())
  .then(data => console.log('got', data.stubbed))
console.log('sent')`,
  },
  {
    label: 'nested timers + micro',
    code: `console.log('1')
setTimeout(() => {
  console.log('2')
  Promise.resolve().then(() => console.log('3'))
}, 0)
Promise.resolve().then(() => console.log('4'))
console.log('5')`,
  },
]

export default function PlaygroundSection() {
  const [code, setCode] = useState(STARTER)
  const [program, setProgram] = useState<Program | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [realOutput, setRealOutput] = useState<string[] | null>(null)

  async function run() {
    setRunning(true)
    setError(null)
    setProgram(null)
    try {
      const trace = await runTrace(code)
      if (trace.error && trace.events.length === 0) {
        setError(trace.error)
      } else {
        const prog = traceToProgram(code, trace.events, trace.truncated)
        setProgram(prog)
        setRealOutput(trace.consoleOutput)
        if (trace.error) setError(`Your code threw: ${trace.error} (trace shown up to the error).`)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <strong>Paste JavaScript and watch the event loop process it</strong>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {EXAMPLES.map((ex) => (
              <button key={ex.label} className="small" onClick={() => { setCode(ex.code); setProgram(null); setError(null) }}>
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          className="mono"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          style={{
            width: '100%',
            minHeight: 220,
            marginTop: 12,
            background: '#0a0e1c',
            color: '#cdd6f4',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 12,
            fontSize: 13.5,
            lineHeight: 1.6,
            resize: 'vertical',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={run} disabled={running}>
            {running ? 'Running…' : '▶ Run & visualize'}
          </button>
          <span className="muted small">
            Runs in a sandboxed iframe (no network, no access to your page). <code>fetch</code> is stubbed; timers, Promises,
            <code> queueMicrotask</code> and <code>requestAnimationFrame</code> are traced. Loops are capped for safety.
          </span>
        </div>

        {error && (
          <div className="callout warn" style={{ marginTop: 12 }}>{error}</div>
        )}
      </div>

      {program ? (
        <>
          <PlayerPanel key={program.instructions.length + ':' + code.length} program={program} showLegend />
          {realOutput && (
            <div className="card" style={{ marginTop: 16 }}>
              <strong>Real console output (from the sandboxed run)</strong>
              <pre className="code-block mono" style={{ marginBottom: 0 }}>
                {realOutput.length ? realOutput.map((l) => `› ${l}`).join('\n') : '// (no console output)'}
              </pre>
              <div className="muted small">
                The animation above is reconstructed from this exact run, so the order you see in the visualizer matches what your code really did.
              </div>
            </div>
          )}
        </>
      ) : (
        !running && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
            Press <strong>Run &amp; visualize</strong> to trace your code, then use Play / Step to walk through every task and microtask.
          </div>
        )
      )}
    </div>
  )
}
