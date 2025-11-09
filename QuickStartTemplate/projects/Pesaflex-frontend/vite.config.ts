import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        // helpful for some web3 libs:
        process: true,
      },
    }),
  ],
  server: {
    host: 'localhost',      // expose on 0.0.0.0 for Codespaces
    port: 5173,
    strictPort: true // fail instead of picking a random port
    // If HMR ever misbehaves in Codespaces, uncomment:
    // hmr: { clientPort: 443 }
  },
  preview: {
    host: true,
    port: 5173,
  },
})
