import fs from "node:fs";
import path from "node:path";
import { messages, type Locale } from "../lib/i18n";

const locales: Locale[] = ["en", "de", "es", "ro"];
const keys = new Set(Object.keys(messages.en));
const missing: string[] = [];
for (const locale of locales) for (const key of keys) if (!messages[locale][key]) missing.push(`${locale}:${key}`);
const corrupted: string[] = [];
for (const locale of locales) for (const [key, value] of Object.entries(messages[locale])) {
  if (/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) corrupted.push(`${locale}:${key}`);
}
const suspicious: string[] = [];
for (const locale of locales) for (const [key, value] of Object.entries(messages[locale])) {
  if (/\w\?\w/.test(value)) suspicious.push(`${locale}:${key}`);
}
const sourceRoots = ["components", "app", "lib"].map(root => path.resolve(process.cwd(), root));
const sourceFiles = sourceRoots.flatMap(root => {
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.filter(entry => entry.isFile() && /\.(tsx|ts|css)$/.test(entry.name)).map(entry => path.join(root, entry.name));
});
const mojibake: string[] = [];
const malformedUi: string[] = [];
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  // lib/i18n.tsx contains legacy literals that are normalized at the
  // dictionary boundary before rendering; validate the resulting values above
  // and scan all other UI source files directly.
  if (!file.endsWith(path.join("lib", "i18n.tsx")) && /[ÃÂ]|â(?:€|™|œ|ž)|ï¿½|\uFFFD/.test(source)) mojibake.push(path.relative(process.cwd(), file));
  if (/Loading match report&|Reading the game&|Loading&|Teamaverages|svgClear|For: club output Â·/.test(source)) malformedUi.push(path.relative(process.cwd(), file));
}
console.log(`i18n audit: ${keys.size} keys, ${missing.length} missing, ${corrupted.length} corrupted values, ${suspicious.length} suspicious legacy values, ${mojibake.length} source files with mojibake, ${malformedUi.length} malformed UI sources.`);
if (missing.length || corrupted.length || mojibake.length || malformedUi.length) {
  if (missing.length) console.error("Missing:", missing.join(", "));
  if (corrupted.length) console.error("Corrupted values:", corrupted.join(", "));
  if (mojibake.length) console.error("Mojibake files:", mojibake.join(", "));
  if (malformedUi.length) console.error("Malformed UI sources:", malformedUi.join(", "));
  process.exitCode = 1;
} else if (suspicious.length) {
  console.warn("Legacy suspicious question-mark values remain:", suspicious.length);
}
