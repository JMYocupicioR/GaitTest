import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    basicSsl(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'GAIT · Analizador de marcha',
        short_name: 'GAIT',
        description: 'Captura y analiza parámetros básicos de la marcha desde el navegador.',
        theme_color: '#F0FDFA',
        background_color: '#F0FDFA',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        // Allow larger bundles to be precached by Workbox
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  server: {
    // HTTPS lo aplica @vitejs/plugin-basic-ssl (necesario para cámara desde IP en la LAN).
    host: true,
    port: 5173,
  },
  build: {
    // Relax warnings and split heavy vendor libraries into dedicated chunks
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-mediapipe': [
            '@mediapipe/camera_utils',
            '@mediapipe/drawing_utils',
            '@mediapipe/pose',
          ],
          'vendor-tf': ['@tensorflow/tfjs'],
        },
      },
    },
  },
  worker: {
    // Workers using module + code-splitting require ES format (not IIFE/UMD).
    format: 'es',
  },
});

