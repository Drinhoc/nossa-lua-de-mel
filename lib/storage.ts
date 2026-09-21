import { env } from 'cloudflare:workers';
export function database(){if(!env.DB)throw new Error('Banco indisponível');return env.DB;}
export function bucket(){if(!env.BUCKET)throw new Error('Fotos indisponíveis');return env.BUCKET;}
