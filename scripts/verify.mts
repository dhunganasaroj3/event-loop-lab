// Headless correctness check: fold each program through the real engine and
// confirm the simulated console output equals the declared expectedOutput.
// Run with: npx tsx scripts/verify.mts  (or via esbuild loader)
import { PROGRAMS } from '../src/engine/snippets'
import { stateAt, totalSteps } from '../src/engine/eventLoopEngine'

let failures = 0
for (const p of PROGRAMS) {
  const final = stateAt(p, totalSteps(p))
  const got = final.console.map((c) => c.value)
  // starvation is intentionally a "never finishes" demo — its expectedOutput is a note.
  if (p.id === 'starvation') {
    console.log(`• ${p.id}: (starvation demo, no console assertion) — ok`)
    continue
  }
  const ok = JSON.stringify(got) === JSON.stringify(p.expectedOutput)
  if (!ok) {
    failures++
    console.error(`✗ ${p.id} MISMATCH`)
    console.error(`   expected: ${JSON.stringify(p.expectedOutput)}`)
    console.error(`   got     : ${JSON.stringify(got)}`)
  } else {
    console.log(`✓ ${p.id}: ${JSON.stringify(got)}`)
  }
  // sanity: stack and all queues drained at the end
  if (final.callStack.length || final.taskQueue.length || final.microtaskQueue.length) {
    console.error(`   ⚠ ${p.id}: not fully drained (stack=${final.callStack.length} macro=${final.taskQueue.length} micro=${final.microtaskQueue.length})`)
    failures++
  }
}
console.log(failures === 0 ? '\nALL PROGRAMS OK ✅' : `\n${failures} FAILURE(S) ❌`)
process.exit(failures === 0 ? 0 : 1)
