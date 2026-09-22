// Formato do backup "Nossa Cápsula" e empacotamento em ZIP.
// Sem imports e só com sintaxe TypeScript apagável: roda no navegador (app/page.tsx)
// e no Node (scripts/export-capsule.mjs via --experimental-strip-types).

export const EXPORT_VERSION = 1;

export type CapsulePerson = 'Pedro' | 'Mariana';
export type CapsulePhoto = { id: string; round: string; person: CapsulePerson; mime: string; bytes: number | null; uploadedAt: string | null; file: string; download: string };
export type CapsuleAnswer = { body: string; city: string; photo: { id: string; file: string } | null };
export type CapsuleExtra = CapsuleAnswer & {id: string; person: CapsulePerson; createdAt: string | null};
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
  extras?: CapsuleExtra[];
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
const html = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
// Self-contained presentation: local photos, no requests, no credentials and escaped user text.
export function capsuleAlbum(e: CapsuleExport) {
  const photo = (p: CapsuleAnswer['photo'],alt: string) => p ? `<img src="${html(p.file)}" alt="${html(alt)}">` : '';
  const answer = (a: CapsuleAnswer,person: string) => `<figure>${photo(a.photo,`Memória de ${person}`)}<figcaption><small>${html(person)} · ${html(a.city)}</small><p>${html(a.body)}</p></figcaption></figure>`;
  const rounds = e.rounds.filter(r=>r.status==='revealed'||Object.values(r.answers).some(Boolean));
  const ordered = [...rounds.filter(r=>r.type!=='hall'&&r.type!=='final'),...rounds.filter(r=>r.type==='hall'),...rounds.filter(r=>r.type==='final')];
  const cover = e.photos[0];
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>O que a gente leva · Pedro & Mariana</title><style>
  *{box-sizing:border-box}body{margin:0;color:#193c34;background:#f5f2e9;font:17px/1.7 Arial,sans-serif}h1,h2,p{margin:0}h1,h2{font-family:Georgia,serif;font-weight:400;line-height:1.12}h1{font-size:clamp(54px,8vw,100px)}h2{font-size:clamp(32px,5vw,58px)}small,.eyebrow{font:13px/1.7 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}nav{padding:18px 5vw;display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #c9cbbb}a{color:inherit}button{font:inherit;padding:8px 16px;background:#193c34;color:#fff;border:0;cursor:pointer}.cover{background:#193c34;color:#f5f2e9;min-height:85vh;display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:6vw;padding:8vw}.cover img{width:100%;max-height:65vh;object-fit:contain;border:10px solid #f5f2e9;transform:rotate(2deg)}.cover p{margin:25px 0}.page{max-width:1150px;margin:auto;padding:80px 5vw;border-bottom:1px solid #cccfbf}.page>.eyebrow{color:#816332;margin-bottom:20px}.page h2{margin-bottom:35px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:30px}figure{margin:0;background:#fffdf7;padding:22px;min-width:0}figure img{display:block;max-width:100%;width:100%;max-height:65vh;object-fit:contain}figcaption{padding:20px 0 0}figcaption p,.joint{font:24px/1.6 Georgia,serif;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:12px}.joint{padding:30px;background:#e8ebdf;margin-top:25px;border-left:2px solid #9e824d}.end{text-align:center;padding:100px 25px}.end p{margin:20px 0}.note{padding:20px;background:#f1dfb9}.contents{max-width:1150px;margin:40px auto;padding:0 5vw;display:flex;gap:14px;flex-wrap:wrap}.contents a{font-size:14px}@media(max-width:650px){.cover{grid-template-columns:1fr;padding:50px 25px}.cover img{max-height:45vh}.pair{grid-template-columns:1fr}.page{padding:50px 22px}figure{padding:18px}figcaption p{font-size:22px}}@media print{@page{size:A4;margin:15mm}nav,.contents{display:none}body{background:white;color:#183a31}.cover{min-height:240mm;break-after:page;padding:20mm;display:block;background:white;color:#183a31}.cover img{max-height:110mm;width:auto;max-width:100%;margin-top:20mm;transform:none}.page{padding:10mm 0;break-before:page;border:0}.pair{display:block}figure{break-inside:avoid;margin:8mm 0;padding:5mm}figure img{max-height:130mm;width:auto;margin:auto}figcaption p,.joint{font-size:16pt}.end{break-before:page}h2{font-size:30pt}}
  </style></head><body><nav><span>P & M · Nossa Lua de Mel</span><button onclick="window.print()">Imprimir / salvar PDF</button></nav>${e.scope==='partial'?`<div class="note">Álbum em construção. ${html(e.scopeNote)}</div>`:''}<header class="cover" id="capa"><div><span class="eyebrow">Pedro & Mariana · Setembro de 2026</span><h1>O que<br>a gente<br><em>leva.</em></h1><p>Buenos Aires · Ushuaia · El Calafate</p><span>Uma viagem. Dois olhares. Uma vida inteira pela frente.</span></div>${cover?`<img src="${html(cover.file)}" alt="Uma das nossas memórias da viagem">`:'<div><h2>P & M</h2><p>O nosso lugar favorito<br>continua sendo juntos.</p></div>'}</header><div class="contents">${ordered.map((r,i)=>`<a href="#pagina-${i}">${html(r.label)}</a>`).join('')}${e.extras?.length?'<a href="#extras">Ainda cabe mais de nós</a>':''}</div>${ordered.map((r,i)=>`<section class="page" id="pagina-${i}"><p class="eyebrow">${html(r.type==='hall'?'Hall da Fama':r.type==='final'?'Cartas para nós':r.city)} · ${String(i+1).padStart(2,'0')}</p><h2>${html(r.title)}</h2><div class="pair">${(['Pedro','Mariana'] as CapsulePerson[]).map(p=>r.answers[p]?answer(r.answers[p]!,p):'').join('')}</div>${r.joint?.text?`<div class="joint"><small>Nós dois</small><p>${html(r.joint.text)}</p></div>`:r.joint?.decision==='both'?'<div class="joint">As duas escolhas ficam. Cabe mais de um favorito na nossa história.</div>':''}</section>`).join('')}${e.extras?.length?`<section class="page" id="extras"><p class="eyebrow">Capítulo 20 · Álbum aberto</p><h2>Ainda cabe mais de nós.</h2><div class="pair">${e.extras.map(a=>answer(a,a.person)).join('')}</div></section>`:''}<footer class="end"><p class="eyebrow">Pedro & Mariana</p><h2>A viagem termina.<br><em>A gente fica.</em></h2><p>Para abrir de novo, daqui a muitos setembros.</p><a href="#capa">Voltar à capa</a></footer></body></html>`;
}
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
  if(e.extras?.length){l.push('20. AINDA CABE MAIS DE NÓS','');for(const a of e.extras){l.push(a.person+' · '+a.city,a.body||'(sem legenda)',...(a.photo?['Foto: '+a.photo.file]:[]),'');}}
  return l.join('\r\n');
}

export function capsuleReadme(e: CapsuleExport) {
  return ['NOSSA CÁPSULA — como abrir', '',
    'album.html     Nosso álbum ilustrado. Extraia o ZIP inteiro e abra este arquivo no navegador, sem internet. Use Imprimir para salvar em PDF.',
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
    { name: 'nossa-capsula/album.html', data: enc.encode(capsuleAlbum(e)) },
  ];
  for (const p of e.photos) {
    const data = photos.get(p.id); if (!data) throw new Error(`Foto ausente: ${p.file}`);
    files.push({ name: 'nossa-capsula/' + p.file, data });
  }
  return files;
}
