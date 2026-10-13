# THADD OS · test harness

Everything here runs head-less in Node — no browser, no X server, no VM.

| command | what it proves |
|---|---|
| `bash tools/syntax-check.sh` | all 21 shell modules parse as ESM |
| `bash tools/build-shell.sh` | `js/kernel.js` bundles into one classic script (also the import/export gate) |
| `node bundle.mjs` | same gate, faster, writes `bundle.js` for the smoke runs |
| `node smoke.mjs` | boots the shell in jsdom: boot → lock → desktop, all 63 apps launch, 20 assertions |
| `node deep.mjs` | sweeps all 190 terminal commands and drives JARVIS with a mocked Groq stream (tool-calling included) |

```bash
cd tools/tests && npm install && node bundle.mjs && node smoke.mjs && node deep.mjs
```

`bundle.js` is generated; it is ignored by git. The canonical shipped artefact is
`desktop/dist/thadd-shell.js`, produced by `tools/build-shell.sh`.
