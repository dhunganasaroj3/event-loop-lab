import { AnimatePresence, motion } from 'framer-motion'
import type { EngineState, Phase } from '../engine/types'
import RegionColumn from './RegionColumn'

const PHASE_LABEL: Record<Phase, string> = {
  'run-script': '▶ Running top-level script',
  'run-macrotask': '▶ Running a macrotask',
  'drain-microtasks': '♺ Draining microtask queue (until empty!)',
  render: '🎨 Rendering (rAF → paint)',
  idle: '… Idle — waiting on Web APIs',
  'pick-macrotask': '⇣ Picking next macrotask',
}

export default function VisualizerStage({ state }: { state: EngineState }) {
  return (
    <div>
      <div style={{ textAlign: 'center' }}>
        <span className="phase-banner">{PHASE_LABEL[state.phase]}</span>
      </div>

      <div className="stage">
        <RegionColumn
          title="Call Stack"
          subtitle="LIFO · the one thing JS runs at a time"
          color="var(--c-stack)"
          tokens={state.callStack}
          variant="stack"
          highlight={state.activeRegion === 'callStack'}
          emptyHint="empty — JS thread is free"
        />
        <RegionColumn
          title="Web APIs"
          subtitle="timers, fetch, DOM events (off-thread)"
          color="var(--c-webapi)"
          tokens={state.webApis}
          variant="queue"
          highlight={state.activeRegion === 'webApis'}
          emptyHint="nothing pending"
        />
        <RegionColumn
          title="Console"
          subtitle="output, in real execution order"
          color="var(--c-log)"
          tokens={[]}
          variant="queue"
          highlight={state.activeRegion === 'console'}
        />

        {/* second row */}
        <RegionColumn
          title="Macrotask Queue"
          subtitle="setTimeout, I/O, message, events · FIFO"
          color="var(--c-macro)"
          tokens={state.taskQueue}
          variant="queue"
          highlight={state.activeRegion === 'taskQueue'}
          emptyHint="empty"
        />
        <RegionColumn
          title="Microtask Queue"
          subtitle="Promises, await, queueMicrotask · drains fully"
          color="var(--c-micro)"
          tokens={state.microtaskQueue}
          variant="queue"
          highlight={state.activeRegion === 'microtaskQueue'}
          emptyHint="empty"
        />
        <RegionColumn
          title="Animation Frames (rAF)"
          subtitle="run right before paint"
          color="var(--c-raf)"
          tokens={state.rafQueue}
          variant="queue"
          highlight={state.activeRegion === 'rafQueue'}
          emptyHint="empty"
        />
      </div>

      {/* Console output panel (separate so it scrolls & keeps history) */}
      <div className="card" style={{ marginTop: 16, padding: 14 }}>
        <div className="region-title" style={{ marginBottom: 8 }}>
          <span className="dot" style={{ background: 'var(--c-log)' }} /> Console output
        </div>
        <div className="console-box mono">
          <AnimatePresence initial={false}>
            {state.console.length === 0 && <div className="muted small">// nothing logged yet</div>}
            {state.console.map((l) => (
              <motion.div
                key={l.id}
                className="console-line"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <span className="gt">›</span>
                <span className="val">{l.value}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Narration of the current step */}
      <motion.div
        key={state.note}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="callout"
        style={{ marginTop: 14 }}
      >
        {state.note}
      </motion.div>
    </div>
  )
}
