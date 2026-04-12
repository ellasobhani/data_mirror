import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': resolve('shared') }
    },
    build: {
      rollupOptions: {
        input: { index: resolve('electron/main.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve('electron/preload.ts') }
      }
    }
  },
  renderer: {
    root: resolve('.'),
    resolve: {
      alias: {
        '@renderer': resolve('src'),
        '@shared': resolve('shared')
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: { index: resolve('index.html') }
      }
    }
  }
})
