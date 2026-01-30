#!/usr/bin/env bun
/**
 * Bun client build script
 * Replaces Vite for production builds
 *
 * Note: CSS is built separately with Tailwind CLI (v3) since bun-plugin-tailwind
 * requires Tailwind v4 which has incompatible syntax.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from 'fs'
import { join, dirname } from 'path'
import { $ } from 'bun'

const ROOT = dirname(import.meta.dir)
const SRC = join(ROOT, 'src')
const DIST = join(ROOT, 'dist', 'client')
const SHARED = join(ROOT, 'shared')

console.log('Building client with Bun...')
const startTime = Date.now()

// Clean and create dist directory
if (existsSync(DIST)) {
  await $`rm -rf ${DIST}`
}
mkdirSync(DIST, { recursive: true })
mkdirSync(join(DIST, 'assets'), { recursive: true })

// Build TypeScript/React with Bun
console.log('  Bundling TypeScript/React...')

// Plugin to resolve @shared alias
const aliasPlugin = {
  name: 'alias-resolver',
  setup(build: any) {
    build.onResolve({ filter: /^@shared/ }, (args: any) => {
      // Replace @shared with actual path and add .ts extension
      let path = args.path.replace('@shared', SHARED)
      // Try .ts extension first
      if (existsSync(path + '.ts')) {
        path = path + '.ts'
      } else if (existsSync(path + '/index.ts')) {
        path = path + '/index.ts'
      }
      return { path }
    })
  },
}

// Plugin to ignore CSS imports (CSS is built separately)
const cssIgnorePlugin = {
  name: 'css-ignore',
  setup(build: any) {
    build.onResolve({ filter: /\.css$/ }, () => {
      return { path: 'css-ignored', namespace: 'css-ignore' }
    })
    build.onLoad({ filter: /.*/, namespace: 'css-ignore' }, () => {
      return { contents: '', loader: 'js' }
    })
  },
}

const buildResult = await Bun.build({
  entrypoints: [join(SRC, 'main.tsx')],
  outdir: join(DIST, 'assets'),
  target: 'browser',
  format: 'esm',
  splitting: true,
  minify: true,
  sourcemap: 'external',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  external: [],
  naming: {
    entry: '[name]-[hash].js',
    chunk: '[name]-[hash].js',
    asset: '[name]-[hash][ext]',
  },
  plugins: [aliasPlugin, cssIgnorePlugin],
})

if (!buildResult.success) {
  console.error('Build failed:')
  for (const log of buildResult.logs) {
    console.error(log)
  }
  process.exit(1)
}

// Find the entry JS file
const entryFile = buildResult.outputs.find(o => o.path.endsWith('.js') && o.path.includes('main-'))
if (!entryFile) {
  console.error('Could not find entry file in build output')
  process.exit(1)
}
const entryName = entryFile.path.split('/').pop()

// Build CSS separately with Tailwind CLI
console.log('  Building Tailwind CSS...')
await $`bunx tailwindcss@3 -i ${join(SRC, 'styles', 'index.css')} -o ${join(DIST, 'assets', 'index.css')} --minify`

// Generate content hash for CSS
const cssContent = readFileSync(join(DIST, 'assets', 'index.css'))
const cssHash = Bun.hash(cssContent).toString(16).slice(0, 8)
const cssName = `index-${cssHash}.css`
await $`mv ${join(DIST, 'assets', 'index.css')} ${join(DIST, 'assets', cssName)}`

// Generate index.html with hashed assets
console.log('  Generating index.html...')
const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#f0a848" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <title>Claude RPG</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👹</text></svg>" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="preload" href="/fonts/white-rabbit.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/${cssName}">
  </head>
  <body class="bg-rpg-bg text-rpg-text">
    <div id="root"></div>
    <script type="module" src="/assets/${entryName}"></script>
  </body>
</html>`

writeFileSync(join(DIST, 'index.html'), html)

// Copy public assets if they exist
const publicDir = join(ROOT, 'public')
if (existsSync(publicDir)) {
  console.log('  Copying public assets...')
  cpSync(publicDir, DIST, { recursive: true })
}

const duration = ((Date.now() - startTime) / 1000).toFixed(2)
console.log(`\n✓ Client built in ${duration}s`)
console.log(`  Output: ${DIST}`)

// List output files
const outputs = buildResult.outputs.map(o => o.path.split('/').pop())
console.log(`  Files: ${outputs.length + 2} (${outputs.length} JS, 1 CSS, 1 HTML)`)
