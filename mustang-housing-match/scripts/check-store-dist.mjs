// Checks the unpacked production build. Does not print secret values.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
const errors = [];

if (manifest.manifest_version !== 3) errors.push("manifest_version must be 3");
if (manifest.version !== "1.0.0") errors.push(`version is ${manifest.version}, expected 1.0.0`);
if (manifest.version_name) errors.push("store manifest should not set version_name");
const hosts = manifest.host_permissions ?? [];
for (const banned of ["http://localhost/*", "http://127.0.0.1/*", "https://*/*", "<all_urls>"]) {
  if (hosts.includes(banned)) errors.push(`host permission not allowed in the store build: ${banned}`);
}
if (manifest.optional_host_permissions?.length) errors.push("store manifest should not request optional host permissions");
for (const size of ["16", "32", "48", "128"]) {
  const icon = manifest.icons?.[size];
  if (!icon) errors.push(`missing ${size}px icon`);
  else if (!existsSync(join(dist, icon))) errors.push(`icon file missing: ${icon}`);
}
for (const file of ["background.js", "capture.js", "src/sidepanel/index.html", "src/options/index.html"]) {
  if (!existsSync(join(dist, file))) errors.push(`missing ${file}`);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(js|html|css|json)$/.test(name)) out.push(path);
  }
  return out;
}

const keyLiteral = /(?:api_key|apikey|Authorization)["'\s:=]+["'][A-Za-z0-9_\-]{20,}["']/;
for (const file of walk(dist)) {
  const text = readFileSync(file, "utf8");
  if (keyLiteral.test(text)) errors.push(`${file} contains a key-like literal`);
  if (text.includes("0.1.0-alpha")) errors.push(`${file} still says 0.1.0-alpha`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Store dist looks packable.");
