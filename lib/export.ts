import { database, bucket } from '@/lib/storage';
import { roundById, type Person } from '@/lib/rounds';
import { authenticate, visibleAnswers, AppError } from '@/lib/server';
import { EXPORT_VERSION, type CapsuleExport, type CapsulePhoto, type CapsuleRound } from '@/lib/capsule';

type AnswerRow = { room: string; round: string; person: Person; body: string; photo: string | null; city: string };
type RevealRow = { room: string; round: string; at: number; joint: string | null; decision: 'joint' | 'both' | null };
type PhotoRow = { id: string; room: string; person: Person; round: string; mime: string };
const iso = (ms: number | null | undefined) => (ms ? new Date(Number(ms)).toISOString() : null);

// A sala vem só do token (Authorization). Não existe parâmetro de sala: nenhum token alcança outra sala.
// O conteúdo passa pela mesma regra de visibilidade da sessão ao vivo: antes da revelação, a resposta do parceiro não sai.
export async function buildExport(req: Request): Promise<CapsuleExport> {
  const { room, person, playlist } = await authenticate(req);
  const db = database();
  const full = await db.prepare('SELECT id,position,created FROM rooms WHERE id=?').bind(room.id).first<{ id: string; position: number; created: string }>();
  const all = (await db.prepare('SELECT * FROM answers WHERE room=?').bind(room.id).all<AnswerRow>()).results;
  const revs = (await db.prepare('SELECT * FROM reveals WHERE room=?').bind(room.id).all<RevealRow>()).results;
  const photoRows = (await db.prepare('SELECT * FROM photos WHERE room=?').bind(room.id).all<PhotoRow>()).results;
  const now = Date.now();
  const visible = visibleAnswers(all, revs, person, now);
  const revealed = revs.filter(r => Number(r.at) <= now);
  const complete = room.position >= playlist.length;

  const photos: CapsulePhoto[] = [];
  const photoFile = new Map<string, string>();
  for (const a of visible) {
    if (!a.photo || photoFile.has(a.photo)) continue;
    const row = photoRows.find(p => p.id === a.photo); if (!row) throw new AppError('Uma foto está sem registro. O backup não foi concluído; suas memórias foram preservadas.',503);
    const order = playlist.indexOf(a.round) + 1;
    const file = `photos/${String(order).padStart(2, '0')}-${a.round}-${a.person.toLowerCase()}.jpg`;
    const head = await bucket().head(row.id);
    if (!head) throw new AppError('Uma foto não está disponível no armazenamento. O backup não foi concluído; tente novamente.',503);
    photoFile.set(row.id, file);
    photos.push({ id: row.id, round: row.round, person: row.person, mime: row.mime, bytes: head?.size ?? null, uploadedAt: head?.uploaded ? head.uploaded.toISOString() : null, file, download: `/api/photo?id=${row.id}` });
  }
  const answerOf = (round: string, p: Person) => { const a = visible.find(x => x.round === round && x.person === p); return a ? { body: a.body, city: a.city, photo: a.photo && photoFile.has(a.photo) ? { id: a.photo, file: photoFile.get(a.photo)! } : null } : null; };

  const rounds: CapsuleRound[] = playlist.map((id, i) => {
    const r = roundById(id); const rev = revealed.find(v => v.round === id);
    return {
      order: i + 1, id, type: r.type, label: r.label, city: r.city, title: r.title, note: r.note, ...(r.options ? { options: r.options } : {}), photoRound: r.type === 'photo' || !!r.photo,
      status: rev ? 'revealed' : i <= room.position ? 'waiting-reveal' : 'not-reached',
      revealedAt: rev ? iso(rev.at) : null,
      answers: { Pedro: answerOf(id, 'Pedro'), Mariana: answerOf(id, 'Mariana') },
      joint: rev && (rev.joint || rev.decision) ? { text: rev.joint, decision: rev.decision } : null,
    };
  });
  const byType = (t: string) => rounds.filter(r => r.type === t && r.status === 'revealed');
  return {
    exportVersion: EXPORT_VERSION, app: 'nossa-lua-de-mel', exportedAt: new Date(now).toISOString(), exportedBy: person,
    scope: complete ? 'complete' : 'partial',
    scopeNote: complete ? 'Experiência concluída: todas as rodadas foram reveladas.' : 'Experiência em andamento: contém apenas o que já foi revelado e as respostas de quem exportou.',
    room: { id: room.id, createdAt: full?.created ?? '', position: room.position, totalRounds: playlist.length, complete, lastRevealedAt: iso(Math.max(0, ...revealed.map(r => Number(r.at))) || null) },
    participants: ['Pedro', 'Mariana'],
    playlist,
    rounds,
    hallOfFame: byType('hall').map(r => ({ round: r.id, title: r.label, decision: r.joint?.decision ?? null, joint: r.joint?.text ?? null, Pedro: r.answers.Pedro?.body ?? null, Mariana: r.answers.Mariana?.body ?? null })),
    finalMessages: byType('final').map(r => ({ round: r.id, title: r.title, Pedro: r.answers.Pedro?.body ?? null, Mariana: r.answers.Mariana?.body ?? null })),
    jointMemories: byType('joint').map(r => ({ round: r.id, title: r.title, text: r.joint?.text ?? null })),
    photos,
    counts: { answers: visible.length, revealedRounds: revealed.length, photos: photos.length },
  };
}
