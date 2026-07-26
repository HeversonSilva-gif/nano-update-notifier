import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const LIMIT_BYTES = 32 * 1024;
const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
const runtimeDependencies = [
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.peerDependencies ?? {}),
];

if (runtimeDependencies.length > 0) {
  console.error(`Runtime dependencies present: ${runtimeDependencies.join(", ")}`);
  process.exit(1);
}

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? files(target) : [target];
  });
}

const packageFiles = ["package.json", "README.md", "LICENSE", ...files("dist")].filter((file) =>
  fs.existsSync(file),
);
const unpackedSize = packageFiles.reduce((total, file) => total + fs.statSync(file).size, 0);

console.log(`${packageFiles.length} files, ${unpackedSize} bytes unpacked`);
if (unpackedSize > LIMIT_BYTES) {
  console.error(`Over budget: ${unpackedSize} > ${LIMIT_BYTES}`);
  process.exit(1);
}
