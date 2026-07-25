import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** CSP for SPA — mirrors server/src/config/security.js (dev allows Vite HMR). */
function spaSecurityHeaders(isDev) {
  const scriptSrc = [
    "'self'",
    'https://pagead2.googlesyndication.com',
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://js.stripe.com',
    'https://cdn.brevo.com',
    'https://sibautomation.com',
  ];
  if (isDev) scriptSrc.push("'unsafe-inline'", "'unsafe-eval'");

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' http://localhost:5000 http://127.0.0.1:5000 ws://localhost:5173 ws://127.0.0.1:5173 https://api.stripe.com https://*.cloudinary.com https://www.google-analytics.com https://*.brevo.com",
    "frame-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';
  const securityHeaders = spaSecurityHeaders(isDev);

  return {
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'react-helmet-async', 'axios'],
  },
  build: {
    rollupOptions: {
      output: {
        // Keep PDF libs separate; do NOT force a catch-all `vendor` chunk.
        // Splitting react into `vendor-react` while dumping everything else into
        // `vendor` created a circular chunk (vendor ↔ vendor-react) that left
        // React undefined at runtime (blank page: useState of undefined).
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
        },
      },
    },
  },
  server: {
    port: 5173,
    headers: securityHeaders,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/sitemap.xml': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/robots.txt': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    headers: spaSecurityHeaders(false),
  },
};
});
