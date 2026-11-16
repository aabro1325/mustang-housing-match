import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const release = fileURLToPath(new URL("../release/", import.meta.url));
const out = fileURLToPath(new URL("../release/mustang-housing-match-1.0.0.zip", import.meta.url));
mkdirSync(release, { recursive: true });
rmSync(out, { force: true });
execFileSync("zip", ["-r", "-q", out, ".", "-x", "*.map"], { cwd: dist });
console.log(out);
