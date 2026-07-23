import { detectIntent, detectPeriod } from './period.mjs';
const q = process.argv[2] || '';
const intent = detectIntent(q);
const period = detectPeriod(q);
console.log(`intent=${intent}`);
console.log(`period=${period ?? 'NONE'}`);
