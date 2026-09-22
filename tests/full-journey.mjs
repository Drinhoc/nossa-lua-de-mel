import './local-only.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const origin=process.env.TEST_ORIGIN||'http://localhost:5173';
async function call(token,body,status=200){const res=await fetch(origin+'/api/session',{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await res.json();assert.equal(res.status,status,JSON.stringify(d));return d;}
const {token:p,invite:m}=await call('',{action:'create',person:'Pedro'});
const s=await call(p);assert.equal(s.rounds.length,19);assert.equal(s.rounds.filter(r=>r.type==='surprise').length,2);assert.deepEqual((await call(m)).playlist,s.playlist);
for(const round of s.rounds){
if(round.type==='joint'){await call(p,{action:'joint',round:round.id,body:'O capítulo da nossa viagem'});assert.equal((await call(m)).reveals.find(r=>r.round===round.id).joint,'O capítulo da nossa viagem');}
else{
for(const [person,t] of [['Pedro',p],['Mariana',m]]){
let photo;
if(round.type==='photo'||round.photo){const image=await readFile(new URL('../public/perito-moreno.jpg',import.meta.url));const r=await fetch(origin+'/api/photo?round='+round.id,{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'image/jpeg'},body:image});assert.equal(r.status,200);photo=(await r.json()).id;}
const body=round.type==='choice'?round.options[0]:round.id==='a-refeicao'?'A mesma refeição':`${person} lembra desta viagem`;
if(round.type==='choice')await call(t,{action:'answer',round:round.id,body:'Opção inválida'},400);
await call(t,{action:'answer',round:round.id,body,...(photo?{photo}:{})});}
await Promise.all([call(p,{action:'reveal',round:round.id}),call(m,{action:'reveal',round:round.id})]);
await new Promise(r=>setTimeout(r,3250));
const state=await call(m);assert.equal(state.answers.filter(a=>a.round===round.id).length,2);
if(round.id==='a-refeicao')assert.equal(state.reveals.find(r=>r.round===round.id).joint,'A mesma refeição');
else if(round.type==='hall'){await call(p,{action:'next',round:round.id},409);await call(p,{action:'joint',round:round.id,decision:'joint',body:'Nossa escolha conjunta'});}
}
await call(p,{action:'next',round:round.id});console.log('PASS',round.type,round.id);
}
const final=await call(m);assert(final.complete);assert.equal(final.answers.length,36);assert.equal(final.reveals.length,19);console.log('PASS full journey: 19 rounds, 36 individual memories, joint responses and Hall choices persisted.');
const ex=await (await fetch(origin+'/api/export',{headers:{Authorization:`Bearer ${p}`}})).json();assert.equal(ex.scope,'complete');assert.equal(ex.rounds.length,19);assert(ex.rounds.every(r=>r.status==='revealed'));assert.equal(ex.counts.answers,36);assert.deepEqual(ex.playlist,final.playlist);assert.equal(ex.photos.length,final.answers.filter(a=>a.photo).length);assert.equal(ex.hallOfFame.length,5);assert.equal(ex.finalMessages.length,2);assert.equal(ex.jointMemories[0].text,'O capítulo da nossa viagem');
for(const ph of ex.photos)assert.equal((await fetch(origin+ph.download,{headers:{Authorization:`Bearer ${m}`}})).status,200);console.log('PASS full export: 19 rounds, 36 answers, Hall, final messages and',ex.photos.length,'photo files recoverable.');

const exportResponse=await fetch(origin+'/api/export',{headers:{Authorization:`Bearer ${m}`}});assert.equal(exportResponse.status,200);const exported=await exportResponse.json();assert.equal(exported.scope,'complete');assert.equal(exported.rounds.length,19);assert.equal(exported.counts.answers,36);assert.equal(exported.finalMessages.length,2);console.log('PASS complete 19-round journey remains exportable');
