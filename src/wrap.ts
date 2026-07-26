import { stripAnsi, visualWidth } from "./width.js";

const ESCAPES = new Set(["\u001B", "\u009B"]);
const END_CODE = 39;
const BELL = "\u0007";
const LINK = "]8;;";
const ESCAPE_PATTERN = /(?:\[(?<code>\d+)m|\]8;;(?<uri>.*)\u0007)/;

export type WrapOptions = { hard?: boolean; trim?: boolean };

const ansiCode = (code: number): string => `\u001B[${code}m`;
const ansiLink = (url: string): string => `\u001B${LINK}${url}${BELL}`;

// ansi-styles keeps a 41-entry table mapping each opening SGR code to the code that
// closes it. The table is regular: foreground colours close with 39, background
// colours with 49, and nine pairs are individual.
const PAIRS: Record<number, number> = { 0: 0, 1: 22, 2: 22, 3: 23, 4: 24, 7: 27, 8: 28, 9: 29, 53: 55 };

function closingCode(code: number): number | undefined {
  if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) return 39;
  if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) return 49;
  return PAIRS[code];
}

function wrapWord(rows: string[], word: string, columns: number): void {
  const characters = [...word];
  let insideEscape = false;
  let insideLinkEscape = false;
  let visible = visualWidth(stripAnsi(rows.at(-1)!));

  for (const [index, character] of characters.entries()) {
    const characterLength = visualWidth(character);

    if (visible + characterLength <= columns) {
      rows[rows.length - 1] += character;
    } else {
      rows.push(character);
      visible = 0;
    }

    if (ESCAPES.has(character)) {
      insideEscape = true;
      insideLinkEscape = characters.slice(index + 1, index + 1 + LINK.length).join("") === LINK;
    }

    if (insideEscape) {
      if (insideLinkEscape) {
        if (character === BELL) {
          insideEscape = false;
          insideLinkEscape = false;
        }
      } else if (character === "m") {
        insideEscape = false;
      }
      continue;
    }

    visible += characterLength;

    if (visible === columns && index < characters.length - 1) {
      rows.push("");
      visible = 0;
    }
  }

  // A final row holding nothing but escape characters is folded back into the one
  // before it, so the output does not gain a visually empty line.
  if (!visible && rows.at(-1)!.length > 0 && rows.length > 1) {
    const tail = rows.pop()!;
    rows[rows.length - 1] = rows.at(-1)! + tail;
  }
}

function trimVisibleEnd(value: string): string {
  const words = value.split(" ");
  let last = words.length;
  while (last > 0 && visualWidth(words[last - 1]!) === 0) last--;
  if (last === words.length) return value;
  return words.slice(0, last).join(" ") + words.slice(last).join("");
}

function wrapLine(line: string, columns: number, options: WrapOptions): string {
  if (options.trim !== false && line.trim() === "") return "";

  let result = "";
  let escapeCode: number | undefined;
  let escapeUrl: string | undefined;

  const words = line.split(" ");
  const lengths = words.map(visualWidth);
  let rows = [""];

  for (const [index, word] of words.entries()) {
    if (options.trim !== false) rows[rows.length - 1] = rows.at(-1)!.trimStart();
    let rowLength = visualWidth(rows.at(-1)!);

    if (index !== 0) {
      if (rowLength >= columns && options.trim === false) {
        rows.push("");
        rowLength = 0;
      }
      if (rowLength > 0 || options.trim === false) {
        rows[rows.length - 1] += " ";
        rowLength++;
      }
    }

    if (options.hard && lengths[index]! > columns) {
      const remaining = columns - rowLength;
      const breaksThisLine = 1 + Math.floor((lengths[index]! - remaining - 1) / columns);
      const breaksNextLine = Math.floor((lengths[index]! - 1) / columns);
      if (breaksNextLine < breaksThisLine) rows.push("");
      wrapWord(rows, word, columns);
      continue;
    }

    if (rowLength + lengths[index]! > columns && rowLength > 0 && lengths[index]! > 0) {
      rows.push("");
    }

    rows[rows.length - 1] += word;
  }

  if (options.trim !== false) rows = rows.map(trimVisibleEnd);

  const joined = rows.join("\n");
  const characters = [...joined];
  let offset = 0;

  for (const [index, character] of characters.entries()) {
    result += character;

    if (ESCAPES.has(character)) {
      const groups = ESCAPE_PATTERN.exec(joined.slice(offset))?.groups ?? {};
      if (groups.code !== undefined) {
        const code = Number.parseFloat(groups.code);
        escapeCode = code === END_CODE ? undefined : code;
      } else if (groups.uri !== undefined) {
        escapeUrl = groups.uri.length === 0 ? undefined : groups.uri;
      }
    }

    // Number(undefined) is NaN, which misses both ranges and the table, matching
    // ansiStyles.codes.get(NaN) upstream.
    const code = closingCode(Number(escapeCode));

    if (characters[index + 1] === "\n") {
      if (escapeUrl) result += ansiLink("");
      if (escapeCode && code) result += ansiCode(code);
    } else if (character === "\n") {
      if (escapeCode && code) result += ansiCode(escapeCode);
      if (escapeUrl) result += ansiLink(escapeUrl);
    }

    offset += character.length;
  }

  return result;
}

export function wrap(text: string, columns: number, options: WrapOptions = {}): string {
  return String(text)
    .normalize()
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((line) => wrapLine(line, columns, options))
    .join("\n");
}
