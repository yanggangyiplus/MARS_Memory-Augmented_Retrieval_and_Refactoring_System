import * as esbuild from 'esbuild';

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: [
    'vscode',
    '@xenova/transformers',
    'onnxruntime-node',
    'sharp',
    'openai',
  ],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !isProduction,
  minify: isProduction,
  treeShaking: true,
};

async function main() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('[MARS] Watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log('[MARS] Build complete.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
