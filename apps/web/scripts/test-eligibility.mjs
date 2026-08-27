#!/usr/bin/env node
/**
 * Fixture table for lib/bankid/eligibility.ts.
 *
 *   pnpm eligibility                              # run the fixtures
 *   pnpm eligibility --fixture <getsession.json>  # also judge a real capture
 *
 * There is no GrandID sandbox, so every branch except WRONG_KOMMUN is
 * unreachable end to end — these fixtures are the only coverage they will ever
 * have. They are synthetic on purpose: a real capture carries a personal
 * number and cannot be committed. Shapes are copied from the live response,
 * including the awkward parts (a `ns14Folkbokforing` list of past addresses,
 * a `ns10Persondetaljer` object rather than a list).
 *
 * Exits non-zero on any mismatch, so it can gate a commit.
 */

import { readFileSync } from "fs";
import { register } from "module";

register(new URL("./ts-resolve-hooks.mjs", import.meta.url));

const { checkEligibilityFromAttributes, parseSparAttributes } =
  await import("../lib/bankid/eligibility.ts");

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

/** Builds a SPARv2 block, letting each case override just what it cares about. */
function spar({
  idType = "PERSONNUMMER",
  idNumber = "200405257577",
  birthDate = "2004-05-25",
  lanKod = "01",
  kommunKod = "15",
  secrecy = "NEJ",
  protectedRegistration = "NEJ",
  deceased,
  deregistered,
  registration,
  details,
} = {}) {
  return {
    SPARv2: {
      ns4PersonId: {
        ns4IdNummer: idNumber === null ? undefined : idNumber,
        ns4Typ: idType === null ? undefined : idType,
      },
      ns5Sekretessmarkering: secrecy,
      ns5SkyddadFolkbokforing: protectedRegistration,
      ns10Persondetaljer: details || {
        ns2DatumFrom: "2010-08-28",
        ns2DatumTill: "9999-12-31",
        // null means "SPAR omitted this field"; undefined would silently pick
        // up the destructuring default above and test nothing.
        ns10Fodelsedatum: birthDate === null ? undefined : birthDate,
        ns9Avlidendatum: deceased,
        ns9AvregistreringsorsakKod: deregistered,
      },
      ns14Folkbokforing: registration || {
        ns2DatumFrom: "2024-08-02",
        ns2DatumTill: "9999-12-31",
        ns14FolkbokfordLanKod: lanKod,
        ns14FolkbokfordKommunKod: kommunKod,
        ns14Hemvist: "Skriven på adressen",
      },
    },
  };
}

const CASES = [
  {
    name: "Vallentuna resident, adult",
    attributes: spar(),
    expect: "ELIGIBLE",
  },
  {
    name: "no SPAR block at all (add-on lost)",
    attributes: { personalNumber: "200405257577", name: "Test" },
    expect: "SPAR_MISSING",
  },
  {
    name: "empty userAttributes",
    attributes: {},
    expect: "SPAR_MISSING",
  },
  {
    name: "samordningsnummer",
    attributes: spar({ idType: "SAMORDNINGSNUMMER" }),
    expect: "NOT_PERSONNUMMER",
  },
  {
    name: "sekretessmarkering",
    attributes: spar({ secrecy: "JA" }),
    expect: "PROTECTED_IDENTITY",
  },
  {
    name: "skyddad folkbokföring",
    attributes: spar({ protectedRegistration: "JA" }),
    expect: "PROTECTED_IDENTITY",
  },
  {
    name: "protected, and kommun withheld as a result",
    attributes: spar({
      secrecy: "JA",
      registration: { ns2DatumTill: "9999-12-31" },
    }),
    // Must not come back WRONG_KOMMUN — the address is missing because it is
    // protected, not because they live elsewhere.
    expect: "PROTECTED_IDENTITY",
  },
  {
    name: "old flat J/N spelling still understood",
    attributes: spar({ secrecy: "J" }),
    expect: "PROTECTED_IDENTITY",
  },
  {
    name: "deceased",
    attributes: spar({ deceased: "2025-02-01" }),
    expect: "DECEASED",
  },
  {
    name: "deregistered (utvandrad)",
    attributes: spar({ deregistered: "UV" }),
    expect: "DEREGISTERED",
  },
  // Age cases pin `now` explicitly so they test the rule, not whichever way
  // AGE_REFERENCE_DATE happens to be configured.
  {
    name: "16th birthday is today",
    attributes: spar({ birthDate: "2010-06-01", idNumber: "201006017577" }),
    now: new Date("2026-06-01T00:00:00Z"),
    expect: "ELIGIBLE",
  },
  {
    name: "16th birthday is tomorrow",
    attributes: spar({ birthDate: "2010-06-02", idNumber: "201006027577" }),
    now: new Date("2026-06-01T00:00:00Z"),
    expect: "UNDERAGE",
  },
  {
    name: "clearly under 16",
    attributes: spar({ birthDate: "2015-01-01", idNumber: "201501017577" }),
    expect: "UNDERAGE",
  },
  {
    name: "birth date missing, falls back to personnummer",
    attributes: spar({ birthDate: null, idNumber: "201501017577" }),
    expect: "UNDERAGE",
  },
  {
    // UNKNOWN_AGE, not UNKNOWN_REGISTRATION: age and residency both being
    // undecidable used to share one code, which stopped working once the verdict
    // started being cached on User.eligibility — storage keeps the code and
    // discards everything else, so one code cannot carry two explanations.
    name: "no birth date and no id number",
    attributes: spar({ birthDate: null, idNumber: null }),
    expect: "UNKNOWN_AGE",
  },
  {
    name: "idType absent — BankID only issues to personnummer holders",
    attributes: spar({ idType: null }),
    expect: "ELIGIBLE",
  },
  {
    name: "Göteborg (the real captured case)",
    attributes: spar({ lanKod: "14", kommunKod: "80" }),
    expect: "WRONG_KOMMUN",
  },
  {
    name: "Stockholms stad — same län, different kommun",
    attributes: spar({ lanKod: "01", kommunKod: "80" }),
    expect: "WRONG_KOMMUN",
  },
  {
    name: "kommun 15 in the wrong län",
    attributes: spar({ lanKod: "25", kommunKod: "15" }),
    expect: "WRONG_KOMMUN",
  },
  {
    name: "no registration data at all",
    attributes: spar({ registration: { ns2DatumTill: "9999-12-31" } }),
    expect: "UNKNOWN_REGISTRATION",
  },
  {
    name: "registration history — current entry is Vallentuna, not first",
    attributes: spar({
      registration: [
        {
          ns2DatumFrom: "2020-01-01",
          ns2DatumTill: "2024-08-02",
          ns14FolkbokfordLanKod: "14",
          ns14FolkbokfordKommunKod: "80",
        },
        {
          ns2DatumFrom: "2024-08-02",
          ns2DatumTill: "9999-12-31",
          ns14FolkbokfordLanKod: "01",
          ns14FolkbokfordKommunKod: "15",
        },
      ],
    }),
    expect: "ELIGIBLE",
  },
  {
    name: "registration history — moved away from Vallentuna",
    attributes: spar({
      registration: [
        {
          ns2DatumFrom: "2026-01-10",
          ns2DatumTill: "9999-12-31",
          ns14FolkbokfordLanKod: "14",
          ns14FolkbokfordKommunKod: "80",
        },
        {
          ns2DatumFrom: "2020-01-01",
          ns2DatumTill: "2026-01-10",
          ns14FolkbokfordLanKod: "01",
          ns14FolkbokfordKommunKod: "15",
        },
      ],
    }),
    expect: "WRONG_KOMMUN",
  },
  {
    name: "no open-ended entry — falls back to the latest",
    attributes: spar({
      registration: [
        {
          ns2DatumTill: "2020-01-01",
          ns14FolkbokfordLanKod: "14",
          ns14FolkbokfordKommunKod: "80",
        },
        {
          ns2DatumTill: "2024-01-01",
          ns14FolkbokfordLanKod: "01",
          ns14FolkbokfordKommunKod: "15",
        },
      ],
    }),
    expect: "ELIGIBLE",
  },
  {
    name: "persondetaljer as a list",
    attributes: spar({
      details: [
        {
          ns2DatumTill: "2015-01-01",
          ns10Fodelsedatum: "1990-01-01",
        },
        {
          ns2DatumTill: "9999-12-31",
          ns10Fodelsedatum: "2015-01-01",
        },
      ],
    }),
    expect: "UNDERAGE",
  },
  // The development override waives *where* someone lives and nothing else.
  {
    name: "bypass: Göteborg becomes eligible",
    attributes: spar({ lanKod: "14", kommunKod: "80" }),
    options: { allowAnyKommun: true },
    expect: "ELIGIBLE",
  },
  {
    name: "bypass: no registration data at all is fine too",
    attributes: spar({ registration: { ns2DatumTill: "9999-12-31" } }),
    options: { allowAnyKommun: true },
    expect: "ELIGIBLE",
  },
  {
    name: "bypass does NOT waive age",
    attributes: spar({ birthDate: "2015-01-01", idNumber: "201501017577" }),
    options: { allowAnyKommun: true },
    expect: "UNDERAGE",
  },
  {
    name: "bypass does NOT waive protected identity",
    attributes: spar({ secrecy: "JA" }),
    options: { allowAnyKommun: true },
    expect: "PROTECTED_IDENTITY",
  },
  {
    name: "bypass does NOT waive samordningsnummer",
    attributes: spar({ idType: "SAMORDNINGSNUMMER" }),
    options: { allowAnyKommun: true },
    expect: "NOT_PERSONNUMMER",
  },
  {
    name: "bypass does NOT waive a missing SPAR block",
    attributes: {},
    options: { allowAnyKommun: true },
    expect: "SPAR_MISSING",
  },
  {
    name: "hemvist 'På kommunen' still counts as resident",
    attributes: spar({
      registration: {
        ns2DatumTill: "9999-12-31",
        ns14FolkbokfordLanKod: "01",
        ns14FolkbokfordKommunKod: "15",
        ns14Hemvist: "På kommunen",
      },
    }),
    expect: "ELIGIBLE",
  },
];

let failures = 0;
console.log(`\n  ${bold("Eligibility fixtures")}\n`);

for (const testCase of CASES) {
  const result = checkEligibilityFromAttributes(testCase.attributes, {
    now: testCase.now,
    ...testCase.options,
  });
  const pass = result.code === testCase.expect;
  if (!pass) failures += 1;
  console.log(
    `  ${pass ? green("✓") : red("✗")} ${testCase.name.padEnd(52)} ${
      pass
        ? dim(result.code)
        : red(`${result.code} — expected ${testCase.expect}`)
    }`,
  );
}

console.log(
  `\n  ${failures ? red(`${failures} failed`) : green("all passed")} ` +
    dim(`(${CASES.length} cases)\n`),
);

// Optionally judge a real capture. Kept out of the fixture set because it holds
// a personal number and must never be committed.
const fixtureIndex = process.argv.indexOf("--fixture");
if (fixtureIndex !== -1) {
  const path = process.argv[fixtureIndex + 1];
  const body = JSON.parse(readFileSync(path, "utf8"));
  const attributes = body.userAttributes || body;
  const facts = parseSparAttributes(attributes);
  const result = checkEligibilityFromAttributes(attributes);

  console.log(`  ${bold("Real capture")} ${dim(path)}\n`);
  if (facts) {
    console.log(
      `    län/kommun : ${facts.lanKod}/${facts.kommunKod}   hemvist: ${facts.hemvist}`,
    );
    console.log(
      `    born       : ${facts.birthDate}   idType: ${facts.idType}`,
    );
    console.log(
      `    protected  : sekretess=${facts.secrecy} skyddad=${facts.protectedRegistration}`,
    );
  }
  console.log(
    `    verdict    : ${result.eligible ? green(result.code) : red(result.code)}`,
  );
  console.log(`    message    : ${dim(result.message)}\n`);
}

process.exit(failures ? 1 : 0);
