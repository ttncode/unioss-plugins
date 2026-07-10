// Fixed-width rounded box renderer for UNIOSS pipeline terminal UIs.
// All glyphs used by callers (✓ ✗ · ─ │) are display-width 1, so a code-point
// count is the correct display width.
const H = '─', V = '│', TL = '╭', TR = '╮', BL = '╰', BR = '╯';

export const displayWidth = (str) => Array.from(str).length;

export function box(title, lines, width = 69) {
  const fill = Math.max(0, width - displayWidth(title) - 2);
  const top = `${TL}${H} ${title} ${H.repeat(fill)}${TR}`;
  const body = lines.map((line) => {
    const pad = Math.max(0, width - displayWidth(line));
    return `${V} ${line}${' '.repeat(pad)}${V}`;
  });
  const bottom = `${BL}${H.repeat(width + 1)}${BR}`;
  return [top, ...body, bottom].join('\n');
}
