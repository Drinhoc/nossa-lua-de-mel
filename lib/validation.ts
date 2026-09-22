import {z} from 'zod';
export const actionSchema=z.object({mode:z.enum(['slice','full']).optional(),action:z.enum(['create','answer','reveal','joint','next','relink']),person:z.enum(['Pedro','Mariana']).optional(),round:z.string().max(100).optional(),body:z.string().max(3000).optional(),photo:z.string().uuid().nullable().optional(),city:z.enum(['Buenos Aires','Ushuaia','El Calafate','Toda a viagem']).optional(),decision:z.enum(['both','joint']).optional()});

