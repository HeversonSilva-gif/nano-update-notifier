import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLatest, resolveRegistry } from "../src/registry.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("resolveRegistry", () => {
  it("uses the public registry by default", () => {
    expect(resolveRegistry("lodash", {}, "")).toBe("https://registry.npmjs.org/");
  });

  it("honours environment and scope-specific npm configuration", () => {
    const npmrc = [
      "registry=https://mirror.internal",
      "@acme:registry=https://acme.jfrog.io/npm",
    ].join("\n");
    expect(resolveRegistry("lodash", { npm_config_registry: "https://env.internal" }, npmrc)).toBe(
      "https://env.internal/",
    );
    expect(resolveRegistry("@acme/tool", {}, npmrc)).toBe("https://acme.jfrog.io/npm/");
  });

  it("expands environment variables in npmrc values", () => {
    expect(
      resolveRegistry("demo", { PRIVATE_REGISTRY: "https://packages.internal" }, "registry=${PRIVATE_REGISTRY}"),
    ).toBe("https://packages.internal/");
  });
});

describe("fetchLatest", () => {
  it("requests abbreviated metadata and the selected dist-tag", async () => {
    const fetchSpy = vi.fn(async (_url: string | URL, _init: RequestInit) =>
      new Response(JSON.stringify({ "dist-tags": { next: "3.1.4" } })),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await expect(fetchLatest("@acme/demo", "next", { npmrc: "" })).resolves.toBe("3.1.4");
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain("@acme%2Fdemo");
    expect(String((init.headers as Record<string, string>).accept)).toContain("install-v1+json");
  });

  it("sends a registry-scoped bearer token", async () => {
    const fetchSpy = vi.fn(async (_url: string | URL, _init: RequestInit) =>
      new Response(JSON.stringify({ "dist-tags": { latest: "1.0.0" } })),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const npmrc = [
      "registry=https://registry.internal/npm/",
      "//registry.internal/npm/:_authToken=${TOKEN}",
    ].join("\n");

    await fetchLatest("demo", "latest", { env: { TOKEN: "secret" }, npmrc });
    expect((fetchSpy.mock.calls[0]![1].headers as Record<string, string>).authorization).toBe(
      "Bearer secret",
    );
  });

  it("accepts registry credentials from npm_config environment variables", async () => {
    const fetchSpy = vi.fn(async (_url: string | URL, _init: RequestInit) =>
      new Response(JSON.stringify({ "dist-tags": { latest: "1.0.0" } })),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await fetchLatest("demo", "latest", {
      env: {
        npm_config_registry: "https://registry.internal/",
        "npm_config_//registry.internal/:_authToken": "environment-secret",
      },
      npmrc: "",
    });
    expect((fetchSpy.mock.calls[0]![1].headers as Record<string, string>).authorization).toBe(
      "Bearer environment-secret",
    );
  });

  it("rejects non-ok, malformed, and missing-tag responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(fetchLatest("demo", "latest", { npmrc: "" })).rejects.toThrow();

    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>")));
    await expect(fetchLatest("demo", "latest", { npmrc: "" })).rejects.toThrow();

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ "dist-tags": {} }))));
    await expect(fetchLatest("demo", "next", { npmrc: "" })).rejects.toThrow();
  });

  it("aborts a request at the configured timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
        }),
      ),
    );
    await expect(fetchLatest("demo", "latest", { npmrc: "", timeoutMs: 5 })).rejects.toThrow();
  });
});
