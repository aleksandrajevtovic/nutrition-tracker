import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import ts from 'typescript';

const modules = new Map();
// Load the actual application modules in Node without adding a second TS runner.
export async function typescriptUrl(file) {
  const url = new URL(file);
  if (modules.has(url.href)) return modules.get(url.href);
  const source = await readFile(url, 'utf8');
  let {outputText} = ts.transpileModule(source, {compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
  }});
  outputText = outputText.replace(/import\s+['"][^'"]+\.css['"];?/g, '');
  for (const match of [...outputText.matchAll(/from\s+(['"])([^'"]+)\1/g)]) {
    const specifier = match[2];
    let resolved;
    if (specifier.startsWith('.')) {
      const tsFile = new URL(`${specifier}.ts`, url);
      resolved = await typescriptUrl(existsSync(tsFile) ? tsFile : new URL(`${specifier}.tsx`, url));
    } else resolved = import.meta.resolve(specifier);
    outputText = outputText.replace(match[0], `from '${resolved}'`);
  }
  const result = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  modules.set(url.href, result);
  return result;
}

export async function loadTypeScript(file) {return import(await typescriptUrl(file));}
