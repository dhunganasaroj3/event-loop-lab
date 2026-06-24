import { motion } from 'framer-motion'
import type { Token as TokenT, TokenKind } from '../engine/types'

const COLORS: Record<TokenKind, string> = {
  frame: 'var(--c-stack)',
  webapi: 'var(--c-webapi)',
  macrotask: 'var(--c-macro)',
  microtask: 'var(--c-micro)',
  raf: 'var(--c-raf)',
  log: 'var(--c-log)',
}

export default function Token({ token }: { token: TokenT }) {
  return (
    <motion.div
      layout
      // animate by the stable token id so framer matches chips across regions
      layoutId={token.id}
      initial={{ opacity: 0, scale: 0.7, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.7, y: -8 }}
      transition={{ type: 'spring', stiffness: 480, damping: 32 }}
      className="token"
      style={{ background: COLORS[token.kind] }}
    >
      <span>{token.label}</span>
      {token.sub && <span className="sub">{token.sub}</span>}
    </motion.div>
  )
}
