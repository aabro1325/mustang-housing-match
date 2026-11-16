// Fail the store package if a commute key would be inlined. Prints lengths only, never values.
import { readFileSync, existsSync } from "node:fs";

const FILES = [".env", ".env.local", ".env.production", ".env.production.local"];
const NAMES = ["VITE_ORS_API_KEY", "VITE_TRANSITLAND_API_KEY"];

function assignment(text, name) {
  const line = text.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`) || entry.startsWith(`${name} =`));
  if (!line) return "";
  return line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "").replace(/\s+#.*$/, "");
}

let blocked = false;
for (const file of FILES) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const name of NAMES) {
    const value = assignment(text, name);
    if (value) {
      console.error(`${file} sets ${name} (length ${value.length}). Unset it before packaging. Keys belong in the options page.`);
      blocked = true;
    }
  }
}
for (const name of NAMES) {
  const value = process.env[name]?.trim();
  if (value) {
    console.error(`Environment variable ${name} is set (length ${value.length}). Unset it before packaging.`);
    blocked = true;
  }
}
if (blocked) process.exit(1);
console.log("No commute API keys are set for this package.");
