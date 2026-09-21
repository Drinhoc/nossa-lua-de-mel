import { buildExport } from '@/lib/export';
import { json, failure } from '@/lib/server';
export async function GET(req: Request) { try { return json(await buildExport(req)) } catch (e) { return failure(e) } }
