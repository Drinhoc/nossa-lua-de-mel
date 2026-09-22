// Supplemental memories never enter the original playlist or advance the room.
export const bonusPrefix = 'album-';
export const bonusLimit = 24;
export function isBonus(id: string) { return /^album-(pedro|mariana)-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id); }
export function ownsBonus(id: string, person: string) { return isBonus(id) && id.startsWith(`album-${person.toLowerCase()}-`); }
