import { resolveConfig } from './config.mjs';
import { parsePeriod, periodOverlapsPresent } from './period.mjs';
import { knowledgeDir, readIndex, stalenessDays } from './store.mjs';
const token = process.argv[2] || '';
const period = parsePeriod(token);
if (!period) { console.log('stale=none'); process.exit(0); }
const { artifactRoot } = resolveConfig();
const dir = knowledgeDir(process.cwd(), artifactRoot);
const age = stalenessDays(readIndex(dir), 'sentiment');
if (age == null) console.log('stale=none');
else if (age > 7 && periodOverlapsPresent(period)) console.log(`stale=${age}`);
else console.log('stale=fresh');
