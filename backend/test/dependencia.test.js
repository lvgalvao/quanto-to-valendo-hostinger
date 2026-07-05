/**
 * Garante a regra de dependência em camadas:
 *  - core/ não importa managers/, routes/, renderers/ ou db/.
 *  - prompts.js não importa db (recebe override por injeção).
 *  - renderers/ importam apenas de ../core/.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '../src');

function lerImports(caminho) {
  const conteudo = readFileSync(caminho, 'utf-8');
  const regex = /import\s+[^;]*?from\s+['"]([^'"]+)['"]/g;
  const imports = [];
  let m;
  while ((m = regex.exec(conteudo)) !== null) imports.push(m[1]);
  return imports;
}

function arquivosJs(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => join(dir, f));
}

describe('regra de dependência', () => {
  it('core/ não importa managers, routes, renderers ou db', () => {
    const proibidos = ['managers', 'routes', 'renderers', 'db'];
    for (const arquivo of arquivosJs(join(srcDir, 'core'))) {
      for (const imp of lerImports(arquivo)) {
        const violacao = proibidos.find((p) => imp.includes(`/${p}/`) || imp.includes(`${p}/`));
        expect(violacao, `${arquivo} importa "${imp}" (proibido no core)`).toBeUndefined();
      }
    }
  });

  it('renderers/ importam apenas de ../core/', () => {
    for (const arquivo of arquivosJs(join(srcDir, 'renderers'))) {
      for (const imp of lerImports(arquivo)) {
        if (imp.startsWith('.')) {
          expect(imp.includes('/core/'), `${arquivo} importa "${imp}" fora de core`).toBe(true);
        }
      }
    }
  });
});
