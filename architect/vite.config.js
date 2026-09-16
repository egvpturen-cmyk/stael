import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' zodat de build zowel op Vercel als achter een subpad werkt
export default defineConfig({
  base: './',
  plugins: [react()],
})
