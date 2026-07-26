import process from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { box, colorLevel, hexEscape, visualWidth, type BoxOptions } from "../src/box.js";

// boxen renders through chalk, which locks its colour level at import time, so the
// environment has to be in place before the oracle is loaded.
let boxen: typeof import("boxen").default;
let stringWidth: typeof import("string-width").default;

const original = {
  columns: Object.getOwnPropertyDescriptor(process.stdout, "columns"),
  rows: Object.getOwnPropertyDescriptor(process.stdout, "rows"),
  FORCE_COLOR: process.env.FORCE_COLOR,
  NO_COLOR: process.env.NO_COLOR,
  COLUMNS: process.env.COLUMNS,
};

beforeAll(async () => {
  process.env.FORCE_COLOR = "1";
  delete process.env.NO_COLOR;
  delete process.env.COLUMNS;
  Object.defineProperty(process.stdout, "columns", { configurable: true, value: 80 });
  Object.defineProperty(process.stdout, "rows", { configurable: true, value: 24 });
  boxen = (await import("boxen")).default;
  stringWidth = (await import("string-width")).default;
});

afterAll(() => {
  for (const [key, descriptor] of [
    ["columns", original.columns],
    ["rows", original.rows],
  ] as const) {
    if (descriptor) Object.defineProperty(process.stdout, key, descriptor);
    else delete (process.stdout as Partial<NodeJS.WriteStream>)[key];
  }
  for (const key of ["FORCE_COLOR", "NO_COLOR", "COLUMNS"] as const) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

// The matrix below keeps content inside the terminal so it exercises layout rather
// than reflow. Reflow has its own describe block.
const TEXT = "Update available 1.0.0 → 2.0.0\nRun npm i demo\nthird line";
const ALIGNMENTS = ["left", "center", "right"] as const;
const STYLES = [
  "single",
  "double",
  "round",
  "bold",
  "singleDouble",
  "doubleSingle",
  "classic",
  "arrow",
  "none",
] as const;

function matrix(): Array<[string, BoxOptions]> {
  const cases: Array<[string, BoxOptions]> = [];

  for (const borderStyle of STYLES) {
    for (const textAlignment of ALIGNMENTS) {
      cases.push([`style ${borderStyle} / ${textAlignment}`, { borderStyle, textAlignment, padding: 1, margin: 1 }]);
    }
  }

  for (const width of [40, 50, 60]) {
    for (const textAlignment of ALIGNMENTS) {
      for (const padding of [0, 1]) {
        cases.push([`width ${width} / ${textAlignment} / padding ${padding}`, { width, textAlignment, padding }]);
      }
    }
  }

  for (const height of [1, 2, 3, 4, 5, 8, 12]) {
    for (const padding of [0, 1]) {
      cases.push([`height ${height} / padding ${padding}`, { height, padding }]);
    }
  }

  for (const title of ["Update", "A really quite long title for this box here"]) {
    for (const titleAlignment of ALIGNMENTS) {
      for (const width of [undefined, 60]) {
        cases.push([`title "${title.slice(0, 8)}" / ${titleAlignment} / width ${width}`, { title, titleAlignment, width, padding: 1 }]);
      }
    }
  }

  for (const float of ["left", "center", "right"] as const) {
    for (const margin of [0, 1, { left: 2, right: 4 }, { top: 1, bottom: 2 }]) {
      cases.push([`float ${float} / margin ${JSON.stringify(margin)}`, { float, margin, padding: 1 }]);
    }
  }

  for (const borderColor of [undefined, "yellow", "red", "blueBright"]) {
    for (const dimBorder of [false, true]) {
      for (const backgroundColor of [undefined, "blue"]) {
        cases.push([
          `colour ${borderColor} / dim ${dimBorder} / bg ${backgroundColor}`,
          { borderColor, dimBorder, backgroundColor, padding: 1, margin: 1, borderStyle: "round" },
        ]);
      }
    }
  }

  cases.push(["deprecated align wins over textAlignment", { align: "right", textAlignment: "left", padding: 1 }]);
  cases.push(["asymmetric padding", { padding: { top: 2, right: 5, bottom: 0, left: 1 }, margin: 1 }]);
  cases.push(["custom border object", {
    borderStyle: { topLeft: "a", top: "t", topRight: "b", right: "r", bottomRight: "c", bottom: "u", bottomLeft: "d", left: "l" },
    padding: 1,
  }]);
  cases.push(["width and height together", { width: 50, height: 9, padding: 1, textAlignment: "center" }]);
  cases.push(["none with a title", { borderStyle: "none", title: "Heads up", padding: 1 }]);

  return cases;
}

describe("box differential against boxen", () => {
  for (const [label, options] of matrix()) {
    it(label, () => {
      expect(box(TEXT, structuredClone(options))).toBe(boxen(TEXT, structuredClone(options) as never));
    });
  }

  it("matches for fullscreen", () => {
    expect(box(TEXT, { fullscreen: true, padding: 1 })).toBe(boxen(TEXT, { fullscreen: true, padding: 1 }));
    const resize = (width: number, height: number): [number, number] => [width - 10, height - 4];
    expect(box(TEXT, { fullscreen: resize, padding: 1 })).toBe(boxen(TEXT, { fullscreen: resize, padding: 1 }));
  });

  it("does not mutate the caller's options", () => {
    const options: BoxOptions = { padding: 1, margin: 1, title: "Update", borderStyle: "round" };
    const snapshot = structuredClone(options);
    box(TEXT, options);
    expect(options).toEqual(snapshot);
  });

  it("renders emoji and CJK content identically", () => {
    for (const sample of ["🚀 demo 更新 2.0.0 👩🏽‍💻", "更新可用\n👨‍👩‍👧‍👦 ok", "\u001B[32mgreen\u001B[39m\nplain"]) {
      expect(box(sample, { padding: 1, margin: 1, textAlignment: "center", borderStyle: "round" })).toBe(
        boxen(sample, { padding: 1, margin: 1, textAlignment: "center", borderStyle: "round" }),
      );
    }
  });
});

describe("hex colours match chalk at every terminal depth", () => {
  const samples = ["#28b5ac", "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#7f7f7f", "#010203", "#123", "#abc", "#f0f", "#fedcba"];

  for (const level of [1, 2, 3] as const) {
    for (const hex of samples) {
      it(`level ${level} encodes ${hex} like chalk`, async () => {
        const { Chalk } = await import("chalk");
        const chalk = new Chalk({ level });
        // chalk wraps the value; compare only the opening escape it produces.
        const opening = (rendered: string): string => rendered.slice(0, rendered.indexOf("m") + 1);
        expect(hexEscape(hex, false, level)).toBe(opening(chalk.hex(hex)("x")));
        expect(hexEscape(hex, true, level)).toBe(opening(chalk.bgHex(hex)("x")));
      });
    }
  }

  it("resolves the terminal depth the way supports-color does", async () => {
    // chalk's exports map hides its vendored copy, so reach it by path instead.
    const { default: supportsColor } = (await import(
      "../node_modules/chalk/source/vendor/supports-color/index.js"
    )) as { default: { stdout: false | { level: number } } };
    expect(colorLevel()).toBe(supportsColor.stdout ? supportsColor.stdout.level : 0);
  });

  it("renders a hex border end to end like boxen", () => {
    for (const hex of ["#28b5ac", "#f0f", "#123456"]) {
      const options = { padding: 1, margin: 1, borderStyle: "round" as const, borderColor: hex };
      expect(box("hello", structuredClone(options))).toBe(boxen("hello", structuredClone(options)));
    }
  });
});

describe("visualWidth differential against string-width", () => {
  const samples = [
    "hello",
    "更新可用",
    "é",
    "👩🏽‍💻",
    "👨‍👩‍👧‍👦",
    "🇧🇷",
    "™",
    "™\uFE0F",
    "©",
    "®",
    "→",
    "±",
    "½",
    "\u001B[32mhi\u001B[39m",
    "Ｆｕｌｌ",
    "ｱｲｳ",
    "☕",
    "⚠",
    "⚠\uFE0F",
    "⚠︎",
    "✔",
    "❤",
    "❤\uFE0F",
    "#\uFE0F⃣",
    "*\uFE0F⃣",
    "7\uFE0F⃣",
    "🅰",
    "한글",
    "𝕏",
    "０１２",
    "🚀 demo 更新",
  ];

  for (const sample of samples) {
    it(`matches for ${JSON.stringify(sample)}`, () => {
      expect(visualWidth(sample)).toBe(stringWidth(sample));
    });
  }
});

describe("reflow differential against boxen", () => {
  const LONG = "Update available 1.0.0 to 2.0.0 please run npm install demo now";
  const WORD = "supercalifragilisticexpialidocious";

  const cases: Array<[string, string, BoxOptions]> = [
    ["explicit narrow width", LONG, { width: 20 }],
    ["explicit width, centred", LONG, { width: 20, textAlignment: "center" }],
    ["explicit width, right", LONG, { width: 20, textAlignment: "right" }],
    ["explicit width with padding", LONG, { width: 24, padding: 1 }],
    ["long word breaks hard", WORD, { width: 12 }],
    ["long word centred", WORD, { width: 12, textAlignment: "center" }],
    ["multi-line input wraps per line", `${LONG}\nshort`, { width: 18 }],
    ["styled text across the break", `\u001B[32m${LONG}\u001B[39m`, { width: 16 }],
    ["CJK content", "更新があります 1.0.0 から 2.0.0 へ移行してください", { width: 18 }],
    ["emoji content", "🎉 update available 🎉 run npm install now", { width: 14 }],
    ["border none", LONG, { width: 20, borderStyle: "none" }],
    ["with a title", LONG, { width: 22, title: "note" }],
  ];

  for (const [name, text, options] of cases) {
    it(name, () => {
      expect(box(text, structuredClone(options))).toBe(boxen(text, structuredClone(options) as never));
    });
  }

  // boxen reads process.stdout.columns on every call, so redefining it per test is
  // enough — unlike its colour level, which chalk locks at import.
  const narrow: Array<[string, number, string, BoxOptions]> = [
    ["terminal 24", 24, LONG, {}],
    ["terminal 24 centred", 24, LONG, { textAlignment: "center" }],
    ["terminal 30 with padding", 30, LONG, { padding: 1 }],
    ["terminal 20 with margins", 20, LONG, { margin: 2 }],
    ["terminal 40 with asymmetric margins", 40, LONG, { margin: { left: 3, right: 5 } }],
    ["terminal 16, long word", 16, WORD, {}],
    ["terminal 24, explicit width wins", 24, LONG, { width: 40 }],
    ["terminal 24 with a title", 24, LONG, { title: "note" }],
  ];

  for (const [name, columns, text, options] of narrow) {
    it(name, () => {
      Object.defineProperty(process.stdout, "columns", { configurable: true, value: columns });
      try {
        expect(box(text, structuredClone(options))).toBe(boxen(text, structuredClone(options) as never));
      } finally {
        Object.defineProperty(process.stdout, "columns", { configurable: true, value: 80 });
      }
    });
  }
});
