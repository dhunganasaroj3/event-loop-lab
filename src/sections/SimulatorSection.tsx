import { useEffect, useState } from 'react'
import { PROGRAMS, programById } from '../engine/snippets'
import PlayerPanel from '../components/PlayerPanel'

export default function SimulatorSection({ initialId }: { initialId?: string }) {
  const [id, setId] = useState(initialId ?? PROGRAMS[1].id)
  const [revealed, setRevealed] = useState(false)

  // follow deep-links from the quiz ("replay in visualizer")
  useEffect(() => {
    if (initialId) {
      setId(initialId)
      setRevealed(false)
    }
  }, [initialId])

  const program = programById(id)

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="small muted">Program</label>
          <select
            value={id}
            onChange={(e) => { setId(e.target.value); setRevealed(false) }}
            style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            {PROGRAMS.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <span className="muted small">Predict the output, then step through to check yourself.</span>
        </div>
      </div>

      <PlayerPanel key={program.id} program={program} showLegend />

      <div className="card" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Expected console output</strong>
          <button onClick={() => setRevealed((r) => !r)}>{revealed ? 'Hide' : 'Reveal answer'}</button>
        </div>
        {revealed ? (
          <pre className="code-block mono" style={{ marginBottom: 0 }}>
            {program.expectedOutput.map((l) => `› ${l}`).join('\n')}
          </pre>
        ) : (
          <div className="muted small" style={{ marginTop: 8 }}>
            Hidden — try to predict it first, then reveal to compare with what you saw in the console.
          </div>
        )}
      </div>
    </div>
  )
}
