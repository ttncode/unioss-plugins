#!/usr/bin/env node
// SessionStart: surface which CI3 ENVIRONMENT AdminPage/FrontEnd currently resolve to.
import { pathToFileURL } from 'node:url';
import { detectAppEnvironments } from '../scripts/detect-app-env.mjs';

function formatApp(e) {
  if (!e.found) return `${e.app}=unknown (public/index.php not found)`;
  if (e.override && e.resolved !== e.default) return `${e.app}=${e.resolved} (CI_ENV via ${e.override.source})`;
  return `${e.app}=${e.resolved}`;
}

export function buildAdditionalContext() {
  try {
    const summary = detectAppEnvironments().map(formatApp).join(', ');
    return `UNIOSS environment: ${summary}`;
  } catch (e) {
    return `UNIOSS environment: unknown (${e.message})`;
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const additionalContext = buildAdditionalContext();
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } }) + '\n');
}
