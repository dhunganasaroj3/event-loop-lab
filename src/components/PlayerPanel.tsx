import type { Program } from '../engine/types'
import { usePlayer } from './usePlayer'
import VisualizerStage from './VisualizerStage'
import CodePanel from './CodePanel'
import Controls from './Controls'
import Legend from './Legend'

/**
 * Self-contained player: code on the left, animated stage on the right,
 * controls + legend below. Reused by Learn, Visualizer and Simulator.
 * `key={program.id}` at the call site forces a clean reset on program change.
 */
export default function PlayerPanel({ program, showLegend = true }: { program: Program; showLegend?: boolean }) {
  const p = usePlayer(program)

  return (
    <div>
      {showLegend && <Legend />}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="region-title" style={{ marginBottom: 10 }}>
            {program.title} {program.env === 'node' && <span className="tag" style={{ marginLeft: 8 }}>Node.js</span>}
          </div>
          <CodePanel source={program.source} activeLine={p.state.currentLine} />
          <div className="small muted" style={{ marginTop: 10 }}>{program.blurb}</div>
        </div>
        <div className="card">
          <VisualizerStage state={p.state} />
        </div>
      </div>

      <Controls
        index={p.index}
        total={p.total}
        playing={p.playing}
        speed={p.speed}
        onStep={p.step}
        onBack={p.back}
        onPlayToggle={p.playToggle}
        onReset={p.reset}
        onSpeed={p.setSpeed}
      />
    </div>
  )
}
