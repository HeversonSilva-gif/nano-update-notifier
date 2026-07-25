import boxen from "boxen";
import { describe, expect, it } from "vitest";
import { box, stripAnsi, visualWidth } from "../src/box.js";

describe("visualWidth", () => {
  it("handles ANSI, CJK, combining marks, and emoji graphemes", () => {
    expect(visualWidth("\u001B[32mhello\u001B[39m")).toBe(5);
    expect(visualWidth("更新")).toBe(4);
    expect(visualWidth("e\u0301")).toBe(1);
    expect(visualWidth("👩🏽‍💻")).toBe(2);
    expect(visualWidth("👨‍👩‍👧‍👦")).toBe(2);
    expect(visualWidth("🇧🇷")).toBe(2);
  });

  it("removes OSC hyperlinks as well as SGR color codes", () => {
    const linked = "\u001B]8;;https://example.com\u0007text\u001B]8;;\u0007";
    expect(stripAnsi(linked)).toBe("text");
  });
});

describe("box", () => {
  it("keeps every rendered line rectangular", () => {
    const lines = box("更新可用\n👩🏽‍💻 done", { margin: 0, padding: 1 }).split("\n");
    expect(new Set(lines.map(visualWidth)).size).toBe(1);
  });

  it("matches boxen for the notifier's supported common options", () => {
    const options = {
      padding: 1,
      margin: 1,
      textAlignment: "center" as const,
      borderStyle: "round" as const,
    };
    expect(box("Update available\nRun npm i demo", options)).toBe(
      boxen("Update available\nRun npm i demo", options),
    );
  });

  it("colors only the border on content lines", () => {
    const previousForce = process.env.FORCE_COLOR;
    const previousNoColor = process.env.NO_COLOR;
    process.env.FORCE_COLOR = "1";
    delete process.env.NO_COLOR;
    try {
      expect(box("hello", { borderColor: "yellow", borderStyle: "round" })).toBe(
        "\u001B[33m╭─────╮\u001B[39m\n" +
          "\u001B[33m│\u001B[39mhello\u001B[33m│\u001B[39m\n" +
          "\u001B[33m╰─────╯\u001B[39m",
      );
    } finally {
      if (previousForce === undefined) delete process.env.FORCE_COLOR;
      else process.env.FORCE_COLOR = previousForce;
      if (previousNoColor === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = previousNoColor;
    }
  });

  it("supports asymmetric spacing and custom border characters", () => {
    const rendered = box("x", {
      margin: { left: 2, right: 1 },
      padding: { top: 1, right: 2, bottom: 0, left: 1 },
      borderStyle: {
        topLeft: "a",
        topRight: "b",
        bottomRight: "c",
        bottomLeft: "d",
        left: "l",
        right: "r",
        top: "t",
        bottom: "u",
      },
    });
    expect(rendered).toContain("  a");
    expect(rendered).toContain("d");
  });
});
