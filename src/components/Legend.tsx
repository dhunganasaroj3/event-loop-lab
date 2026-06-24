const ITEMS = [
  { c: 'var(--c-stack)', label: 'Call stack frame' },
  { c: 'var(--c-webapi)', label: 'Web API (off-thread)' },
  { c: 'var(--c-macro)', label: 'Macrotask' },
  { c: 'var(--c-micro)', label: 'Microtask' },
  { c: 'var(--c-raf)', label: 'rAF callback' },
  { c: 'var(--c-log)', label: 'Console line' },
]

export default function Legend() {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', margin: '4px 0 16px' }}>
      {ITEMS.map((it) => (
        <span key={it.label} className="small" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
          <span className="dot" style={{ background: it.c }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}
