import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth':          { target: 'http://localhost:8080', changeOrigin: true },
      '/upload':        { target: 'http://localhost:8080', changeOrigin: true },
      '/products':      { target: 'http://localhost:8080', changeOrigin: true },
      '/cashflow':      { target: 'http://localhost:8080', changeOrigin: true },
      '/reports':       { target: 'http://localhost:8080', changeOrigin: true },
      '/dashboard':     { target: 'http://localhost:8080', changeOrigin: true },
      '/users':         { target: 'http://localhost:8080', changeOrigin: true },
      '/brands':        { target: 'http://localhost:8080', changeOrigin: true },
      '/settings':      { target: 'http://localhost:8080', changeOrigin: true },
      '/stock-value':   { target: 'http://localhost:8080', changeOrigin: true },
      '/products-sold': { target: 'http://localhost:8080', changeOrigin: true },
      '/debug-upload':  { target: 'http://localhost:8080', changeOrigin: true },
    }
  }
})
