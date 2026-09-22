import './local-only.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const origin=process.env.TEST_ORIGIN||'http://localhost:5173';
async function call(token,body,status=200){const r=await fetch(origin+'/api/session',{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
await call('',undefined,401);
await call('',{action:'create',person:'Other'},400);
const {token:p,invite:m}=await call('',{action:'create',person:'Pedro',mode:'slice'});
const outsiders=await call('',{action:'create',person:'Mariana'});
let s=await call(p);assert.equal(s.person,'Pedro');assert.equal((await call(m)).person,'Mariana');
for(const round of s.rounds){
await call(p,{action:'next',round:round.id},409);
let photo;
if(round.type==='photo'){
const image=await readFile(new URL('../public/perito-moreno.jpg',import.meta.url));
const r=await fetch(origin+'/api/photo?round='+round.id,{method:'POST',headers:{Authorization:`Bearer ${p}`,'Content-Type':'image/jpeg'},body:image});assert.equal(r.status,200);photo=(await r.json()).id;
assert.equal((await fetch(origin+'/api/photo?id='+photo,{headers:{Authorization:`Bearer ${m}`}})).status,403);
assert.equal((await fetch(origin+'/api/photo?id='+photo,{headers:{Authorization:`Bearer ${outsiders.token}`}})).status,404);
}
await call(p,{action:'answer',round:round.id,body:'Memória de teste Pedro',...(photo?{photo}:{})});
let ms=await call(m);assert.equal(ms.answers.filter(a=>a.round===round.id).length,0,'secret must not be serialized');
await call(p,{action:'reveal',round:round.id},409);
await call(p,{action:'answer',round:round.id,body:'Memória editada Pedro',...(photo?{photo}:{})});
let mphoto;
if(photo){const image=await readFile(new URL('../public/perito-moreno.jpg',import.meta.url));const r=await fetch(origin+'/api/photo?round='+round.id,{method:'POST',headers:{Authorization:`Bearer ${m}`,'Content-Type':'image/jpeg'},body:image});mphoto=(await r.json()).id;await call(m,{action:'answer',round:round.id,body:'roubo',photo},400)}
await call(m,{action:'answer',round:round.id,body:'Memória de teste Mariana',...(mphoto?{photo:mphoto}:{})});
await call(p,{action:'reveal',round:round.id});
assert.equal((await call(m)).answers.filter(a=>a.round===round.id).length,1,'countdown must keep answer secret');
await call(p,{action:'answer',round:round.id,body:'edit after reveal',...(photo?{photo}:{})},409);
await new Promise(r=>setTimeout(r,3400));
ms=await call(m);assert.equal(ms.answers.filter(a=>a.round===round.id).length,2);
if(photo)assert.equal((await fetch(origin+'/api/photo?id='+photo,{headers:{Authorization:`Bearer ${m}`}})).status,200);
if(round.type==='hall')await call(p,{action:'joint',round:round.id,decision:'both'});
const next=await call(p,{action:'next',round:round.id});
await call(m,{action:'next',round:round.id},409);
assert.equal((await call(m)).position,next.position);
console.log('PASS',round.id,'secret, reveal, persistence, synchronized progress');
}
s=await call(p);assert.equal(s.complete,true);assert.equal(s.answers.length,8);assert.equal((await call(outsiders.token)).answers.length,0);
console.log('PASS complete vertical slice; 2 identities; isolated rooms; protected photos; edits; countdown; no double advance.');

