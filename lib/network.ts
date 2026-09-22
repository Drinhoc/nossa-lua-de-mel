// Shared by the browser and the backup CLI. The deadline includes response bodies.
export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export async function deadline<T>(work: (signal: AbortSignal) => Promise<T>, ms = 20000, parent?: AbortSignal | null): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(parent?.reason);
  parent?.addEventListener('abort', cancel, { once: true });
  if (parent?.aborted) cancel();
  const timer = setTimeout(() => controller.abort(new Error('A conexão demorou demais. Tente novamente; seus dados foram mantidos.')), ms);
  let abort: () => void = () => {};
  try {
    return await Promise.race([
      new Promise<never>((_, reject) => {
        abort = () => reject(controller.signal.reason || new Error('Operação interrompida.'));
        controller.signal.addEventListener('abort', abort, { once: true });
        if (controller.signal.aborted) abort();
      }),
      Promise.resolve().then(() => { controller.signal.throwIfAborted(); return work(controller.signal); }),
    ]);
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener('abort', cancel);
    controller.signal.removeEventListener('abort', abort);
  }
}
export async function fetchData<T>(url: string, init: RequestInit, read: (response: Response) => Promise<T>, ms = 20000): Promise<T> {
  return deadline(async signal => {
    const response = await fetch(url, { ...init, signal }).catch(() => { throw new Error('Não foi possível conectar. Verifique a rede e tente novamente; seus dados foram mantidos.'); });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      throw new HttpError(response.status === 401
        ? 'Este link não é mais válido. Seu parceiro pode gerar um novo link para você. Seu acesso salvo foi mantido.'
        : payload.error || 'Não foi possível conectar. Tente novamente.', response.status);
    }
    return read(response);
  }, ms, init.signal);
}
