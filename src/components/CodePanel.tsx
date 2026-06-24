interface Props {
  source: string[]
  activeLine: number | null // 1-based
}

export default function CodePanel({ source, activeLine }: Props) {
  return (
    <div className="code-panel mono">
      {source.map((line, i) => {
        const ln = i + 1
        const active = ln === activeLine
        return (
          <div key={ln} className={`code-line${active ? ' active' : ''}`}>
            <span className="ln">{ln}</span>
            <span className="src">{line === '' ? ' ' : line}</span>
          </div>
        )
      })}
    </div>
  )
}
