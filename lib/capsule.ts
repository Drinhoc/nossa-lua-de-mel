// Formato do backup "Nossa Cápsula" e empacotamento em ZIP.
// Sem imports e só com sintaxe TypeScript apagável: roda no navegador (app/page.tsx)
// e no Node (scripts/export-capsule.mjs via --experimental-strip-types).

export const EXPORT_VERSION = 1;

export type CapsulePerson = 'Pedro' | 'Mariana';
export type CapsulePhoto = { id: string; round: string; person: CapsulePerson; mime: string; bytes: number | null; uploadedAt: string | null; file: string; download: string };
export type CapsuleAnswer = { body: string; city: string; photo: { id: string; file: string } | null };
export type CapsuleRound = {
  order: number; id: string; type: string; label: string; city: string; title: string; note: string; options?: string[]; photoRound: boolean;
  status: 'revealed' | 'waiting-reveal' | 'not-reached';
  revealedAt: string | null;
  answers: { Pedro: CapsuleAnswer | null; Mariana: CapsuleAnswer | null };
  joint: { text: string | null; decision: 'joint' | 'both' | null } | null;
};
export type CapsuleExport = {
  exportVersion: number; app: 'nossa-lua-de-mel'; exportedAt: string; exportedBy: CapsulePerson;
  scope: 'complete' | 'partial'; scopeNote: string;
  room: { id: string; createdAt: string; position: number; totalRounds: number; complete: boolean; lastRevealedAt: string | null };
  participants: CapsulePerson[];
  playlist: string[];
  rounds: CapsuleRound[];
  hallOfFame: { round: string; title: string; decision: 'joint' | 'both' | null; joint: string | null; Pedro: string | null; Mariana: string | null }[];
  finalMessages: { round: string; title: string; Pedro: string | null; Mariana: string | null }[];
  jointMemories: { round: string; title: string; text: string | null }[];
  photos: CapsulePhoto[];
  counts: { answers: number; revealedRounds: number; photos: number };
};

const table = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(data: Uint8Array) { let c = 0xffffffff; for (let i = 0; i < data.length; i++) c = table[(c ^ data[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

// ZIP "stored" (sem compressão: JPEG já é comprimido). Compatível com Windows, macOS, iOS Arquivos e Android.
export function makeZip(files: { name: string; data: Uint8Array }[], date = new Date()): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const locals: Uint8Array[] = []; const centrals: Uint8Array[] = []; let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name); const crc = crc32(f.data); const size = f.data.length;
    const local = new Uint8Array(30 + name.length); const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true); lv.setUint16(12, dosDate, true); lv.setUint32(14, crc, true); lv.setUint32(18, size, true); lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true); local.set(name, 30);
    const central = new Uint8Array(46 + name.length); const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true); cv.setUint16(14, dosDate, true); cv.setUint32(16, crc, true); cv.setUint32(20, size, true); cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); central.set(name, 46);
    locals.push(local, f.data); centrals.push(central); offset += local.length + size;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22); const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + 22); let p = 0;
  for (const part of [...locals, ...centrals, end]) { out.set(part, p); p += part.length; }
  return out;
}

const BOM = String.fromCharCode(0xfeff); // Bloco de Notas antigo reconhece UTF-8 com acentos
const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '—';

// Versão legível, para abrir em qualquer editor de texto daqui a 50 anos.
export function capsuleText(e: CapsuleExport) {
  const l: string[] = ['NOSSA LUA DE MEL — NOSSA CÁPSULA', 'Pedro & Mariana · Buenos Aires · Ushuaia · El Calafate', '',
    `Sala criada em: ${fmt(e.room.createdAt)}`, `Cápsula guardada em: ${fmt(e.exportedAt)} (por ${e.exportedBy})`,
    `Rodadas: ${e.room.complete ? 'todas concluídas' : `${e.room.position} de ${e.room.totalRounds}`}`, ''];
  if (e.scope === 'partial') l.push('ATENÇÃO: cópia parcial, feita antes do fim da experiência.', e.scopeNote, '');
  for (const r of e.rounds) {
    if (r.status === 'not-reached') continue;
    l.push('────────────────────────────────────────', `${String(r.order).padStart(2, '0')}. ${r.label} · ${r.city}`, r.title, r.note);
    if (r.revealedAt) l.push(`Revelado em: ${fmt(r.revealedAt)}`);
    for (const p of ['Pedro', 'Mariana'] as CapsulePerson[]) {
      const a = r.answers[p]; if (!a) continue;
      l.push('', `${p}:`, a.body || '(sem legenda)');
      if (a.city && a.city !== 'Toda a viagem') l.push(`(${a.city})`);
      if (a.photo) l.push(`Foto: ${a.photo.file}`);
    }
    if (r.joint?.text) l.push('', 'Nós dois:', r.joint.text);
    else if (r.joint?.decision === 'both') l.push('', 'Nós dois: as duas escolhas ficam.');
    l.push('');
  }
  return l.join('\r\n');
}

export function capsuleReadme(e: CapsuleExport) {
  return ['NOSSA CÁPSULA — como abrir', '',
    'memorias.txt   Todas as respostas, revelações e escolhas em texto simples.',
    'capsule.json   Os mesmos dados em formato estruturado (exportVersion ' + e.exportVersion + '), para reimportar ou converter no futuro.',
    'photos/        Os arquivos originais das fotos enviadas (JPEG), nomeados por ordem da rodada e pessoa.', '',
    `Guardada em ${fmt(e.exportedAt)}. Rodadas: ${e.rounds.filter(r => r.status === 'revealed').length} reveladas de ${e.room.totalRounds}. Fotos: ${e.photos.length}.`,
    e.scope === 'complete' ? 'Esta é a cópia completa da experiência.' : 'Cópia parcial: ' + e.scopeNote, '',
    'Guarde este arquivo em mais de um lugar (computador, nuvem, pendrive).'].join('\r\n');
}

export function capsuleFiles(e: CapsuleExport, photos: Map<string, Uint8Array>) {
  const enc = new TextEncoder();
  const files: { name: string; data: Uint8Array }[] = [
    { name: 'nossa-capsula/README.txt', data: enc.encode(BOM + capsuleReadme(e)) },
    { name: 'nossa-capsula/memorias.txt', data: enc.encode(BOM + capsuleText(e)) },
    { name: 'nossa-capsula/capsule.json', data: enc.encode(JSON.stringify(e, null, 2)) },
  ];
  for (const p of e.photos) {
    const data = photos.get(p.id); if (!data) throw new Error(`Foto ausente: ${p.file}`);
    files.push({ name: 'nossa-capsula/' + p.file, data });
  }
  return files;
}
