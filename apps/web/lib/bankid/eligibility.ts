/**
 * Who may vote, decided from the SPAR block BankID returns.
 *
 * Pure functions, no I/O — every input arrives as a plain object, so the whole
 * rule set is testable from fixtures (`scripts/test-eligibility.mjs`). That
 * matters more than usual here: there is no GrandID sandbox, so the ineligible
 * branches can never be exercised end to end and fixtures are the only coverage
 * they will ever get.
 *
 * The shape is SPAR v2 (`userAttributes.SPARv2`), which is what our service
 * returns. Its spec carries a disclaimer that the parser has to take literally:
 *
 *   > Your implementation MUST be able to handle any of the documented
 *   > properties being excluded … MUST be able to handle a property documented
 *   > as an object, being returned as a list of said object.
 *
 * Both halves are real. In the first live capture `ns10Persondetaljer` came
 * back as an object while `ns14Folkbokforing` came back as a list of three
 * historical registrations — current, plus two the person had moved away from.
 * Reading `[0]` would have been right by luck there and wrong for anyone whose
 * entries arrive in a different order, which is why `current()` selects by
 * validity date instead.
 */

/** Vallentuna is kommunkod 0115: län 01, kommun 15. */
export const VALLENTUNA_LAN_KOD = "01";
export const VALLENTUNA_KOMMUN_KOD = "15";

export const MINIMUM_AGE = 16;

/**
 * Age is measured **at the moment of voting** (decision 3b in
 * docs/bankid-integration-plan.md). So someone who turns 16 the day before the
 * election cannot vote in August, but can on their birthday.
 *
 * Set this to a date such as `"2026-09-13"` to measure against election day
 * instead, the way the electoral roll does.
 */
export const AGE_REFERENCE_DATE: string | null = null;

/** SPAR's "still valid" sentinel on any dated record. */
const OPEN_ENDED = "9999-12-31";

export type EligibilityCode =
  | "ELIGIBLE"
  /** SPAR data absent — a configuration failure on our side, never a verdict. */
  | "SPAR_MISSING"
  | "NOT_PERSONNUMMER"
  | "PROTECTED_IDENTITY"
  | "DECEASED"
  | "DEREGISTERED"
  | "UNDERAGE"
  | "WRONG_KOMMUN"
  /** SPAR answered, but not with anything that says where the person lives. */
  | "UNKNOWN_REGISTRATION";

/** Everything the rules need, lifted out of SPAR's nesting. */
export interface SparFacts {
  idNumber: string | null;
  /** PERSONNUMMER | SAMORDNINGSNUMMER | IMMUNITETSNUMMER */
  idType: string | null;
  lanKod: string | null;
  kommunKod: string | null;
  /** e.g. "Skriven på adressen", or "På kommunen" for someone without one. */
  hemvist: string | null;
  birthDate: string | null;
  secrecy: boolean;
  protectedRegistration: boolean;
  deceasedDate: string | null;
  deregistrationCode: string | null;
}

/**
 * A flat result rather than a discriminated union: this project compiles with
 * `strict` off, and without strictNullChecks TypeScript will not narrow on a
 * boolean discriminant, so a union produces "property does not exist" errors at
 * every call site.
 */
export interface EligibilityResult {
  eligible: boolean;
  code: EligibilityCode;
  /** Swedish, safe to show the voter. Never leaks a raw SPAR field. */
  message: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Picks the currently valid entry from a property that may be an object, a list
 * of objects, or absent.
 *
 * Preference order: the record still open (`ns2DatumTill` = 9999-12-31), then
 * the one whose validity ends latest, then whatever is left. Never `[0]` —
 * SPAR does not promise an order.
 */
function current(value: unknown): Record<string, unknown> | null {
  const list = Array.isArray(value)
    ? value
    : value === undefined
      ? []
      : [value];
  const records = list
    .map(asRecord)
    .filter((entry): entry is Record<string, unknown> => entry !== null);
  if (!records.length) return null;

  const open = records.find((entry) => entry.ns2DatumTill === OPEN_ENDED);
  if (open) return open;

  return records.reduce((latest, entry) => {
    const a = typeof entry.ns2DatumTill === "string" ? entry.ns2DatumTill : "";
    const b =
      typeof latest.ns2DatumTill === "string" ? latest.ns2DatumTill : "";
    return a > b ? entry : latest;
  });
}

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/** SPAR writes JA/NEJ; the older flat format wrote J/N. Accept both. */
function isYes(value: unknown): boolean {
  const text = str(value);
  return text === "JA" || text === "J";
}

/**
 * Lifts the fields the rules need out of `userAttributes`.
 * Returns null when there is no SPAR block at all — which callers must treat as
 * a configuration failure, not as an ineligible voter.
 */
export function parseSparAttributes(
  userAttributes: Record<string, unknown> | null | undefined,
): SparFacts | null {
  const spar = asRecord(userAttributes && userAttributes.SPARv2);
  if (!spar) return null;

  const identity = current(spar.ns4PersonId) || {};
  const details = current(spar.ns10Persondetaljer) || {};
  const registration = current(spar.ns14Folkbokforing) || {};

  return {
    idNumber: str(identity.ns4IdNummer),
    idType: str(identity.ns4Typ),
    lanKod: str(registration.ns14FolkbokfordLanKod),
    kommunKod: str(registration.ns14FolkbokfordKommunKod),
    hemvist: str(registration.ns14Hemvist),
    birthDate: str(details.ns10Fodelsedatum),
    // Both flags appear at the top level and again inside Persondetaljer.
    // Either one being set is enough to stop us.
    secrecy:
      isYes(spar.ns5Sekretessmarkering) || isYes(details.ns5Sekretessmarkering),
    protectedRegistration:
      isYes(spar.ns5SkyddadFolkbokforing) ||
      isYes(details.ns5SkyddadFolkbokforing),
    deceasedDate: str(details.ns9Avlidendatum),
    deregistrationCode: str(details.ns9AvregistreringsorsakKod),
  };
}

/** "YYYY-MM-DD" → Date, or null. Rejects partial dates SPAR sometimes carries. */
function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Birth date, preferring SPAR's own field and falling back to the first eight
 * digits of the personnummer — the spec permits any property to be missing, and
 * age is too important to lose to one absent field.
 */
export function birthDateOf(facts: SparFacts): Date | null {
  const fromSpar = parseDate(facts.birthDate);
  if (fromSpar) return fromSpar;

  const digits = (facts.idNumber || "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return parseDate(
    `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`,
  );
}

/** Completed years between two dates. */
function yearsBetween(from: Date, to: Date): number {
  let age = to.getUTCFullYear() - from.getUTCFullYear();
  const beforeBirthday =
    to.getUTCMonth() < from.getUTCMonth() ||
    (to.getUTCMonth() === from.getUTCMonth() &&
      to.getUTCDate() < from.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export interface EligibilityOptions {
  /**
   * Test seam. Takes precedence over AGE_REFERENCE_DATE so fixtures stay
   * deterministic whichever way decision 3b is configured.
   */
  now?: Date;
}

/**
 * Applies the voting rules.
 *
 * Order matters. Protected identity is checked before residency because SPAR
 * withholds the address of a protected person, so their kommun would read as
 * missing and they would otherwise be rejected with a misleading reason.
 */
export function checkEligibility(
  facts: SparFacts | null,
  options: EligibilityOptions = {},
): EligibilityResult {
  // Fails closed and distinctly: this means the SPAR add-on stopped arriving,
  // which is our problem to fix, not something to tell a voter they failed.
  if (!facts) {
    return {
      eligible: false,
      code: "SPAR_MISSING",
      message:
        "Vi kunde inte hämta dina folkbokföringsuppgifter just nu. Försök igen om en stund.",
    };
  }

  if (facts.idType && facts.idType !== "PERSONNUMMER") {
    return {
      eligible: false,
      code: "NOT_PERSONNUMMER",
      message:
        "Röstning kräver ett svenskt personnummer. Samordningsnummer ger inte rösträtt.",
    };
  }

  if (facts.secrecy || facts.protectedRegistration) {
    return {
      eligible: false,
      code: "PROTECTED_IDENTITY",
      message:
        "Du har skyddade personuppgifter, så vi kan inte kontrollera din folkbokföring automatiskt. Kontakta oss så löser vi din röstning manuellt.",
    };
  }

  if (facts.deceasedDate) {
    return {
      eligible: false,
      code: "DECEASED",
      message: "Folkbokföringen medger inte röstning.",
    };
  }

  if (facts.deregistrationCode) {
    return {
      eligible: false,
      code: "DEREGISTERED",
      message:
        "Du är avregistrerad från folkbokföringen och kan därför inte rösta.",
    };
  }

  const birthDate = birthDateOf(facts);
  const reference = options.now || parseDate(AGE_REFERENCE_DATE) || new Date();
  if (!birthDate) {
    return {
      eligible: false,
      code: "UNKNOWN_REGISTRATION",
      message:
        "Vi kunde inte avgöra din ålder utifrån folkbokföringen. Kontakta oss så hjälper vi dig.",
    };
  }
  if (yearsBetween(birthDate, reference) < MINIMUM_AGE) {
    return {
      eligible: false,
      code: "UNDERAGE",
      message: `Du måste ha fyllt ${MINIMUM_AGE} år för att rösta.`,
    };
  }

  if (!facts.lanKod || !facts.kommunKod) {
    return {
      eligible: false,
      code: "UNKNOWN_REGISTRATION",
      message:
        "Vi kunde inte avgöra var du är folkbokförd. Kontakta oss så hjälper vi dig.",
    };
  }

  if (
    facts.lanKod !== VALLENTUNA_LAN_KOD ||
    facts.kommunKod !== VALLENTUNA_KOMMUN_KOD
  ) {
    return {
      eligible: false,
      code: "WRONG_KOMMUN",
      message:
        "Du är folkbokförd i en annan kommun än Vallentuna och kan därför inte rösta här.",
    };
  }

  return {
    eligible: true,
    code: "ELIGIBLE",
    message: "Du är röstberättigad i Vallentuna.",
  };
}

/** Convenience: straight from a GetSession `userAttributes` to a verdict. */
export function checkEligibilityFromAttributes(
  userAttributes: Record<string, unknown> | null | undefined,
  options: EligibilityOptions = {},
): EligibilityResult {
  return checkEligibility(parseSparAttributes(userAttributes), options);
}
