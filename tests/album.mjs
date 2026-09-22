import './local-only.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {capsuleAlbum,capsuleFiles} from '../lib/capsule.ts';
const origin=process.env.TEST_ORIGIN||'http://localhost:5173';
const bytes=await readFile(new URL('../public/perito-moreno.jpg',import.meta.url));
async function call(token,path='/api/session',body,status=200){const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const result=await r.json();assert.equal(r.status,status,JSON.stringify(result));return result;}
async function upload(token,round,status=200){const r=await fetch(origin+'/api/photo?round='+round,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'image/jpeg'},body:bytes});const result=await r.json();assert.equal(r.status,status,JSON.stringify(result));return result.id;}
const {token:p,invite:m}=await call('','/api/session',{action:'create',person:'Pedro',mode:'slice'});
const extra={id:'album-pedro-'+crypto.randomUUID(),body:'Aquela pausa para olhar o gelo. E a vontade de ficar mais um pouquinho.',photo:null,city:'El Calafate'};
await call(p,'/api/album',extra,409);await upload(p,extra.id,409);
const first=await call(p);
for(const r of first.rounds){for(const [person,t] of [['Pedro',p],['Mariana',m]]){const photo=r.type==='photo'||r.photo?await upload(t,r.id):undefined;await call(t,'/api/session',{action:'answer',round:r.id,body:person==='Pedro'?'O frio lá fora e a alegria de estar com você.':'A gente rindo sem pressa, querendo guardar cada segundo.',...(photo?{photo}:{})});}await call(p,'/api/session',{action:'reveal',round:r.id});await new Promise(resolve=>setTimeout(resolve,3250));if(r.type==='hall')await call(p,'/api/session',{action:'joint',round:r.id,decision:'both'});await call(p,'/api/session',{action:'next',round:r.id});}
const stable=s=>{const {serverTime,...rest}=s;return rest};const before=stable(await call(p));
const {token:outsider}=await call('','/api/session',{action:'create',person:'Pedro',mode:'slice'});
const photo=await upload(p,extra.id);extra.photo=photo;
assert.equal((await fetch(origin+'/api/photo?id='+photo,{headers:{Authorization:`Bearer ${m}`}})).status,403);
await upload(m,extra.id,409);
await call(m,'/api/album',{...extra,id:'album-mariana-'+crypto.randomUUID()},400);
await call(p,'/api/album',extra);await call(p,'/api/album',extra);
assert.deepEqual(stable(await call(p)),before,'bonus must not alter original session snapshot');
assert.equal((await fetch(origin+'/api/photo?id='+photo,{headers:{Authorization:`Bearer ${m}`}})).status,200);
assert.equal((await fetch(origin+'/api/photo?id='+photo,{headers:{Authorization:`Bearer ${outsider}`}})).status,404);
await call(m,'/api/album',{id:'album-mariana-'+crypto.randomUUID(),body:'Nossa piada interna fica aqui, para fazer a gente rir de novo.',photo:null,city:'Buenos Aires'});
let exp=await call(p,'/api/export');assert.equal(exp.extras.length,2);assert.equal(exp.counts.revealedRounds,first.rounds.length);assert.equal(exp.rounds.length,first.rounds.length);assert(exp.photos.some(p=>p.id===photo&&p.file.startsWith('photos/20-')));
assert.deepEqual((await call(m,'/api/export')).extras,exp.extras);assert.deepEqual((await call(outsider,'/api/export')).extras,[]);
const html=capsuleAlbum(exp);assert(html.includes('O que'));assert(html.includes(extra.body));assert(html.includes(exp.photos.find(p=>p.id===photo).file));assert(!html.includes(p)&&!html.includes(m));
const hostile=structuredClone(exp);hostile.extras[0].body='<script>alert("oops")</script><img src=x onerror=alert(1)>';const escaped=capsuleAlbum(hostile);assert(!escaped.includes('<script>'));assert(escaped.includes('&lt;script&gt;'));assert(!escaped.includes('<img src=x'));
const photoMap=new Map();for(const ph of exp.photos){const r=await fetch(origin+ph.download,{headers:{Authorization:`Bearer ${p}`}});assert.equal(r.status,200);photoMap.set(ph.id,new Uint8Array(await r.arrayBuffer()));}
const files=capsuleFiles(exp,photoMap);assert(files.some(f=>f.name==='nossa-capsula/album.html'));assert(files.some(f=>f.name.endsWith(exp.photos.find(p=>p.id===photo).file)));
// Bounded extras and idempotence even at capacity.
for(let i=1;i<24;i++)await call(p,'/api/album',{...extra,id:'album-pedro-'+crypto.randomUUID(),photo:null,body:'Lembrança de teste '+i});
await call(p,'/api/album',{...extra,id:'album-pedro-'+crypto.randomUUID(),photo:null},409);await call(p,'/api/album',extra);
await upload(p,'album-pedro-'+crypto.randomUUID(),409);
console.log('PASS album: completion gate, room isolation, shared extras, idempotent writes, limits, original state preservation, offline HTML escaping and ZIP photos.');
console.log('Local QA:',origin+'/#entrada='+m);
