import os from "node:os";
import process from "node:process";
import { visualWidth } from "./width.js";
import { wrap } from "./wrap.js";

export { stripAnsi, visualWidth } from "./width.js";

export type Border = {
  topLeft: string;
  top: string;
  topRight: string;
  right: string;
  bottomRight: string;
  bottom: string;
  bottomLeft: string;
  left: string;
  horizontal?: string;
  vertical?: string;
};

const BORDERS: Record<string, Border> = {
  single: { topLeft: "┌", top: "─", topRight: "┐", right: "│", bottomRight: "┘", bottom: "─", bottomLeft: "└", left: "│" },
  double: { topLeft: "╔", top: "═", topRight: "╗", right: "║", bottomRight: "╝", bottom: "═", bottomLeft: "╚", left: "║" },
  round: { topLeft: "╭", top: "─", topRight: "╮", right: "│", bottomRight: "╯", bottom: "─", bottomLeft: "╰", left: "│" },
  bold: { topLeft: "┏", top: "━", topRight: "┓", right: "┃", bottomRight: "┛", bottom: "━", bottomLeft: "┗", left: "┃" },
  singleDouble: { topLeft: "╓", top: "─", topRight: "╖", right: "║", bottomRight: "╜", bottom: "─", bottomLeft: "╙", left: "║" },
  doubleSingle: { topLeft: "╒", top: "═", topRight: "╕", right: "│", bottomRight: "╛", bottom: "═", bottomLeft: "╘", left: "│" },
  classic: { topLeft: "+", top: "-", topRight: "+", right: "|", bottomRight: "+", bottom: "-", bottomLeft: "+", left: "|" },
  arrow: { topLeft: "↘", top: "↓", topRight: "↙", right: "←", bottomRight: "↖", bottom: "↑", bottomLeft: "↗", left: "→" },
  none: { topLeft: "", top: "", topRight: "", right: "", bottomRight: "", bottom: "", bottomLeft: "", left: "" },
};

const COLORS: Record<string, number> = {
  black: 30, red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, white: 37,
  gray: 90, grey: 90, blackBright: 90, redBright: 91, greenBright: 92, yellowBright: 93,
  blueBright: 94, magentaBright: 95, cyanBright: 96, whiteBright: 97,
};

export type Spacing = { top?: number; right?: number; bottom?: number; left?: number };
export type Alignment = "left" | "right" | "center";
export type BoxOptions = {
  borderColor?: string;
  borderStyle?: keyof typeof BORDERS | Border;
  dimBorder?: boolean;
  padding?: number | Spacing;
  margin?: number | Spacing;
  float?: "left" | "right" | "center";
  backgroundColor?: string;
  align?: Alignment;
  textAlignment?: Alignment;
  title?: string;
  titleAlignment?: Alignment;
  width?: number;
  height?: number;
  fullscreen?: boolean | ((width: number, height: number) => [number, number]);
};

function spacing(value: number | Spacing | undefined): Required<Spacing> {
  if (typeof value === "number") {
    return { top: value, right: value * 3, bottom: value, left: value * 3 };
  }
  return { top: value?.top ?? 0, right: value?.right ?? 0, bottom: value?.bottom ?? 0, left: value?.left ?? 0 };
}

function colorsEnabled(): boolean {
  if ("NO_COLOR" in process.env || process.env.FORCE_COLOR === "0") return false;
  return "FORCE_COLOR" in process.env || Boolean(process.stdout.isTTY);
}

const HEX = /^#(?:[0-9a-f]{3}){1,2}$/i;

function parseHex(color: string): [number, number, number] {
  let digits = color.slice(1);
  if (digits.length === 3) digits = digits.replace(/./g, (digit) => digit + digit);
  const value = Number.parseInt(digits, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function rgbToAnsi256(red: number, green: number, blue: number): number {
  if (red === green && green === blue) {
    if (red < 8) return 16;
    if (red > 248) return 231;
    return Math.round(((red - 8) / 247) * 24) + 232;
  }
  return (
    16 +
    36 * Math.round((red / 255) * 5) +
    6 * Math.round((green / 255) * 5) +
    Math.round((blue / 255) * 5)
  );
}

function ansi256ToAnsi16(code: number): number {
  if (code < 8) return 30 + code;
  if (code < 16) return 90 + (code - 8);

  let red: number;
  let green: number;
  let blue: number;
  if (code >= 232) {
    red = green = blue = ((code - 232) * 10 + 8) / 255;
  } else {
    const offset = code - 16;
    const remainder = offset % 36;
    red = Math.floor(offset / 36) / 5;
    green = Math.floor(remainder / 6) / 5;
    blue = (remainder % 6) / 5;
  }

  const value = Math.max(red, green, blue) * 2;
  if (value === 0) return 30;
  const result = 30 + ((Math.round(blue) << 2) | (Math.round(green) << 1) | Math.round(red));
  return value === 2 ? result + 60 : result;
}

function forcedLevel(env: NodeJS.ProcessEnv): number | undefined {
  const forced = env.FORCE_COLOR;
  if (forced === undefined) return undefined;
  if (forced === "true") return 1;
  if (forced === "false") return 0;
  return forced.length === 0 ? 1 : Math.min(Number.parseInt(forced, 10), 3);
}

// A hex colour is downsampled to the terminal's depth, so the depth has to be
// resolved the same way `supports-color` resolves it or the escape diverges.
// Ported from supports-color, including the ordering, which is load-bearing.
export function colorLevel(env: NodeJS.ProcessEnv = process.env, argv: string[] = process.argv): number {
  const forced = forcedLevel(env);
  if (forced === 0) return 0;

  if (argv.includes("--color=16m") || argv.includes("--color=full") || argv.includes("--color=truecolor")) return 3;
  if (argv.includes("--color=256")) return 2;
  if ("TF_BUILD" in env && "AGENT_NAME" in env) return 1;
  if (!process.stdout.isTTY && forced === undefined) return 0;

  const min = forced ?? 0;
  if (env.TERM === "dumb") return min;

  if (process.platform === "win32") {
    const release = os.release().split(".");
    if (Number(release[0]) >= 10 && Number(release[2]) >= 10_586) {
      return Number(release[2]) >= 14_931 ? 3 : 2;
    }
    return 1;
  }

  if ("CI" in env) {
    if (["GITHUB_ACTIONS", "GITEA_ACTIONS", "CIRCLECI"].some((key) => key in env)) return 3;
    if (["TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].some((key) => key in env) || env.CI_NAME === "codeship") return 1;
    return min;
  }

  if ("TEAMCITY_VERSION" in env) return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION!) ? 1 : 0;
  if (env.COLORTERM === "truecolor") return 3;
  if (env.TERM === "xterm-kitty" || env.TERM === "xterm-ghostty" || env.TERM === "wezterm") return 3;

  if ("TERM_PROGRAM" in env) {
    const version = Number.parseInt((env.TERM_PROGRAM_VERSION ?? "").split(".")[0]!, 10);
    if (env.TERM_PROGRAM === "iTerm.app") return version >= 3 ? 3 : 2;
    if (env.TERM_PROGRAM === "Apple_Terminal") return 2;
  }

  if (/-256(color)?$/i.test(env.TERM ?? "")) return 2;
  if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM ?? "")) return 1;
  if ("COLORTERM" in env) return 1;
  return min;
}

export function hexEscape(color: string, background: boolean, level = colorLevel()): string {
  const [red, green, blue] = parseHex(color);
  if (level === 3) return `\u001B[${background ? 48 : 38};2;${red};${green};${blue}m`;
  if (level === 2) return `\u001B[${background ? 48 : 38};5;${rgbToAnsi256(red, green, blue)}m`;
  const basic = ansi256ToAnsi16(rgbToAnsi256(red, green, blue));
  return `\u001B[${background ? basic + 10 : basic}m`;
}

function paint(value: string, color: string | undefined, background = false): string {
  if (!color || !colorsEnabled()) return value;
  const closing = `\u001B[${background ? 49 : 39}m`;
  if (HEX.test(color)) return `${hexEscape(color, background)}${value}${closing}`;
  const code = COLORS[color];
  if (!code) return value;
  return `\u001B[${background ? code + 10 : code}m${value}${closing}`;
}

export function reset(value: string): string {
  return colorsEnabled() ? `\u001B[0m${value}\u001B[0m` : value;
}

export function style(value: string, color?: string, dim = false): string {
  if (!colorsEnabled()) return value;
  const colorCode = color && COLORS[color];
  const opening = [dim ? 2 : undefined, colorCode].filter((code) => code !== undefined).join(";");
  if (!opening) return value;
  const closing = `${colorCode ? "\u001B[39m" : ""}${dim ? "\u001B[22m" : ""}`;
  return `\u001B[${opening}m${value}${closing}`;
}

function terminalColumns(): number {
  if (process.stdout?.columns) return process.stdout.columns;
  if (process.stderr?.columns) return process.stderr.columns;
  if (process.env.COLUMNS) return Number.parseInt(process.env.COLUMNS, 10);
  return 80;
}

function resolveBorder(borderStyle: BoxOptions["borderStyle"]): Border {
  const selected = typeof borderStyle === "object" ? borderStyle : (BORDERS[borderStyle ?? "single"] ?? BORDERS.single!);
  return {
    ...selected,
    top: selected.top ?? selected.horizontal ?? "",
    bottom: selected.bottom ?? selected.horizontal ?? "",
    left: selected.left ?? selected.vertical ?? "",
    right: selected.right ?? selected.vertical ?? "",
  };
}

function makeTitle(text: string, horizontal: string, alignment: Alignment): string {
  const textWidth = visualWidth(text);
  if (alignment === "left") return text + horizontal.slice(textWidth);
  if (alignment === "right") return horizontal.slice(textWidth) + text;

  // An odd remainder is shortened on the left so the bar cannot outgrow the box.
  let rest = horizontal.slice(textWidth);
  if (rest.length % 2 === 1) {
    rest = rest.slice(Math.floor(rest.length / 2));
    return rest.slice(1) + text + rest;
  }
  rest = rest.slice(rest.length / 2);
  return rest + text + rest;
}

export function box(text: string, options: BoxOptions = {}): string {
  const isNone = options.borderStyle === "none";
  const border = resolveBorder(options.borderStyle);
  const borderWidth = isNone ? 0 : 2;
  const padding = spacing(options.padding);
  const margin = spacing(options.margin);
  const alignment = options.align ?? options.textAlignment ?? "left";
  const columns = terminalColumns();

  let width = options.width;
  let height = options.height;
  if (options.fullscreen) {
    const available: [number, number] = [process.stdout.columns, process.stdout.rows];
    const [fullWidth, fullHeight] =
      typeof options.fullscreen === "function" ? options.fullscreen(...available) : available;
    width ||= fullWidth;
    height ||= fullHeight;
  }
  const widthOverride = width !== undefined;
  if (width) width = Math.max(1, width - borderWidth);
  if (height) height = Math.max(1, height - borderWidth);

  const lines = text.split("\n");
  const textWidth = Math.max(0, ...lines.map(visualWidth));
  const naturalWidth = textWidth + padding.left + padding.right;

  let title = options.title;
  if (title) {
    const limit = widthOverride ? width! : columns - margin.left - margin.right - borderWidth;
    title = title.slice(0, Math.max(0, limit - 2));
    if (title) {
      title = isNone ? title : ` ${title} `;
      // A title wider than the content decides the width, unless width is fixed.
      if (!widthOverride && visualWidth(title) > naturalWidth) width = visualWidth(title);
    }
  }
  // boxen caps the width at the terminal and reflows anything wider. Reflowing ANSI
  // text costs more code than the whole module, so a box that outgrows the terminal
  // stays wide and lets the terminal wrap it.
  width ||= naturalWidth;

  if (width - (padding.left + padding.right) <= 0) {
    padding.left = 0;
    padding.right = 0;
  }
  if (height && height - (padding.top + padding.bottom) <= 0) {
    padding.top = 0;
    padding.bottom = 0;
  }

  const contentWidth = width - padding.left - padding.right;

  // Each line is first centred against the widest line, then the whole block is
  // offset inside any extra width. Centring lines directly against the full width
  // rounds differently and drifts by a column.
  const alignGroup = (group: string[], reference: number): string[] => {
    const groupOffset =
      alignment === "center" ? Math.trunc((contentWidth - reference) / 2)
        : alignment === "right" ? contentWidth - reference
          : 0;
    return group.map((line) => {
      const slack = reference - visualWidth(line);
      const inner = alignment === "center" ? Math.floor(slack / 2) : alignment === "right" ? slack : 0;
      return " ".repeat(Math.max(0, groupOffset + inner)) + line;
    });
  };

  // Content that does not fit is wrapped one source line at a time, and each wrapped
  // group is aligned against its own widest line rather than against the whole block.
  const aligned =
    textWidth > contentWidth
      ? lines.flatMap((line) => {
          const group = wrap(line, contentWidth, { hard: true }).split("\n");
          return alignGroup(group, Math.max(0, ...group.map(visualWidth)));
        })
      : alignGroup(lines, textWidth);

  const blank = " ".repeat(width);
  let body = aligned.map((line) => {
    const padded = " ".repeat(padding.left) + line + " ".repeat(padding.right);
    return padded + " ".repeat(Math.max(0, width - visualWidth(padded)));
  });

  body = [
    ...Array.from({ length: padding.top }, () => blank),
    ...body,
    ...Array.from({ length: padding.bottom }, () => blank),
  ];
  if (height) {
    body = body.slice(0, height);
    while (body.length < height) body.push(blank);
  }

  const marginLeft = " ".repeat(
    options.float === "center"
      ? Math.max(Math.floor((columns - width - borderWidth) / 2), 0)
      : options.float === "right"
        ? Math.max(columns - width - margin.right - borderWidth, 0)
        : margin.left,
  );
  const dim = options.dimBorder && colorsEnabled() ? "\u001B[2m" : "";
  const resetDim = dim ? "\u001B[22m" : "";
  const colorBorder = (value: string): string =>
    value === "" ? "" : dim + paint(value, options.borderColor) + resetDim;
  const colorContent = (value: string): string =>
    options.backgroundColor ? paint(value, options.backgroundColor, true) : value;

  let result = "\n".repeat(margin.top);
  if (!isNone || title) {
    const bar = border.top.repeat(width);
    result +=
      colorBorder(marginLeft + border.topLeft + (title ? makeTitle(title, bar, options.titleAlignment ?? "left") : bar) + border.topRight) +
      "\n";
  }
  result += body
    .map((line) => marginLeft + colorBorder(border.left) + colorContent(line) + colorBorder(border.right))
    .join("\n");
  if (!isNone) {
    result += "\n" + colorBorder(marginLeft + border.bottomLeft + border.bottom.repeat(width) + border.bottomRight);
  }
  return result + "\n".repeat(margin.bottom);
}
