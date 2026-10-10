import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';

const isWatch = process.argv.includes('--watch');

function copyWebviewAssets() {
  const rootDist = path.resolve('..', 'dist');
  const targetDist = path.resolve('dist');

  if (fs.existsSync(rootDist)) {
    // Copy index.html
    const rootIndex = path.join(rootDist, 'index.html');
    if (fs.existsSync(rootIndex)) {
      fs.copyFileSync(rootIndex, path.join(targetDist, 'index.html'));
    }

    // Copy assets folder
    const rootAssets = path.join(rootDist, 'assets');
    const targetAssets = path.join(targetDist, 'assets');
    if (fs.existsSync(rootAssets)) {
      fs.cpSync(rootAssets, targetAssets, { recursive: true });
    }
  }
}

const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  minify: !isWatch,
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  copyWebviewAssets();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildOptions);
  copyWebviewAssets();
  console.log('Build complete and webview assets copied.');
}
