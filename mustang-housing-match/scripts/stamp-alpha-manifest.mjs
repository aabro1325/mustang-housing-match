// After `vite build --mode alpha`, make the unpacked manifest match the alpha zip contract.
import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2] ?? "dist/manifest.json";
const manifest = JSON.parse(readFileSync(path, "utf8"));
if (manifest.version !== "0.1.0") {
  throw new Error(`expected manifest version 0.1.0, got ${manifest.version}`);
}
manifest.version_name = "0.1.0-alpha";
manifest.description = "Check an off-campus listing against your budget, lease, and amenities, and see a 0–100 fit score.";
writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
