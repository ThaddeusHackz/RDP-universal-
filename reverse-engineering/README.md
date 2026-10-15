# THADD OS — `rea`, the reverse-engineering pass

The login banner of every THADD OS image ends with `rea --help`, and this
directory is what answers it. `rea` looks at an artefact, says what it is, opens
what it can, pulls out what is interesting, and writes the result down as an
agent-ready report. It is installed to `/usr/local/bin/rea` by the image's
identity hook from `/opt/thadd/reverse-engineering/rea`.

```
rea <file|dir> …            identify, then suggest the next step
rea --identify  <file>      format, headers, hashes, packer and entropy evidence
rea --strings   <file>      URLs, keys, paths, commands, registry keys
rea --unpack    <file>      ZIP, tar (+gz/bz2/xz), ar/deb (recursively), ASAR, streams
rea --electron  <dir|asar>  unpack an Electron app, read package.json and main.js
rea --dotnet    <file>      CLR header, metadata streams, IL when monodis is present
rea --report    <file>      a markdown report for an examiner or an agent
```

Every mode takes `--json`; `--out` chooses where extraction or the report goes,
`--max-mb` caps how much of a large artefact is read, and `--min` sets the
shortest string worth keeping.

## Why it is written this way

* **Standard library only.** A live ISO may have no network, so `rea` does its
  own ELF/PE/Mach-O/Java parsing, its own ZIP/tar/ar/ASAR readers, its own
  entropy and string extraction. Nothing here needs pip, and nothing here needs
  the internet.
* **It degrades honestly.** Optional helpers — `7z`, `binwalk`, `unsquashfs`,
  `upx`, `cabextract`, `monodis`, `objdump` — are used when the image has them,
  and each missing one is *named*, in the output and in the report, together
  with the `thadd-toolbox` command that would install it. It never invents a
  result it could not compute.
* **It reads; it never runs.** The artefact is opened, parsed and copied. It is
  never executed, mounted, or written to — including when it is an executable,
  and including when the analysis is wrong.
* **It cannot write outside its output directory.** Every extraction path is
  resolved and checked, so a crafted archive (absolute paths, `..`, symlinked
  parents) fails loudly instead of writing somewhere else. Entry counts and total
  size are capped so a zip bomb ends as an error message, not as a full disk.

## The method, and where it comes from

The discipline — *look at the artefact, form a hypothesis, verify it against the
bytes, and only then claim it* — follows **[morluto/rea](https://github.com/morluto/rea)**
("Reverse Engineered Anything"), an MCP-based toolkit for reverse engineering
binaries, applications and runtime behaviour down to the byte level. THADD OS
takes the same stance on storage in `thadd/forensics/`, where the readers are
written from scratch against the published on-disk formats.

Upstream `rea-agents` (the MCP server and agent CLI, ~25 MB from npm) is *not*
baked into the image: it would double the size of this piece of the OS for an
agent front end, and it needs Node ≥ 22.19 to run. It is a one-liner when you
want it:

```bash
thadd-runtimes rea-agents      # or: npm install -g rea-agents
```

## Tests

`iso/tests/test_build_sh.py` builds a real Electron ASAR in the exact layout
`asar`/`chromium-pickle-js` write, runs the *staged* `rea` over it, and requires
the extracted file to come back byte for byte. `iso/verify.sh` requires
`usr/local/bin/rea` and the staged copy in the finished squashfs, and the
in-image self-test runs `rea` because the banner promises it.

## Limits, stated plainly

* No decompiler, no disassembler and no debugger: `rea` reads structure and
  strings. For IL, use `monodis`/`ilspycmd`; for native code, Ghidra, radare2 or
  `objdump`, which the security sets install.
* Entropy is computed per 4 KiB block over the first few MiB only — enough to
  notice packing or encryption, not a substitute for a packer-specific tool.
* The ASAR reader covers the format `asar` writes. Custom or patched headers are
  reported as "not an ASAR" rather than guessed at.
* `--strings` matches patterns; it is a lead generator, not a secret scanner.
  Treat anything it prints as a *candidate* and verify it before it reaches a
  report you sign.
