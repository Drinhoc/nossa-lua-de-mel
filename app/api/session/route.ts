import { actionSchema } from '@/lib/validation';
import { database } from '@/lib/storage';
import { makePlaylist, sliceIds } from '@/lib/rounds';
import { AppError,token,digest,json,failure,snapshot,current } from '@/lib/server';
export async function GET(req:Request){try{return json(await snapshot(req))}catch(e){return failure(e)}}
export async function POST(req:Request){try{
if(Number(req.headers.get('content-length')||0)>20000)throw new AppError('Resposta muito longa.');
const parsed=actionSchema.safeParse(await req.json());if(!parsed.success)throw new AppError('Confira os campos enviados.');const b=parsed.data;const db=database();
if(b.action==='create'){
if(!b.person)throw new AppError('Escolha Pedro ou Mariana.');
const p=token(),m=token(),id=crypto.randomUUID();const playlist=b.mode==='slice'?sliceIds:makePlaylist();
await db.prepare('INSERT INTO rooms(id,pedro,mariana,playlist,position,created) VALUES(?,?,?,?,0,?)').bind(id,await digest(p),await digest(m),JSON.stringify(playlist),new Date().toISOString()).run();
return json({token:b.person==='Pedro'?p:m,invite:b.person==='Pedro'?m:p});}
const {room,person,round}=await current(req,b.round);
if(b.action==='answer'){
const body=typeof b.body==='string'?b.body.trim():'';if(body.length>3000)throw new AppError('Use até 3.000 caracteres.');
if(!body&&!b.photo)throw new AppError('Escreva uma lembrança para guardar.');
if(round.type==='choice'&&!round.options?.includes(body))throw new AppError('Escolha uma das opções.');
if(round.type==='joint')throw new AppError('Esta resposta é conjunta.');
if(round.type==='photo'||round.photo){if(typeof b.photo!=='string')throw new AppError('Selecione uma foto.');}
if(b.photo){const owned=await db.prepare('SELECT id FROM photos WHERE id=? AND room=? AND person=? AND round=?').bind(b.photo,room.id,person,round.id).first();if(!owned)throw new AppError('Essa foto não pertence a esta rodada.');}
const city=b.city||round.city;
const result=await db.prepare('INSERT INTO answers(room,round,person,body,photo,city) SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM reveals WHERE room=? AND round=?) AND EXISTS(SELECT 1 FROM rooms WHERE id=? AND position=?) ON CONFLICT(room,round,person) DO UPDATE SET body=excluded.body,photo=excluded.photo,city=excluded.city').bind(room.id,round.id,person,body,b.photo||null,city,room.id,round.id,room.id,room.position).run();
if(!result.meta.changes)throw new AppError('A revelação já começou. Sua resposta foi preservada.',409);
}else if(b.action==='reveal'){
const result=await db.prepare('INSERT OR IGNORE INTO reveals(room,round,at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM answers WHERE room=? AND round=?)=2').bind(room.id,round.id,Date.now()+3200,room.id,round.id).run();
if(!result.meta.changes){const exists=await db.prepare('SELECT at FROM reveals WHERE room=? AND round=?').bind(room.id,round.id).first();if(!exists)throw new AppError('Vamos esperar as duas respostas.',409);}
if(round.type==='hall'&&!round.photo){const values=(await db.prepare('SELECT body FROM answers WHERE room=? AND round=?').bind(room.id,round.id).all<{body:string}>()).results;if(values.length===2&&values[0].body.trim().toLocaleLowerCase('pt-BR')===values[1].body.trim().toLocaleLowerCase('pt-BR'))await db.prepare('UPDATE reveals SET joint=?,decision=? WHERE room=? AND round=? AND decision IS NULL').bind(values[0].body,'joint',room.id,round.id).run();}
}else if(b.action==='joint'){
const body=typeof b.body==='string'?b.body.trim():'';if(body.length>3000)throw new AppError('Use até 3.000 caracteres.');
if(round.type==='joint'){if(!body)throw new AppError('Escrevam uma memória juntos.');await db.prepare('INSERT OR IGNORE INTO reveals(room,round,at,joint,decision) VALUES(?,?,?,?,?)').bind(room.id,round.id,Date.now(),body,'joint').run();}
else if(round.type==='hall') {if(!b.decision||b.decision==='joint'&&!body)throw new AppError('Escolham como guardar essa memória.');const result=await db.prepare('UPDATE reveals SET joint=?,decision=? WHERE room=? AND round=? AND at<=?').bind(b.decision==='joint'?body:null,b.decision,room.id,round.id,Date.now()).run();if(!result.meta.changes)throw new AppError('Revelem as respostas primeiro.',409);}
else throw new AppError('Esta rodada não tem escolha conjunta.');
}else if(b.action==='next'){
const rev=await db.prepare('SELECT * FROM reveals WHERE room=? AND round=? AND at<=?').bind(room.id,round.id,Date.now()).first();if(!rev)throw new AppError('Revelem esta memória antes de continuar.',409);if(round.type==='hall'&&!rev.decision)throw new AppError('Escolham como guardar o prêmio.',409);
await db.prepare('UPDATE rooms SET position=position+1 WHERE id=? AND position=?').bind(room.id,room.position).run();
}else throw new AppError('Ação desconhecida.');
return json(await snapshot(req));
}catch(e){return failure(e)}}



