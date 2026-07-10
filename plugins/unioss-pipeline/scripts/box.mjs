// Fixed-width rounded box renderer for UNIOSS pipeline terminal UIs.
// All glyphs used by callers (✓ ✗ · ─ │) are display-width 1, so a code-point
// count is the correct display width.
const H = '─', V = '│', TL = '╭', TR = '╮', BL = '╰', BR = '╯';

export const displayWidth = (str) => Array.from(str).length;

function wrapLine(line, width) {
  if (displayWidth(line) <= width) return [line];
  const words = line.split(' ');
  const out = [];
  let cur = '';
  const flushLongToken = () => {
    while (displayWidth(cur) > width) {
      out.push(Array.from(cur).slice(0, width).join(''));
      cur = Array.from(cur).slice(width).join('');
    }
  };
  for (const word of words) {
    if (cur === '') cur = word;
    else if (displayWidth(cur) + 1 + displayWidth(word) <= width) cur += ' ' + word;
    else { out.push(cur); cur = word; }
    flushLongToken();
  }
  if (cur !== '') out.push(cur);
  return out;
}

export function box(title, lines, width = 69) {
  const fill = Math.max(0, width - displayWidth(title) - 2);
  const top = `${TL}${H} ${title} ${H.repeat(fill)}${TR}`;
  const body = lines.flatMap((line) => wrapLine(line, width)).map((line) => {
    const pad = Math.max(0, width - displayWidth(line));
    return `${V} ${line}${' '.repeat(pad)}${V}`;
  });
  const bottom = `${BL}${H.repeat(width + 1)}${BR}`;
  return [top, ...body, bottom].join('\n');
}
