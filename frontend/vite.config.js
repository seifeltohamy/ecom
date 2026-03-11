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
      '/categories':    { target: 'http://localhost:8080', changeOrigin: true, bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : null },
      '/reports':       { target: 'http://localhost:8080', changeOrigin: true },
      '/dashboard':     { target: 'http://localhost:8080', changeOrigin: true },
      '/users':         { target: 'http://localhost:8080', changeOrigin: true },
      '/brands':        { target: 'http://localhost:8080', changeOrigin: true },
      '/settings':      { target: 'http://localhost:8080', changeOrigin: true, bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : null },
      '/stock-value':   { target: 'http://localhost:8080', changeOrigin: true, bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : null },
      '/products-sold': { target: 'http://localhost:8080', changeOrigin: true, bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : null },
      '/debug-upload':  { target: 'http://localhost:8080', changeOrigin: true },
      '/admin':         { target: 'http://localhost:8080', changeOrigin: true, bypass: (req) => req.headers.accept?.includes('text/html') ? '/index.html' : null },
      '/sku-cost-items':{ target: 'http://localhost:8080', changeOrigin: true },
      '/automation':    {
        target: 'http://localhost:8080',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            if (req.url?.includes('/run-export')) {
              // Flush SSE chunks immediately — Vite's proxy buffers by default
              res.setHeader('Content-Type', 'text/event-stream');
              res.setHeader('Cache-Control', 'no-cache');
              res.setHeader('X-Accel-Buffering', 'no');
              res.flushHeaders?.();
              proxyRes.on('data', chunk => res.write(chunk));
              proxyRes.on('end', () => res.end());
            }
          });
        },
      },
    }
  }
})
