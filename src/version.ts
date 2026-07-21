export type Parsed = {
  major: number;
  minor: number;
  patch: number;
  prerelease: (string | number)[];
  build: string[];
};

const PATTERN =
  /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/;

function identifier(part: string): string | number {
  return /^\d+$/.test(part) ? Number(part) : part;
}

export function parse(version: string): Parsed | null {
  const match = PATTERN.exec(String(version).trim());
  if (!match) return null;

  const [, major, minor, patch, prerelease, build] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
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

export function compare(a: string, b: string): -1 | 0 | 1 {
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return 0;

  for (const key of ["major", "minor", "patch"] as const) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }

  return comparePrerelease(left.prerelease, right.prerelease);
}

export function gt(a: string, b: string): boolean {
  return compare(a, b) === 1;
}
