import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionSync} from '../lib/session-sync.ts';
import {fetchData,deadline,HttpError} from '../lib/network.ts';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
async function until(predicate,limit=3000){const end=Date.now()+limit;while(!predicate()){assert(Date.now()<end,'condition did not recover before deadline');await sleep(10)}}
test('API slower than 1.5 seconds is accepted; visibility refreshes never overlap GETs',async()=>{
let active=0,max=0,accepted=[];
const sync=createSessionSync({interval:1500,load:async()=>{max=Math.max(max,++active);await sleep(1700);active--;return 12},accept:x=>accepted.push(x),fail:e=>{throw e}});
sync.start();const events=setInterval(()=>sync.refresh(),100);
try{await until(()=>accepted.length>0);assert.deepEqual(accepted,[12]);assert.equal(max,1)}finally{clearInterval(events);sync.stop()}
});
test('temporary failure recovers automatically; hidden tab resumes; stop rejects late results',async()=>{
let calls=0,errors=0,values=[],visible=true;
const sync=createSessionSync({interval:25,visible:()=>visible,load:async()=>{if(++calls===1)throw Error('offline');return 12},accept:x=>values.push(x),fail:()=>errors++});
sync.start();await until(()=>values.length);assert.equal(errors,1);visible=false;await sleep(40);const paused=calls;await sleep(60);assert.equal(calls,paused);visible=true;sync.refresh();await until(()=>calls>paused);sync.stop();
const stale=deferred(),late=[];const other=createSessionSync({load:()=>stale.promise,accept:x=>late.push(x),fail:()=>{}});other.start();other.stop();stale.resolve(1);await sleep(5);assert.deepEqual(late,[]);
});
test('POST wins over older GET, even when GET ignores abort; polling pauses during POST',async()=>{
const old=deferred();let calls=0,current=11,max=0,active=0;
const sync=createSessionSync({interval:1000,load:async()=>{max=Math.max(max,++active);try{return ++calls===1?await old.promise:12}finally{active--}},accept:x=>current=x,fail:()=>{}});
sync.start();sync.beginMutation();current=12;sync.refresh();await sleep(25);assert.equal(calls,1);sync.endMutation();old.resolve(11);await until(()=>calls===2);assert.equal(current,12);assert.equal(max,1);sync.stop();
});
test('timeout covers a stuck fetch AND a stuck response body; next sync recovers',async()=>{
const original=globalThis.fetch;
try{
globalThis.fetch=async()=>new Promise(()=>{});await assert.rejects(fetchData('http://test',{},r=>r.json(),25),/demorou/);
globalThis.fetch=async()=>new Response(new ReadableStream({start(){}}));await assert.rejects(fetchData('http://test',{},r=>r.json(),25),/demorou/);
let failures=0,accepted=false,calls=0;
const sync=createSessionSync({interval:20,load:()=>deadline(async()=>{if(++calls===1)return new Promise(()=>{});return 12},25),accept:()=>accepted=true,fail:()=>failures++});sync.start();await until(()=>accepted);sync.stop();assert.equal(failures,1);
globalThis.fetch=async()=>Response.json({error:'invalid'},{status:401});await assert.rejects(fetchData('http://test',{},r=>r.json()),e=>e instanceof HttpError&&e.status===401&&e.message.includes('parceiro'));
}finally{globalThis.fetch=original}
});
