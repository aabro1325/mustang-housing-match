// Playwright fixture pages are served on localhost. The store manifest does not ask for that host.
import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2] ?? "dist/manifest.json";
const manifest = JSON.parse(readFileSync(path, "utf8"));
const extra = ["http://localhost/*", "http://127.0.0.1/*"];
manifest.host_permissions = [...new Set([...(manifest.host_permissions ?? []), ...extra])];
writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
