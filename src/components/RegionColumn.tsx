import { AnimatePresence } from 'framer-motion'
import type { Token as TokenT } from '../engine/types'
import Token from './Token'

interface Props {
  title: string
  subtitle: string
  color: string
  tokens: TokenT[]
  highlight?: boolean
  /** stack = newest visually on top (LIFO); queue = oldest on top (FIFO). */
  variant: 'stack' | 'queue'
  emptyHint?: string
}

export default function RegionColumn({ title, subtitle, color, tokens, highlight, variant, emptyHint }: Props) {
  // For a stack we render bottom-up so the most recent frame sits at the top.
  const ordered = variant === 'stack' ? [...tokens] : tokens
  return (
    <div className={`region${highlight ? ' highlight' : ''}`}>
      <div className="region-head">
        <span className="region-title">
          <span className="dot" style={{ background: color }} />
          {title}
        </span>
        <span className="tag">{tokens.length}</span>
      </div>
      <div className="region-sub">{subtitle}</div>
      <div className={`tokens ${variant}`}>
        <AnimatePresence mode="popLayout">
          {ordered.map((t) => (
            <Token key={t.id} token={t} />
          ))}
        </AnimatePresence>
        {tokens.length === 0 && emptyHint && (
          <div className="muted small" style={{ opacity: 0.5, padding: '6px 2px' }}>{emptyHint}</div>
        )}
      </div>
    </div>
  )
}
