/* THADD OS · bundle gate — the definitive named-import/export check.
   esbuild fails on any bad import, which per-file `node --check` cannot see.
   Produces tools/tests/bundle.js, the input for smoke.mjs and deep.mjs. */
import { build } from "esbuild";
import { statSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const r = await build({
  entryPoints: [ROOT + "/desktop/js/kernel.js"], bundle: true, format: "iife",
  outfile: HERE + "/bundle.js", target: ["chrome100"], logLevel: "warning",
});
if (r.errors.length) { console.error("❌ bundle failed\n", r.errors); process.exit(1); }
console.log(`✅ bundle (${statSync(HERE + "/bundle.js").size} bytes, 0 errors)`);
