import {defineConfig} from 'vite';
export default defineConfig({ssr:{noExternal:['@host/visual']},esbuild:{jsx:'automatic'}});
