"use client";
import { useState, useRef } from 'react';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { other, type Person } from '@/lib/rounds';
export function RecoverLink({ person, recover }: { person: Person; recover: () => Promise<string> }) {
  const [link, setLink] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false);
  const saving = useRef(false);
  const partner = other(person);
  async function generate() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); setCopied(false); setLink('');
    try { setLink(await recover()); }
    catch { setError('Não foi possível confirmar a recuperação. Se o pedido chegou ao servidor, o link anterior pode ter sido invalidado. Tente gerar outro link; as memórias continuam na mesma sala.'); }
    finally { saving.current = false; setBusy(false); }
  }
  return <div className="recover-link">
    <AlertDialog><AlertDialogTrigger asChild><button className="text-button" disabled={busy}>{busy?'Gerando novo link…':`${partner} perdeu o link?`}</button></AlertDialogTrigger>
      <AlertDialogContent style={{background:'var(--cream)'}}>
        <AlertDialogTitle>Gerar um novo link para {partner}?</AlertDialogTitle>
        <AlertDialogDescription>O link anterior de {partner} deixará de funcionar. A sala, o progresso, as respostas e as fotos serão preservados. O seu link não muda.</AlertDialogDescription>
        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => void generate()}>Gerar novo link</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    {error&&<p role="alert">{error}</p>}
    {link&&<div role="status"><p><strong>Novo link de {partner}</strong></p><input aria-label={`Novo link de ${partner}`} value={link} readOnly onFocus={e=>e.target.select()}/><button className="text-button" onClick={async()=>{try{await navigator.clipboard.writeText(link);setCopied(true)}catch{setError('Selecione e copie o link completo acima.')}}}>{copied?'Link copiado':'Copiar link'}</button><p>O link anterior de {partner} não funciona mais. Envie este novo link somente para {partner}. Abrir o link dele neste navegador troca sua identidade salva; use outro navegador ou perfil para conferir.</p></div>}
  </div>;
}
