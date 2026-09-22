import { z } from 'zod';
import { database } from '@/lib/storage';
import { authenticate, AppError, json, failure } from '@/lib/server';
import { ownsBonus, bonusLimit } from '@/lib/bonus';

const input = z.object({ id: z.string().max(100), body: z.string().trim().max(3000), photo: z.string().uuid().nullable(), city: z.enum(['Buenos Aires','Ushuaia','El Calafate','Toda a viagem']) });
export async function POST(req: Request) { try {
  const { room, person, playlist } = await authenticate(req);
  if (room.position < playlist.length) throw new AppError('O capítulo extra abre depois da última rodada.',409);
  if (Number(req.headers.get('content-length') || 0) > 20000) throw new AppError('Lembrança muito longa.');
  const parsed = input.safeParse(await req.json());
  if (!parsed.success) throw new AppError('Confira a lembrança antes de guardar.');
  const b = parsed.data;
  if (!ownsBonus(b.id,person) || (!b.body && !b.photo)) throw new AppError('Escreva uma lembrança ou escolha uma foto.');
  const db = database();
  // Retry after an uncertain response returns the same memory, never a duplicate.
  const existing = await db.prepare('SELECT round FROM answers WHERE room=? AND round=? AND person=?').bind(room.id,b.id,person).first();
  if (existing) return json({saved:true,id:b.id});
  if (b.photo && !await db.prepare('SELECT id FROM photos WHERE id=? AND room=? AND person=? AND round=?').bind(b.photo,room.id,person,b.id).first()) throw new AppError('Essa foto não pertence a esta lembrança.');
  const results = await db.batch([
    db.prepare("INSERT OR IGNORE INTO answers(room,round,person,body,photo,city) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM answers WHERE room=? AND person=? AND round LIKE 'album-%') < ?").bind(room.id,b.id,person,b.body,b.photo,b.city,room.id,person,bonusLimit),
    db.prepare('INSERT OR IGNORE INTO reveals(room,round,at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM answers WHERE room=? AND round=? AND person=?)').bind(room.id,b.id,Date.now(),room.id,b.id,person),
  ]);
  if (!results[0].meta.changes && !await db.prepare('SELECT round FROM answers WHERE room=? AND round=? AND person=?').bind(room.id,b.id,person).first()) throw new AppError('Vocês podem guardar até 24 lembranças extras por pessoa.',409);
  return json({saved:true,id:b.id});
} catch(e) { return failure(e); } }
