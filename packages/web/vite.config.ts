import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg', 'favicon.ico'],
      manifest: {
        name: 'Newsradar',
        short_name: 'Newsradar',
        description: 'Сбор и анализ новостей',
        theme_color: '#fafaf8',
        background_color: '#fafaf8',
        display: 'standalone',
        scope: '/',
    