// Fixa os ids das SFs no unico mapa do frontend. Os scripts criam ou atualizam pelo nome,
// entao os ids nao mudam entre reexecucoes.
import fs from 'node:fs';
import path from 'node:path';
import { sdk, projectId, DIR_BACKEND, fim } from './lib/base.mjs';

const r = await sdk.listServerFunctionsMitra({ projectId });
const linhas = (r.result ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)).map((s) => `  ${s.name}: ${s.id},`);
const arquivo = path.join(DIR_BACKEND, '..', 'frontend', 'src', 'lib', 'sfIds.ts');
fs.writeFileSync(arquivo, `// Gerado por backend/gerar-mapa-sf.mjs. Nao edite a mao.\nexport const SF = {\n${linhas.join('\n')}\n} as const;\n`);
fim(`Mapa com ${linhas.length} SFs.`);
