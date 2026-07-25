import pupa from "pupa";
import { describe, expect, it } from "vitest";
import { interpolate } from "../src/template.js";

describe("interpolate", () => {
  const cases: Array<[string, Record<string, unknown> | unknown[]]> = [
    ["{a} then {b}", { a: "one", b: "two" }],
    ["{foo.bar}", { foo: { bar: "nested" } }],
    ["\\{a} and {a}", { a: "one" }],
    ["{0}", ["first"]],
    ["{a}", { a: "{a}" }],
  ];

  for (const [template, values] of cases) {
    it(`matches pupa for ${JSON.stringify(template)}`, () => {
      expect(interpolate(template, values)).toBe(pupa(template, values));
    });
  }

  it("throws the same error for a missing placeholder", () => {
    expect(() => interpolate("{missing}", {})).toThrow("Missing a value for the placeholder: missing");
  });
});
