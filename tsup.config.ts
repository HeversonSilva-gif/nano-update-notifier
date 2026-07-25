import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    core: "src/core-entry.ts",
  },
  format: ["cjs"],
  target: "node18",
  platform: "node",
  dts: false,
  clean: true,
  minify: true,
  splitting: false,
  sourcemap: false,
  treeshake: true,
  outExtension() {
    return { js: ".cjs" };
  },
});
