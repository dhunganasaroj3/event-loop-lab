import { useCallback, useEffect, useRef, useState } from 'react'
import type { Program } from '../engine/types'
import { stateAt, totalSteps } from '../engine/eventLoopEngine'

/**
 * Drives stepping through a Program. State is derived purely from `index`,
 * so back/forward/reset are trivial and always consistent.
 */
export function usePlayer(program: Program) {
  const total = totalSteps(program)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1.2)
  const timer = useRef<number | null>(null)

  // reset when the program changes
  useEffect(() => {
    setIndex(0)
    setPlaying(false)
  }, [program.id])

  const step = useCallback(() => setIndex((i) => Math.min(i + 1, total)), [total])
  const back = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])
  const reset = useCallback(() => {
    setIndex(0)
    setPlaying(false)
  }, [])

  // auto-advance loop
  useEffect(() => {
    if (!playing) return
    if (index >= total) {
      setPlaying(false)
      return
    }
    const ms = 1100 / speed
    timer.current = window.setTimeout(() => setIndex((i) => Math.min(i + 1, total)), ms)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [playing, index, total, speed])

  const playToggle = useCallback(() => {
    if (index >= total) return
    setPlaying((p) => !p)
  }, [index, total])

  const state = stateAt(program, index)

  return { state, index, total, playing, speed, setSpeed, step, back, reset, playToggle }
}
