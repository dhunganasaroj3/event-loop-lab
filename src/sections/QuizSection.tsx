import { useState } from 'react'
import { QUIZ } from '../content/quiz'

export default function QuizSection({ onReplay }: { onReplay: (programId: string) => void }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState<boolean[]>(() => QUIZ.map(() => false))
  const [finished, setFinished] = useState(false)

  const q = QUIZ[i]

  function choose(idx: number) {
    if (picked !== null) return
    setPicked(idx)
    if (idx === q.answer && !answered[i]) {
      setScore((s) => s + 1)
    }
    setAnswered((a) => {
      const n = [...a]
      n[i] = true
      return n
    })
  }

  function next() {
    if (i + 1 >= QUIZ.length) {
      setFinished(true)
      return
    }
    setI(i + 1)
    setPicked(null)
  }

  function restart() {
    setI(0); setPicked(null); setScore(0); setAnswered(QUIZ.map(() => false)); setFinished(false)
  }

  if (finished) {
    const pct = Math.round((score / QUIZ.length) * 100)
    const verdict =
      pct === 100 ? 'Flawless. You understand the event loop down to the bits. 🎉'
      : pct >= 80 ? 'Excellent — you’ve got a solid mental model.'
      : pct >= 60 ? 'Good start. Revisit the lessons you missed and replay their demos.'
      : 'Worth another pass through the Learn section — then come back.'
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <h2>Quiz complete</h2>
        <div className="score-big">{score} / {QUIZ.length}</div>
        <div className="tag" style={{ fontSize: 16, padding: '6px 14px' }}>{pct}%</div>
        <p className="muted" style={{ marginTop: 16 }}>{verdict}</p>
        <button className="btn-primary" onClick={restart}>Retake quiz</button>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="quiz-progress">
        <span>Question {i + 1} of {QUIZ.length}</span>
        <span>Score: {score}</span>
      </div>

      <div className="quiz-q">{q.prompt}</div>
      {q.code && <pre className="code-block mono">{q.code}</pre>}

      <div className="quiz-options">
        {q.options.map((opt, idx) => {
          const isAnswer = idx === q.answer
          const isPicked = idx === picked
          let cls = 'quiz-opt'
          if (picked !== null) {
            if (isAnswer) cls += ' correct'
            else if (isPicked) cls += ' wrong'
          }
          if (isPicked && picked !== null) cls += ' picked'
          return (
            <button key={idx} className={cls} onClick={() => choose(idx)} disabled={picked !== null}>
              {opt}
            </button>
          )
        })}
      </div>

      {picked !== null && (
        <div className="explain">
          <h4>{picked === q.answer ? '✅ Correct' : '❌ Not quite'}</h4>
          <p style={{ margin: '0 0 10px' }}>{q.explanation}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {q.replayId && (
              <button onClick={() => onReplay(q.replayId!)}>▶ Replay this in the visualizer</button>
            )}
            <button className="btn-primary" onClick={next}>
              {i + 1 >= QUIZ.length ? 'See results' : 'Next question →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
