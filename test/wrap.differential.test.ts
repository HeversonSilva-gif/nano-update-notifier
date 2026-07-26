import { describe, expect, it } from "vitest";
import { wrap, type WrapOptions } from "../src/wrap.js";

let oracle: typeof import("wrap-ansi").default;

const CASES: Array<[string, string, number, WrapOptions]> = [
  ["plain word boundary", "the quick brown fox jumped over the lazy dog", 10, { hard: true }],
  ["word longer than the width", "supercalifragilisticexpialidocious", 8, { hard: true }],
  ["width of one", "abc def", 1, { hard: true }],
  ["no trim keeps leading space", "  indented text here", 8, { hard: true, trim: false }],
  ["trim strips it", "  indented text here", 8, { hard: true }],
  ["style spans the break", "\u001B[32mgreen text that wraps around\u001B[39m", 10, { hard: true }],
  ["background spans the break", "\u001B[42mon green across the break\u001B[49m", 9, { hard: true }],
  ["bold spans the break", "\u001B[1mbold text that wraps\u001B[22m", 7, { hard: true }],
  ["reset code zero", "\u001B[0mzero code across a break\u001B[0m", 8, { hard: true }],
  ["hyperlink", "\u001B]8;;https://example.com\u0007link text here\u001B]8;;\u0007", 6, { hard: true }],
  ["CJK on the boundary", "更新可能 1.0.0 から 2.0.0 へ", 7, { hard: true }],
  ["emoji on the boundary", "🎉 party time 🎉 all night", 6, { hard: true }],
  ["combining marks", "ééé ééé ééé", 4, { hard: true }],
  ["embedded newline", "first line here\nsecond line here", 7, { hard: true }],
  ["crlf", "first line here\r\nsecond line here", 7, { hard: true }],
  ["empty string", "", 5, { hard: true }],
  ["only spaces, trimmed", "     ", 5, { hard: true }],
  ["only spaces, untrimmed", "     ", 5, { hard: true, trim: false }],
  ["exact fit", "abcde fghij", 5, { hard: true }],
  ["trailing spaces", "word   ", 10, { hard: true }],
];

describe("wrap differential against wrap-ansi", () => {
  it("matches on every case", async () => {
    oracle ??= (await import("wrap-ansi")).default;
    for (const [name, text, columns, options] of CASES) {
      expect(wrap(text, columns, options), name).toBe(oracle(text, columns, options));
    }
  });
});
