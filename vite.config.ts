import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Set host: true (or run `npm run dev -- --host`) to test from another
    // device on your local network, e.g. a phone on the same Wi-Fi.
  },
});
