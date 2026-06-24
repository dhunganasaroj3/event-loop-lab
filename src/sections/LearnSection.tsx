import { useState } from 'react'
import { LESSONS } from '../content/lessons'
import type { Block } from '../content/lessons'
import { programById } from '../engine/snippets'
import PlayerPanel from '../components/PlayerPanel'

function renderBlock(b: Block, i: number) {
  switch (b.t) {
    case 'p':
      return <p key={i}>{b.text}</p>
    case 'ul':
      return (
        <ul key={i}>
          {b.items.map((it, j) => <li key={j}>{it}</li>)}
        </ul>
      )
    case 'callout':
      return <div key={i} className={`callout${b.kind ? ' ' + b.kind : ''}`}>{b.text}</div>
    case 'code':
      return <pre key={i} className="code-block mono">{b.code}</pre>
  }
}

export default function LearnSection() {
  const [idx, setIdx] = useState(0)
  const lesson = LESSONS[idx]
  const program = programById(lesson.programId)

  return (
    <div>
      <div className="lesson-list">
        {LESSONS.map((l, i) => (
          <button key={l.id} className={i === idx ? 'active' : ''} onClick={() => setIdx(i)}>
            {l.nav}
          </button>
        ))}
      </div>

      <div className="card lesson-body" style={{ marginBottom: 18 }}>
        <h2>{lesson.title}</h2>
        {lesson.body.map(renderBlock)}
      </div>

      <div className="muted small" style={{ margin: '4px 2px 10px' }}>
        ↓ Animated demo for this lesson — press <strong>Play</strong> or <strong>Step</strong> to watch it run.
      </div>
      <PlayerPanel key={program.id} program={program} showLegend />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22 }}>
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>← Previous lesson</button>
        <button className="btn-primary" onClick={() => setIdx((i) => Math.min(LESSONS.length - 1, i + 1))} disabled={idx === LESSONS.length - 1}>
          Next lesson →
        </button>
      </div>
    </div>
  )
}
