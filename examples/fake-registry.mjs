import http from "node:http";
import process from "node:process";
import { fileURLToPath } from "node:url";

export async function startRegistry(distTags = { latest: "9.9.9", next: "10.0.0-beta.1" }) {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url);
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        name: decodeURIComponent(request.url.replace(/^\//, "")),
        "dist-tags": distTags,
      }),
    );
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}/`,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const registry = await startRegistry();
  console.log(`Fake registry on ${registry.url} — every package resolves to 9.9.9.`);
  console.log("Point a CLI at it with:");
  console.log(`  npm_config_registry=${registry.url} node examples/demo-cli.mjs`);
}
