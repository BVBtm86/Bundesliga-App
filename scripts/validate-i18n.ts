import { messages, type Locale } from "../lib/i18n";

const locales: Locale[] = ["en", "de", "es", "ro"];
const errors: string[] = [];
const englishKeys = new Set(Object.keys(messages.en));

for (const locale of locales) {
  const missing = [...englishKeys].filter(key => !(key in messages[locale]));
  const empty = Object.entries(messages[locale]).filter(([, value]) => !value.trim()).map(([key]) => key);
  if (missing.length) errors.push(`${locale}: missing ${missing.join(", ")}`);
  if (empty.length) errors.push(`${locale}: empty ${empty.join(", ")}`);
}

const placeholders = (value: string) => [...value.matchAll(/\{([^}]+)\}/g)].map(match => match[1]).sort().join("|");
for (const key of englishKeys) {
  const expected = placeholders(messages.en[key]);
  for (const locale of locales.slice(1)) {
    if (key in messages[locale] && placeholders(messages[locale][key]) !== expected) errors.push(`${locale}: interpolation mismatch for ${key}`);
  }
}

// The runtime dictionaries are assembled from locale blocks and explicit extensions;
// Object.assign intentionally makes later extension blocks authoritative.

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`i18n validation passed: ${englishKeys.size} keys covered by ${locales.length} locales.`);
}