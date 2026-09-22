// Recuperação de link perdido: Mariana recria o acesso de Pedro na MESMA sala sem tocar em nenhum dado.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const origin=process.env.TEST_ORIGIN||'http://localhost:5173';
async function call(token,body,status=200){const r=await fetch(origin+'/api/session',{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
const image=await readFile(new URL('../public/perito-moreno.jpg',import.meta.url));
async function upload(t,round){const r=await fetch(origin+'/api/photo?round='+round,{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'image/jpeg'},body:image});assert.equal(r.status,200);return (await r.json()).id;}
const {token:p,invite:m}=await call('',{action:'create',person:'Pedro'});
const other=await call('',{action:'create',person:'Pedro'});
const s=await call(p);
// avança 3 rodadas (inclui foto) e deixa Pedro com resposta secreta na 4ª
for(const round of s.rounds.slice(0,3)){
  for(const t of [p,m]){const ph=round.type==='photo'||round.photo?await upload(t,round.id):undefined;await call(t,{action:'answer',round:round.id,body:round.type==='choice'?round.options[0]:`resposta ${round.id} ${t===p?'P':'M'}`,...(ph?{photo:ph}:{})});}
  await call(p,{action:'reveal',round:round.id});await new Promise(r=>setTimeout(r,3300));
  if(round.type==='hall')await call(p,{action:'joint',round:round.id,decision:'both'});
  await call(p,{action:'next',round:round.id});
}
const cur=s.rounds[3];const pendingPhoto=cur.type==='photo'||cur.photo?await upload(p,cur.id):undefined;
await call(p,{action:'answer',round:cur.id,body:cur.type==='choice'?cur.options[0]:'segredo pendente do Pedro',...(pendingPhoto?{photo:pendingPhoto}:{})});
const beforeP=await call(p),beforeM=await call(m);
// sem token e com token de outra sala não recria nada nesta sala
await call('',{action:'relink'},401);
const hijack=await call(other.token,{action:'relink'});const otherRoom=(await call(other.token)).room;assert.equal((await call(hijack.invite)).room,otherRoom);assert.notEqual(otherRoom,beforeM.room);assert.deepEqual({...(await call(m)),serverTime:0},{...beforeM,serverTime:0},'relink de outra sala não afeta esta');
// Mariana recria o link de Pedro
const {invite:newP,for:forWho}=await call(m,{action:'relink'});assert.equal(forWho,'Pedro');assert.notEqual(newP,p);
await call(p,undefined,401);console.log('PASS link antigo do Pedro deixou de funcionar');
const afterP=await call(newP),afterM=await call(m);
assert.equal(afterP.person,'Pedro');assert.equal(afterP.room,beforeP.room);assert.equal(afterM.room,beforeM.room);
const strip=d=>({...d,serverTime:0});
assert.deepEqual(strip(afterP),strip(beforeP),'Pedro vê exatamente o mesmo estado (posição, playlist, respostas, segredo pendente)');
assert.deepEqual(strip(afterM),strip(beforeM),'Mariana vê exatamente o mesmo estado');
assert(!afterM.answers.some(a=>a.person==='Pedro'&&a.round===cur.id),'segredo do Pedro continua escondido da Mariana');
for(const a of beforeP.answers.filter(a=>a.photo))assert.equal((await fetch(origin+'/api/photo?id='+a.photo,{headers:{Authorization:`Bearer ${newP}`}})).status,200);
console.log('PASS mesma sala, mesma posição, respostas/fotos/segredo intactos');
// continua de onde parou
const mh=pendingPhoto?await upload(m,cur.id):undefined;
await call(m,{action:'answer',round:cur.id,body:cur.type==='choice'?cur.options[0]:'resposta Mariana',...(mh?{photo:mh}:{})});
await call(newP,{action:'reveal',round:cur.id});await new Promise(r=>setTimeout(r,3300));
if(cur.type==='hall')await call(newP,{action:'joint',round:cur.id,decision:'both'});
const next=await call(newP,{action:'next',round:cur.id});assert.equal(next.position,4);assert.equal((await call(m)).position,4);
console.log('PASS Pedro com link novo continua a experiência sincronizada com Mariana');
