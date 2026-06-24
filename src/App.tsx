import { useState } from 'react'
import LearnSection from './sections/LearnSection'
import SimulatorSection from './sections/SimulatorSection'
import QuizSection from './sections/QuizSection'
import PlaygroundSection from './sections/PlaygroundSection'

type Tab = 'learn' | 'simulator' | 'playground' | 'quiz'

const TABS: { id: Tab; label: string }[] = [
  { id: 'learn', label: '📖 Learn' },
  { id: 'simulator', label: '🧪 Simulator' },
  { id: 'playground', label: '⌨️ Playground' },
  { id: 'quiz', label: '🧠 Quiz' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('learn')
  // when the quiz asks to replay a snippet, jump to the simulator with that program
  const [replayId, setReplayId] = useState<string | undefined>(undefined)

  function handleReplay(programId: string) {
    setReplayId(programId)
    setTab('simulator')
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Event Loop Lab</h1>
        <p>An animated, interactive deep-dive into the JavaScript event loop — call stack, Web APIs, macrotasks, microtasks, rendering, and the exact ordering rules.</p>
      </header>

      <nav className="nav">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'learn' && <LearnSection />}
      {tab === 'simulator' && <SimulatorSection initialId={replayId} />}
      {tab === 'playground' && <PlaygroundSection />}
      {tab === 'quiz' && <QuizSection onReplay={handleReplay} />}

      <footer className="muted small" style={{ textAlign: 'center', marginTop: 48 }}>
        One sentence to remember it all: <strong>run a task → empty the microtask queue → maybe render → repeat.</strong>
      </footer>
    </div>
  )
}
