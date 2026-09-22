// Baixa a Nossa Cápsula (JSON + fotos + ZIP) usando um link pessoal, sem depender da interface.
// Uso: node --experimental-strip-types scripts/export-capsule.mjs "<link pessoal com #entrada=...>" [pasta-destino]
// O link é a chave: não salve este comando no histórico de lugares compartilhados.
import {fetchData} from '../lib/network.ts';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {capsuleFiles,makeZip} from '../lib/capsule.ts';
const link=process.argv[2];const outDir=process.argv[3]||'nossa-capsula-backup';
if(!link||!link.includes('#entrada=')){console.error('Informe o link pessoal completo (…/#entrada=…).');process.exit(1);}
const url=new URL(link);const token=new URLSearchParams(url.hash.slice(1)).get('entrada');const origin=url.origin;
const auth={Authorization:`Bearer ${token}`};
const exp=await fetchData(origin+'/api/export',{headers:auth},r=>r.json());
const photos=new Map();
for(const p of exp.photos){const bytes=await fetchData(origin+p.download,{headers:auth},async r=>new Uint8Array(await r.arrayBuffer()),30000);photos.set(p.id,bytes);}
const files=capsuleFiles(exp,photos);
for(const f of files){const path=join(outDir,f.name);await mkdir(dirname(path),{recursive:true});await writeFile(path,f.data);}
const zipPath=join(outDir,`nossa-capsula-${exp.exportedAt.slice(0,10)}.zip`);await writeFile(zipPath,makeZip(files));
console.log(JSON.stringify({scope:exp.scope,rounds:exp.room.totalRounds,revealed:exp.counts.revealedRounds,answers:exp.counts.answers,photos:exp.photos.length,folder:join(outDir,'nossa-capsula'),zip:zipPath}));
