import { database,bucket } from '@/lib/storage';
import { authenticate,current,AppError,json,failure } from '@/lib/server';
import { ownsBonus, bonusLimit } from '@/lib/bonus';
export async function POST(req:Request){try{
const round=new URL(req.url).searchParams.get('round');const auth=await authenticate(req);const {room,person}=auth;
if(round?.startsWith('album-')){if(!ownsBonus(round,person)||room.position<auth.playlist.length)throw new AppError('O capítulo extra ainda não está disponível.',409);const count=await database().prepare("SELECT COUNT(*) AS n FROM answers WHERE room=? AND person=? AND round LIKE 'album-%'").bind(room.id,person).first<{n:number}>();if((count?.n||0)>=bonusLimit)throw new AppError('Você já guardou suas 24 lembranças extras.',409);}
else {const {round:r}=await current(req,round);if(r.type!=='photo'&&!r.photo)throw new AppError('Esta rodada não recebe fotos.');}
const mime=req.headers.get('content-type');if(mime!=='image/jpeg')throw new AppError('Envie uma foto JPEG.');
if(Number(req.headers.get('content-length')||0)>5000000)throw new AppError('A foto ficou grande demais. Escolha outra.');
const bytes=await req.arrayBuffer();if(bytes.byteLength>5000000||bytes.byteLength<4)throw new AppError('A foto precisa ter até 5 MB.');const magic=new Uint8Array(bytes);if(magic[0]!==255||magic[1]!==216||magic[2]!==255)throw new AppError('Foto inválida.');
const revealed=await database().prepare('SELECT at FROM reveals WHERE room=? AND round=?').bind(room.id,round).first();if(revealed)throw new AppError('Esta rodada já foi revelada.');
const id=crypto.randomUUID();await bucket().put(id,bytes,{httpMetadata:{contentType:'image/jpeg'}});
try{await database().prepare('INSERT INTO photos(id,room,person,round,mime) VALUES(?,?,?,?,?)').bind(id,room.id,person,round,mime).run()}catch(e){await bucket().delete(id);throw e;}
return json({id});
}catch(e){return failure(e)}}
export async function GET(req:Request){try{const {room,person}=await authenticate(req);const id=new URL(req.url).searchParams.get('id');const photo=await database().prepare('SELECT * FROM photos WHERE id=? AND room=?').bind(id,room.id).first();if(!photo)throw new AppError('Foto não encontrada.',404);
if(photo.person!==person){const visible=await database().prepare('SELECT a.photo FROM answers a JOIN reveals r ON a.room=r.room AND a.round=r.round WHERE a.room=? AND a.photo=? AND r.at<=?').bind(room.id,id,Date.now()).first();if(!visible)throw new AppError('Essa foto ainda é segredo.',403);}
const object=await bucket().get(String(id));if(!object)throw new AppError('Foto não encontrada.',404);return new Response(object.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){return failure(e)}}
