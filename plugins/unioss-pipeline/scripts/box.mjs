// Fixed-width rounded box renderer for UNIOSS pipeline terminal UIs.
// displayWidth counts East-Asian-wide / emoji code points as 2 columns;
// ✓ ✗ · ─ │ and other glyphs used by callers stay display-width 1.
const H = '─', V = '│', TL = '╭', TR = '╮', BL = '╰', BR = '╯';

function charWidth(cp) {
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||   // Hangul Jamo
    (cp >= 0x2600 && cp <= 0x26ff) ||   // Misc symbols (⛔ U+26D4)
    (cp >= 0x2e80 && cp <= 0xa4cf) ||   // CJK & radicals … Yi
    (cp >= 0xac00 && cp <= 0xd7a3) ||   // Hangul syllables
    (cp >= 0xf900 && cp <= 0xfaff) ||   // CJK compatibility ideographs
    (cp >= 0xfe30 && cp <= 0xfe4f) ||   // CJK compatibility forms
    (cp >= 0xff00 && cp <= 0xff60) ||   // Fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6) ||   // Fullwidth signs
    (cp >= 0x1f000 && cp <= 0x1faff)    // Emoji & pictographs (🛑 U+1F6D1)
  ) return 2;
  return 1;
}

export const displayWidth = (str) =>
  Array.from(str).reduce((w, ch) => w + charWidth(ch.codePointAt(0)), 0);

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
