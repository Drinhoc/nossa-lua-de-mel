import './local-only.mjs';
// Export / backup da Nossa Cápsula: segredo pré-revelação, isolamento entre salas, fotos e backup completo.
// Uso: node --experimental-strip-types tests/export.mjs  (servidor local em TEST_ORIGIN ou http://localhost:5173)
import assert from 'node:assert/strict';
import {readFile,rm,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const origin=process.env.TEST_ORIGIN||'http://localhost:5173';
async function call(token,body,status=200){const r=await fetch(origin+'/api/session',{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
async function exp(token,status=200,query=''){const r=await fetch(origin+'/api/export'+query,{headers:token?{Authorization:`Bearer ${token}`}:{}});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
const image=await readFile(new URL('../public/perito-moreno.jpg',import.meta.url));
async function upload(t,round){const r=await fetch(origin+'/api/photo?round='+round,{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'image/jpeg'},body:image});assert.equal(r.status,200);return (await r.json()).id;}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const run=Date.now().toString(36);const secret=(who,round)=>`segredo-${who}-${round}-${run}`;
const ok=m=>console.log('PASS',m);

// A. criar sala
await exp('',401);await exp('invalido',401);
const {token:p,invite:m}=await call('',{action:'create',person:'Pedro',mode:'slice'});ok('A cria sala');
// B. dois tokens, mesma sala
const sp=await call(p),sm=await call(m);assert.equal(sp.person,'Pedro');assert.equal(sm.person,'Mariana');assert.equal(sp.room,sm.room);assert.notEqual(p,m);ok('B Pedro e Mariana na mesma sala com tokens diferentes');
const other=await call('',{action:'create',person:'Mariana',mode:'slice'});
const room=sp.room,playlist=sp.playlist;
// outra sala responde algo para garantir que nada cruza
await call(other.token,{action:'answer',round:playlist[0],body:secret('outra-sala',0)});

const photosUploaded={};
for(const [i,round] of sp.rounds.entries()){
  const needsPhoto=round.type==='photo'||round.photo;
  const ph=needsPhoto?await upload(p,round.id):undefined;
  // C. Pedro responde
  await call(p,{action:'answer',round:round.id,body:secret('pedro',i),...(ph?{photo:ph}:{})});
  // E (parte 1). Mariana ainda não respondeu: export dela não contém o segredo de Pedro
  let em=await exp(m);assert(!JSON.stringify(em).includes(secret('pedro',i)),'export da Mariana vazou Pedro');
  if(ph)assert(!em.photos.some(x=>x.id===ph),'export da Mariana listou foto secreta de Pedro');
  // D. Mariana responde
  const mh=needsPhoto?await upload(m,round.id):undefined;
  await call(m,{action:'answer',round:round.id,body:secret('mariana',i),...(mh?{photo:mh}:{})});
  if(ph){photosUploaded[ph]=true;photosUploaded[mh]=true;}
  // E (parte 2). ambos responderam, antes da revelação: nenhum vê o outro pelo export, nem com ?room=
  let ep=await exp(p,200,`?room=${room}`);em=await exp(m);
  assert(!JSON.stringify(ep).includes(secret('mariana',i)),'export do Pedro vazou Mariana antes da revelação');
  assert(!JSON.stringify(em).includes(secret('pedro',i)),'export da Mariana vazou Pedro antes da revelação');
  assert.equal(ep.rounds[i].answers.Pedro.body,secret('pedro',i),'export traz a própria resposta');
  assert.equal(ep.rounds[i].answers.Mariana,null);assert.equal(ep.rounds[i].status,'waiting-reveal');assert.equal(ep.scope,'partial');
  if(mh)assert(!ep.photos.some(x=>x.id===mh));
  // F. revelar; durante a contagem continua secreto
  await call(p,{action:'reveal',round:round.id});
  ep=await exp(p);assert(!JSON.stringify(ep).includes(secret('mariana',i)),'vazou durante a contagem');
  await wait(3400);
  // G/H. as duas respostas persistem e sobrevivem a um novo carregamento (GET novo = F5)
  for(const t of [p,m]){const s=await call(t);const rs=s.answers.filter(a=>a.round===round.id);assert.equal(rs.length,2);assert(rs.some(a=>a.body===secret('pedro',i)));assert(rs.some(a=>a.body===secret('mariana',i)));}
  // I. export recupera o conteúdo permitido
  ep=await exp(p);em=await exp(m);
  for(const e of [ep,em]){assert.equal(e.rounds[i].status,'revealed');assert.equal(e.rounds[i].answers.Pedro.body,secret('pedro',i));assert.equal(e.rounds[i].answers.Mariana.body,secret('mariana',i));assert(e.rounds[i].revealedAt);}
  if(ph){assert(ep.photos.some(x=>x.id===mh)&&ep.photos.some(x=>x.id===ph));}
  if(round.type==='hall')await call(m,{action:'joint',round:round.id,decision:'joint',body:`nossa-escolha-${run}`});
  await call(p,{action:'next',round:round.id});
  ok(`C-I rodada ${i+1} (${round.type}): segredo no export, revelação, persistência, recuperação`);
}
ok('E nenhum export revelou resposta secreta do parceiro');

// J. token de outra sala não alcança esta sala
const eo=await exp(other.token,200,`?room=${room}`);
assert.notEqual(eo.room.id,room);const eos=JSON.stringify(eo);
for(let i=0;i<playlist.length;i++){assert(!eos.includes(secret('pedro',i))&&!eos.includes(secret('mariana',i)));}
assert.equal(eo.photos.length,0);assert(eos.includes(secret('outra-sala',0)),'outra sala exporta só o próprio conteúdo');ok('J token de outra sala não exporta esta sala');
// K. fotos isoladas por sala
for(const id of Object.keys(photosUploaded)){const r=await fetch(origin+'/api/photo?id='+id,{headers:{Authorization:`Bearer ${other.token}`}});assert.equal(r.status,404);}
ok('K fotos isoladas por sala');

// L. backup completo: JSON == banco (via API da sessão), fotos byte a byte, ZIP íntegro
const full=await exp(m),state=await call(m);
assert.equal(full.exportVersion,1);assert.equal(full.scope,'complete');assert.equal(full.room.complete,true);assert.equal(full.room.id,room);assert(full.room.createdAt);
assert.deepEqual(full.playlist,state.playlist);assert.deepEqual(full.participants,['Pedro','Mariana']);
assert.equal(full.counts.answers,state.answers.length);assert.equal(full.counts.revealedRounds,state.reveals.length);
for(const a of state.answers){const r=full.rounds.find(x=>x.id===a.round);assert.equal(r.answers[a.person].body,a.body);assert.equal(r.answers[a.person].city,a.city);assert.equal(r.answers[a.person].photo?.id??null,a.photo);}
for(const v of state.reveals){const r=full.rounds.find(x=>x.id===v.round);assert.equal(r.revealedAt,new Date(v.at).toISOString());assert.equal(r.joint?.text??null,v.joint);}
assert.equal(full.hallOfFame.length,1);assert.equal(full.hallOfFame[0].joint,`nossa-escolha-${run}`);
assert.equal(full.photos.length,Object.keys(photosUploaded).length);
const leaked=JSON.stringify(full);
assert(!/[0-9a-f]{64}/.test(leaked),'export não pode conter hashes de token');assert(!leaked.includes(p)&&!leaked.includes(m),'export não pode conter tokens');
const dir=join(tmpdir(),'capsula-test-'+run);
try{
  const out=execFileSync(process.execPath,['--experimental-strip-types','--no-warnings',new URL('../scripts/export-capsule.mjs',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),`${origin}/#entrada=${p}`,dir],{encoding:'utf8'});
  const info=JSON.parse(out.trim().split('\n').pop());assert.equal(info.scope,'complete');
  const photosDir=await readdir(join(dir,'nossa-capsula','photos'));assert.equal(photosDir.length,full.photos.length);
  for(const f of photosDir)assert((await readFile(join(dir,'nossa-capsula','photos',f))).equals(image),'foto exportada idêntica ao arquivo enviado');
  const text=await readFile(join(dir,'nossa-capsula','memorias.txt'),'utf8');for(let i=0;i<playlist.length;i++){assert(text.includes(secret('pedro',i))&&text.includes(secret('mariana',i)));}
  const json=JSON.parse((await readFile(join(dir,'nossa-capsula','capsule.json'),'utf8')));assert.equal(json.room.id,room);
  const listing=execFileSync('python',['-c','import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print("\\n".join(z.namelist()))',info.zip],{encoding:'utf8'});
  for(const n of ['nossa-capsula/README.txt','nossa-capsula/memorias.txt','nossa-capsula/capsule.json'])assert(listing.includes(n));
  assert.equal(listing.split('\n').filter(l=>l.includes('/photos/')).length,full.photos.length);
}finally{await rm(dir,{recursive:true,force:true});}
ok('L backup completo: JSON confere com o banco, fotos byte a byte, ZIP íntegro (CRC ok), texto legível');
console.log('PASS export: segredo preservado, salas isoladas, cápsula completa recuperável.');
