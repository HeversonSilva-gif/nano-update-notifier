function getValue(values: unknown, key: string): unknown {
  let current = values;
  for (const part of key.split(".")) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function interpolate(template: string, values: Record<string, unknown> | unknown[]): string {
  const escaped = "\u0000NUN_OPEN_BRACE\u0000";
  return template
    .replace(/\\\{/g, escaped)
    .replace(/\{([\w.]+)\}/g, (_match, key: string) => {
      const value = getValue(values, key);
      if (value === undefined) throw new Error(`Missing a value for the placeholder: ${key}`);
      return String(value);
    })
    .replaceAll(escaped, "{");
}
