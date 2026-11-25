import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const pages = [
  'v1.0/fruity.html',
  'v1.0/workflow.html',
  'v1.0/utility.html',
  'v1.1/fruity.html',
  'v1.1/workflow.html',
];

for (const page of pages) {
  const name = 'showcase/' + page;
  const result = await build({
    root,
    configFile: false,
    publicDir: false,
    base: './',
    logLevel: 'warn',
    build: {
      write: false,
      modulePreload: false,
      assetsInlineLimit: () => true,
      rolldownOptions: { input: name, output: { codeSplitting: false } },
    },
  });
  const files = new Map(result.output.map(file => [file.fileName, file]));
  const html = files.get(name);
  if (html?.type !== 'asset' || typeof html.source !== 'string') {
    throw new Error('Missing HTML for ' + page);
  }

  function asset(url) {
    const file = files.get(posix.normalize(posix.join(posix.dirname(name), url)));
    if (!file) throw new Error('Missing bundle asset: ' + url);
    return file;
  }

  const standalone = html.source
    .replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g, (_, url) => {
      const chunk = asset(url);
      if (chunk.type !== 'chunk' || chunk.imports.length || chunk.dynamicImports.length) {
        throw new Error('Expected a self-contained script for ' + page);
      }
      return '<script type="module">\n' + chunk.code.replace(/<\/script/gi, '<\\/script') + '\n</script>';
    })
    .replace(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g, (_, url) => {
      const css = asset(url);
      if (css.type !== 'asset' || typeof css.source !== 'string') {
        throw new Error('Expected a stylesheet for ' + page);
      }
      return '<style>\n' + css.source + '\n</style>';
    });

  if (/<script\b[^>]*\bsrc=|<link\b[^>]*\brel="(?:stylesheet|modulepreload)"|<img\b[^>]*\bsrc="(?!data:)/i.test(standalone)) {
    throw new Error('An external dependency remains in ' + page);
  }

  const destination = new URL('../dist-showcase/offline/' + page, import.meta.url);
  await mkdir(dirname(fileURLToPath(destination)), { recursive: true });
  await writeFile(destination, standalone, 'utf8');
  console.log('Built offline showcase: dist-showcase/offline/' + page);
}
