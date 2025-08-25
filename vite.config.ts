import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // For Cloudflare Pages, the base path is the root ('/'), which is the default.
  // The 'base' property is not needed for this deployment target.
})
