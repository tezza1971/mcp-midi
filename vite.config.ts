import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main-Process entry file of the Electron App.
        entry: 'src/main/main.ts',
        onstart(options) {
          // Notify the Renderer-Process to reload the page when the Main-Process build is complete, 
          // instead of restarting the entire Electron App.
          options.reload()
        },
        vite: {
          build: {
            sourcemap: true,
            minify: false,
            outDir: 'dist-electron',
            rollupOptions: {
              external: [
                'electron',
                'express',
                'cors',
                'easymidi',
                'fs',
                'path',
                'child_process'
              ],
            },
          },
        },
      },
      {
        entry: 'src/main/preload.ts',
        onstart(options) {
          // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete, 
          // instead of restarting the entire Electron App.
          options.reload()
        },
        vite: {
          build: {
            sourcemap: 'inline',
            minify: false,
            outDir: 'dist-electron',
            rollupOptions: {
              external: [
                'electron'
              ],
            },
          },
        },
      }
    ]),
    // Use Node.js API in the Renderer-process
    renderer(),
  ],
  server: {
    port: 8080,
  },
  build: {
    outDir: 'dist',
  },
})