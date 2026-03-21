import esbuild from 'esbuild';

esbuild.buildSync({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/server.js',
  target: 'node20',
  sourcemap: true,
});

console.log('Server build complete');
