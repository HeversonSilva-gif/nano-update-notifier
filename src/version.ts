export type Parsed = {
  major: number;
  minor: number;
  patch: number;
  prerelease: (string | number)[];
  build: string[];
};

const NUMERIC = String.raw`(?:0|[1-9]\d*)`;
const PRERELEASE_IDENTIFIER = String.raw`(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)`;
const PATTERN = new RegExp(
  String.raw`^v?(${NUMERIC})\.(${NUMERIC})\.(${NUMERIC})(?:-(${PRERELEASE_IDENTIFIER}(?:\.${PRERELEASE_IDENTIFIER})*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$`,
);

function identifier(part: string): string | number {
  return /^\d+$/.test(part) ? Number(part) : part;
}

export function parse(version: string): Parsed | null {
  const match = PATTERN.exec(String(version).trim());
  if (!match) return null;

  const [, major, minor, patch, prerelease, build] = match;
  const core = [major, minor, patch].map(Number);
  if (core.some((part) => !Number.isSafeInteger(part))) return null;
  return {
    major: core[0]!,
    minor: core[1]!,
    patch: core[2]!,
    prerelease: prerelease ? prerelease.split(".").map(identifier) : [],
    build: build ? build.split(".") : [],
  };
}

function comparePrerelease(a: Parsed["prerelease"], b: Parsed["prerelease"]): -1 | 0 | 1 {
  // An absent prerelease outranks a present one, but only when both cores match.
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const left = a[i];
    const right = b[i];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    if (left === right) continue;

    const leftNumeric = typeof left === "number";
    const rightNumeric = typeof right === "number";
    if (leftNumeric && rightNumeric) return left < right ? -1 : 1;
    if (leftNumeric) return -1;
    if (rightNumeric) return 1;
    return left < right ? -1 : 1;
  }

  return 0;
}

function compareMain(a: Parsed, b: Parsed): -1 | 0 | 1 {
  for (const key of ["major", "minor", "patch"] as const) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  return 0;
}

export function compare(a: string, b: string): -1 | 0 | 1 {
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return 0;

  const main = compareMain(left, right);
  return main !== 0 ? main : comparePrerelease(left.prerelease, right.prerelease);
}

export function gt(a: string, b: string): boolean {
  return compare(a, b) === 1;
}

export function diff(from: string, to: string): string | null {
  const left = parse(from);
  const right = parse(to);
  if (!left || !right) return null;

  const comparison = compare(from, to);
  if (comparison === 0) return null;

  const [lower, higher] = comparison < 0 ? [left, right] : [right, left];
  const lowHasPre = lower.prerelease.length > 0;
  const highHasPre = higher.prerelease.length > 0;

  // Dropping a prerelease is special-cased: the "level" of the change is the
  // most-significant component the prerelease version was still qualifying,
  // not a component-by-component diff against the release it becomes.
  if (lowHasPre && !highHasPre) {
    if (lower.minor === 0 && lower.patch === 0) return "major";
    if (compareMain(lower, higher) === 0) {
      return lower.minor !== 0 && lower.patch === 0 ? "minor" : "patch";
    }
  }

  const prefix = highHasPre ? "pre" : "";
  if (lower.major !== higher.major) return `${prefix}major`;
  if (lower.minor !== higher.minor) return `${prefix}minor`;
  if (lower.patch !== higher.patch) return `${prefix}patch`;
  return "prerelease";
}
