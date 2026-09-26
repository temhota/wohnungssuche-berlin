import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/') || specifier.startsWith('.')) {
    const base = specifier.startsWith('@/')
      ? new URL(`../${specifier.slice(2)}`, import.meta.url)
      : new URL(specifier, context.parentURL);
    for (const suffix of ['', '.ts', '.tsx', '/index.ts']) {
      const candidate = new URL(base.href + suffix);
      if (/\.(ts|tsx)$/.test(candidate.pathname) && existsSync(fileURLToPath(candidate))) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (/\.(ts|tsx)$/.test(new URL(url).pathname)) {
    const source = await readFile(new URL(url), 'utf8');
    return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
        fileName: fileURLToPath(url),
      }).outputText,
    };
  }
  return nextLoad(url, context);
}
