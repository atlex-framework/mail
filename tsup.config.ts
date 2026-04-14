import { defineConfig } from 'tsup'

/**
 * Bundle JS with tsup. DTS uses {@link ./tsconfig.tsup.json} (non-composite) so the
 * declaration emitter does not hit TS6307 with an empty composite project graph.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  tsconfig: './tsconfig.tsup.json',
  sourcemap: true,
  clean: false,
})
