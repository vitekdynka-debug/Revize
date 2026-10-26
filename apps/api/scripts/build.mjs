// Bundles the API for production: workspace packages (@revize/*, TypeScript sources) are
// inlined, npm dependencies stay external and are installed in the image.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts', 'src/cli/migrate.ts', 'src/cli/seed.ts', 'src/cli/create-user.ts'],
  outdir: 'dist',
  outbase: 'src',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  plugins: [
    {
      name: 'externalize-npm-dependencies',
      setup(b) {
        b.onResolve({ filter: /^[^./]/ }, (args) =>
          args.path.startsWith('@revize/') ? undefined : { path: args.path, external: true },
        );
      },
    },
  ],
});
console.log('API built into dist/');
