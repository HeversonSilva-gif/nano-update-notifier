const ANSI = /(?:\u001B\][\s\S]*?(?:\u0007|\u001B\\|\u009C))|(?:[\u001B\u009B][[\]()#;?]*(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~])/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI, "");
}

function isFullwidth(code: number): boolean {
  return code >= 0x1100 && (
    code <= 0x115f || code === 0x2329 || code === 0x232a ||
    (code >= 0x2e80 && code <= 0x3247 && code !== 0x303f) ||
    (code >= 0x3250 && code <= 0x4dbf) || (code >= 0x4e00 && code <= 0xa4c6) ||
    (code >= 0xa960 && code <= 0xa97c) || (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) || (code >= 0xfe10 && code <= 0xfe19) ||
    (code >= 0xfe30 && code <= 0xfe6b) || (code >= 0xff01 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) || (code >= 0x1b000 && code <= 0x1b001) ||
    (code >= 0x1f200 && code <= 0x1f251) || (code >= 0x20000 && code <= 0x3fffd)
  );
}

const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : undefined;
// U+FE0F is the emoji presentation selector. It forces double width onto base
// characters that are not pictographic alone, which is how keycap sequences work.
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\uFE0F/u;
const MARK = /^\p{Mark}+$/u;

export function visualWidth(text: string): number {
  const clean = stripAnsi(text);
  const segments = segmenter ? [...segmenter.segment(clean)].map(({ segment }) => segment) : [...clean];
  let width = 0;
  for (const grapheme of segments) {
    if (MARK.test(grapheme)) continue;
    if (EMOJI.test(grapheme)) {
      width += 2;
      continue;
    }
    const code = grapheme.codePointAt(0)!;
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) continue;
    width += isFullwidth(code) ? 2 : 1;
  }
  return width;
}
