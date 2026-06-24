import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the GitHub Pages sub-path (repo name) so asset URLs resolve.
// Using a relative base ('./') also works under /event-loop-lab/ and for file opens.
export default defineConfig({
  plugins: [react()],
  base: './',
})
