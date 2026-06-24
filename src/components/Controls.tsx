interface Props {
  index: number
  total: number
  playing: boolean
  speed: number
  onStep: () => void
  onBack: () => void
  onPlayToggle: () => void
  onReset: () => void
  onSpeed: (v: number) => void
}

export default function Controls({ index, total, playing, speed, onStep, onBack, onPlayToggle, onReset, onSpeed }: Props) {
  const done = index >= total
  return (
    <div className="controls">
      <button onClick={onReset} disabled={index === 0 && !playing}>⏮ Reset</button>
      <button onClick={onBack} disabled={index === 0}>◀ Back</button>
      <button className="btn-primary" onClick={onPlayToggle} disabled={done}>
        {playing ? '⏸ Pause' : '▶ Play'}
      </button>
      <button onClick={onStep} disabled={done}>Step ▶</button>
      <span className="tag">{index} / {total}</span>
      <span className="speed">
        Speed
        <input
          type="range"
          min={0.4}
          max={3}
          step={0.1}
          value={speed}
          onChange={(e) => onSpeed(Number(e.target.value))}
        />
        {speed.toFixed(1)}×
      </span>
    </div>
  )
}
