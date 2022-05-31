import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import copy from 'rollup-plugin-copy';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    copy({
      targets: [
        { src: 'node_modules/@mxsir/image-tiny/dist/pngtiny-custom.wasm', dest: 'dist/assets' },
      ],
      verbose: true,
      hook: 'writeBundle'
    }),
  ],
  build: {
    sourcemap: false,
  },
});
