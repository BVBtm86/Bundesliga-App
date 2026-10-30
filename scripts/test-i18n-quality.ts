import { messages, type Locale } from "../lib/i18n";

const locales: Locale[] = ["en", "de", "es", "ro"];
const expected: Record<Locale, Record<string, string>> = {
  en: {
    "report.timeline": "Timeline",
    "report.stats": "Game Statistics",
    "explorer.positional": "Positional Analysis",
    "nav.overview": "Overview",
    "nav.players": "Players",
    "nav.standings": "Standings",
  },
  de: {
    "nav.overview": "\u00DCbersicht",
    "nav.teams": "Mannschaft",
    "nav.players": "Spieler",
    "nav.standings": "Tabelle",
    "standings.winShort": "S",
    "standings.drawShort": "U",
    "standings.lossShort": "N",
  },
  es: {
    "report.timeline": "Cronolog\u00EDa",
    "report.stats": "Estad\u00EDsticas del partido",
    "explorer.positional": "An\u00E1lisis posicional",
  },
  ro: {
    "nav.players": "Juc\u0103tori",
    "nav.standings": "Clasament",
    "stats.metric.shots": "\u0218uturi totale",
    "report.substitutions": "\u00CEnlocuiri",
    "explorer.positional": "Analiz\u0103 pozi\u021Bional\u0103",
    "standings.form": "Form\u0103",
    "standings.winShort": "V",
    "standings.drawShort": "E",
    "standings.lossShort": "Î",
    "filters.fromMatchday": "De la etapă",
    "filters.toMatchday": "Până la etapă",
  },
};

const errors: string[] = [];
const suspiciousValues: string[] = [];
const selectorExpected: Record<Locale, Record<string, string>> = {
  en: {"settings.language":"Language", "settings.english":"English", "settings.german":"Deutsch", "settings.spanish":"Español", "settings.romanian":"Română"},
  de: {"settings.language":"Sprache", "settings.english":"English", "settings.german":"Deutsch", "settings.spanish":"Español", "settings.romanian":"Română"},
  es: {"settings.language":"Idioma", "settings.english":"English", "settings.german":"Deutsch", "settings.spanish":"Español", "settings.romanian":"Română"},
  ro: {"settings.language":"Limbă", "settings.english":"English", "settings.german":"Deutsch", "settings.spanish":"Español", "settings.romanian":"Română"},
};
for (const locale of locales) {
  for (const [key, value] of Object.entries(expected[locale])) {
    if (messages[locale][key] !== value) errors.push(locale + ":" + key + " expected " + JSON.stringify(value) + " got " + JSON.stringify(messages[locale][key]));
  }
  for (const [key, value] of Object.entries(selectorExpected[locale])) {
    if (messages[locale][key] !== value) errors.push(locale + ":" + key + " expected " + JSON.stringify(value) + " got " + JSON.stringify(messages[locale][key]));
  }
  for (const [key, value] of Object.entries(messages[locale])) {
    if (value.includes("\uFFFD")) errors.push(locale + ":" + key + " contains replacement character");
    if (/\w\?\w/.test(value)) suspiciousValues.push(locale + ":" + key);
  }
}

const placeholders = (value: string) => [...value.matchAll(/\{([^}]+)\}/g)].map(m => m[1]).sort().join("|");
for (const key of ["ui.eventsCount.one", "ui.eventsCount.other", "ui.passDataNote.events.one", "ui.passDataNote.events.other"]) {
  const expectedPlaceholders = placeholders(messages.en[key]);
  for (const locale of locales) if (placeholders(messages[locale][key] ?? "") !== expectedPlaceholders) errors.push(locale + ":" + key + " interpolation mismatch");
}
for (const locale of locales) {
  if (!messages[locale]["ui.eventsCount.other"]?.includes("{count}")) errors.push(locale + ": event count interpolation missing");
}
const spanishDate = new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date("2011-05-14T13:30:00Z"));
if (!spanishDate.includes("mayo") || !spanishDate.includes("2011")) errors.push("Spanish long date formatting is not localized");
for (const key of ["report.timeline", "report.stats", "explorer.positional"]) {
  for (const locale of locales.slice(1)) if (/\w\?\w/.test(messages[locale][key] ?? "")) errors.push(locale + ":" + key + " has suspicious question mark");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("i18n quality checks passed for " + locales.length + " locales.");
  if (suspiciousValues.length) console.warn("Warning: legacy translations still contain suspicious question marks in " + suspiciousValues.length + " values.");
}


