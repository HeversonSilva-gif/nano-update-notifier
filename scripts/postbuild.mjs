import fs from "node:fs";

fs.copyFileSync("types/index.d.ts", "dist/index.d.ts");
fs.copyFileSync("types/index.d.cts", "dist/index.d.cts");
fs.writeFileSync("dist/index.cjs", '"use strict";module.exports=require("./core.cjs").createNotifier;\n');
fs.writeFileSync("dist/index.js", 'import core from "./core.cjs";export default core.createNotifier;\n');
fs.writeFileSync(
  "dist/check.cjs",
  '"use strict";require("./core.cjs").runDetachedCheck();\n',
);
