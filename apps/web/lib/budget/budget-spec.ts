/**
 * A budget process described as data — the one way a budget is created.
 *
 * Both creation paths produce a `BudgetSpec` and then go through the same
 * review and the same save:
 *   - a budget file (JSON) uploaded in admin, or run through
 *     `pnpm budget-import` — e.g. data/budgets/vallentuna-2027.json, read out
 *     of the municipality's plan including the parties' own proposals;
 *   - a PDF read by the AI extractor in admin, converted to a spec client-side.
 *
 * `planBudgetImport()` builds the BudgetSession fields and a preview (posts,
 * slider spans, locked posts, each proposal's balance, warnings) without
 * writing anything; `applyBudgetImport()` saves exactly what the preview
 * showed. Amounts in a spec are mnkr, posts are referred to by name.
 */

import {
  alternativeMarkers,
  budgetTotals,
  expensePostRange,
  incomePostRange,
  isUnderfunded,
} from "@repo/types";
import { BudgetSession, User } from "../models";
import { applyPostImages, postImageMap } from "./post-images";
import { ensureUniqueSessionId, generateSessionId } from "./session-id";

const MNKR = 1_000_000;

export interface BudgetSpecPost {
  name: string;
  amount: number;
  /** Counted in the balance, not adjustable. */
  fixed?: boolean;
  /** Own slider span, ± percent (default 70–130%). */
  adjustPercent?: number;
  /** Short explanation shown with the post. */
  note?: string;
  /** Lower bound in mnkr, when the source gives one. */
  minAmount?: number;
  /** Income only: the tax post, adjusted as a tax rate. */
  tax?: boolean;
  subcategories?: {
    name: string;
    amount: number;
    minAmount?: number;
    fixed?: boolean;
  }[];
}

export interface BudgetSpecAlternative {
  key: string;
  label: string;
  color: string;
  taxRateKr?: number;
  /** mnkr per post name; a post the party gives no figure for is left out. */
  amounts: Record<string, number>;
}

export interface BudgetSpec {
  /** Stable id — re-importing the same file updates the same budget. */
  sessionId?: string;
  name: string;
  municipality: string;
  /** The tax rate behind the tax post's amount, kr per hundralapp. */
  taxRateKr?: number;
  minTaxRateKr?: number;
  maxTaxRateKr?: number;
  expenses: BudgetSpecPost[];
  income: BudgetSpecPost[];
  alternatives?: BudgetSpecAlternative[];
}

/** A spec the importer refuses — the message is shown to the admin as is. */
export class BudgetSpecError extends Error {}

// Same id shape the PDF extractor produced: "barn--och-ungdomsnamnden-1".
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const INCOME_COLORS = [
  "hsl(210, 40%, 50%)",
  "hsl(205, 25%, 55%)",
  "hsl(200, 10%, 60%)",
];

const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);

function validate(spec: BudgetSpec) {
  const fail = (msg: string) => {
    throw new BudgetSpecError(msg);
  };
  if (!spec || typeof spec !== "object") fail("Filen är inte en budgetfil.");
  if (!spec.name?.trim()) fail("Budgeten saknar namn (name).");
  if (!spec.municipality?.trim())
    fail("Budgeten saknar kommun (municipality).");
  if (!Array.isArray(spec.expenses) || spec.expenses.length === 0)
    fail("Budgeten saknar utgiftsposter (expenses).");
  if (!Array.isArray(spec.income)) fail("Budgeten saknar intäkter (income).");

  const names = new Set<string>();
  for (const p of [...spec.expenses, ...spec.income]) {
    if (!p?.name?.trim()) fail("En post saknar namn.");
    if (!isNum(p.amount) || p.amount < 0)
      fail(`"${p.name}" har inget giltigt belopp (mnkr).`);
    if (names.has(p.name)) fail(`Posten "${p.name}" finns två gånger.`);
    names.add(p.name);
    if (
      p.adjustPercent != null &&
      !(p.adjustPercent > 0 && p.adjustPercent <= 100)
    )
      fail(`"${p.name}": adjustPercent måste vara mellan 1 och 100.`);
  }
  const taxPosts = spec.income.filter((p) => p.tax);
  if (taxPosts.length > 1) fail("Bara en intäktspost kan vara skatt (tax).");
  if (taxPosts.length && !(isNum(spec.taxRateKr) && spec.taxRateKr > 0))
    fail("Skattepost finns men skattesats (taxRateKr) saknas.");

  const keys = new Set<string>();
  for (const a of spec.alternatives ?? []) {
    if (!a?.key || !a.label || !a.color)
      fail("Ett partiförslag saknar key, label eller color.");
    if (keys.has(a.key)) fail(`Partiet "${a.key}" finns två gånger.`);
    keys.add(a.key);
    for (const [name, amount] of Object.entries(a.amounts ?? {})) {
      if (!names.has(name))
        fail(`${a.key}: det finns ingen post som heter "${name}".`);
      if (!isNum(amount)) fail(`${a.key}: "${name}" har inget giltigt belopp.`);
    }
  }
}

/** The BudgetSession fields a spec describes (no sessionId — see below). */
export function buildBudgetFields(spec: BudgetSpec) {
  validate(spec);
  const n = spec.expenses.length;
  const categories = spec.expenses.map((p, i) => {
    const id = `${slugify(p.name)}-${i}`;
    return {
      id,
      name: p.name.trim(),
      defaultAmount: p.amount * MNKR,
      minAmount: (p.minAmount ?? p.amount) * MNKR,
      isFixed: !!p.fixed,
      ...(p.adjustPercent ? { adjustPercent: p.adjustPercent } : {}),
      note: p.note ?? null,
      // Green → red across the posts.
      color: `hsl(${n > 1 ? 120 - (i * 120) / (n - 1) : 120}, 70%, 50%)`,
      subcategories: (p.subcategories ?? []).map((s, j) => ({
        id: `${id}-${slugify(s.name)}-${j}`,
        name: s.name,
        defaultAmount: s.amount * MNKR,
        minAmount: (s.minAmount ?? 0) * MNKR,
        isFixed: !!s.fixed,
      })),
    };
  });
  const incomeCategories = spec.income.map((p, i) => ({
    id: `${slugify(p.name)}-${i}`,
    name: p.name.trim(),
    amount: p.amount * MNKR,
    isTaxRate: !!p.tax,
    isFixed: !!p.fixed,
    color: INCOME_COLORS[i % INCOME_COLORS.length],
  }));

  // income = rate × taxBase: the tax post's amount at the budget's own rate
  // fixes the tax base the tax slider moves along.
  const tax = spec.income.find((p) => p.tax);
  const taxBase = tax ? (tax.amount * MNKR) / spec.taxRateKr : undefined;

  const idByName = new Map(
    [...categories, ...incomeCategories].map((c) => [c.name, c.id]),
  );
  const alternatives = (spec.alternatives ?? []).map((a) => ({
    key: a.key,
    label: a.label,
    color: a.color,
    taxRateKr: a.taxRateKr,
    allocations: Object.entries(a.amounts ?? {}).map(([name, amount]) => ({
      categoryId: idByName.get(name),
      amount: amount * MNKR,
    })),
  }));

  return {
    name: spec.name.trim(),
    municipality: spec.municipality.trim(),
    totalBudget: categories.reduce((s, c) => s + c.defaultAmount, 0),
    taxBase,
    defaultTaxRateKr: spec.taxRateKr ?? 19,
    minTaxRateKr: spec.minTaxRateKr ?? 18,
    maxTaxRateKr: spec.maxTaxRateKr ?? 21,
    categories,
    incomeCategories,
    alternatives,
  };
}

export type BudgetFields = ReturnType<typeof buildBudgetFields>;

export type ImportOutcome = "create" | "replace-draft" | "update-alternatives";

export interface BudgetPreview {
  sessionId: string;
  outcome: ImportOutcome;
  name: string;
  municipality: string;
  taxRateKr: number | null;
  expenses: PreviewPost[];
  income: PreviewPost[];
  coalition: { expenses: number; income: number; balance: number };
  alternatives: {
    key: string;
    label: string;
    color: string;
    taxRateKr: number | null;
    posts: number;
    balance: number;
  }[];
  warnings: string[];
}

interface PreviewPost {
  name: string;
  amount: number;
  min: number;
  max: number;
  locked: boolean;
  tax: boolean;
  note: string | null;
  parties: { key: string; color: string; value: number; outside: boolean }[];
}

function previewOf(
  fields: BudgetFields,
  sessionId: string,
  outcome: ImportOutcome,
): BudgetPreview {
  const warnings: string[] = [];
  const taxPost = fields.incomeCategories.find((c) => c.isTaxRate);

  const post = (
    c: { id: string; name: string; note?: string | null },
    amount: number,
    range: { min: number; max: number },
    tax = false,
  ): PreviewPost => ({
    name: c.name,
    amount,
    min: range.min,
    max: range.max,
    locked: range.min === range.max,
    tax,
    note: c.note ?? null,
    parties: alternativeMarkers(fields.alternatives, c.id, tax).map((m) => ({
      key: m.key,
      color: m.color,
      value: m.value,
      // A locked post has no slider, so "outside its span" means nothing.
      outside:
        range.min !== range.max &&
        (m.value < range.min - 0.5 || m.value > range.max + 0.5),
    })),
  });

  const expenses = fields.categories.map((c) =>
    post(c, c.defaultAmount, expensePostRange(c)),
  );
  const income = fields.incomeCategories.map((c) =>
    c.isTaxRate
      ? post(
          c,
          c.amount,
          { min: fields.minTaxRateKr, max: fields.maxTaxRateKr },
          true,
        )
      : post(c, c.amount, incomePostRange(c)),
  );

  const coalition = budgetTotals(fields, {});
  const alternatives = fields.alternatives.map((a) => {
    const t = budgetTotals(fields, {
      allocations: a.allocations,
      incomeAllocations:
        a.taxRateKr && taxPost && fields.taxBase
          ? [{ categoryId: taxPost.id, amount: a.taxRateKr * fields.taxBase }]
          : [],
    });
    return {
      key: a.key,
      label: a.label,
      color: a.color,
      taxRateKr: a.taxRateKr ?? null,
      posts: a.allocations.length,
      balance: t.balance,
    };
  });

  // What usually goes wrong when a budget is read out of a municipal plan.
  if (fields.categories.some((c) => /avskrivning/i.test(c.name)))
    warnings.push(
      "Avskrivningar finns som utgiftspost. I kommunens redovisning ingår avskrivningarna oftast redan i nämndernas kostnader (de dras av i driftredovisningen och läggs till i resultaträkningen) — som egen post kan de räknas två gånger.",
    );
  if (isUnderfunded(coalition.balance))
    warnings.push(
      "Budgeten visar underskott med kommunens egna siffror. Ingen kan då lämna in ett förslag utan att först skära ner.",
    );
  if (!taxPost)
    warnings.push(
      "Ingen intäktspost är markerad som skatt — skattereglaget saknas.",
    );
  for (const a of fields.alternatives)
    if (taxPost && a.taxRateKr == null)
      warnings.push(
        `${a.label} saknar skattesats — inget streck på skattereglaget.`,
      );
  const outside = [...expenses, ...income].flatMap((p) =>
    p.parties.filter((m) => m.outside).map((m) => `${m.key} på ${p.name}`),
  );
  if (outside.length)
    warnings.push(
      `Utanför reglagets spann (strecket hamnar vid kanten): ${outside.join(", ")}.`,
    );
  if (outcome === "update-alternatives")
    warnings.push(
      "Budgeten är redan aktiv eller avslutad. Bara partiernas förslag uppdateras — poster, belopp och spann ligger fast, eftersom förslag kan ha lämnats.",
    );

  return {
    sessionId,
    outcome,
    name: fields.name,
    municipality: fields.municipality,
    taxRateKr: taxPost ? fields.defaultTaxRateKr : null,
    expenses,
    income,
    coalition,
    alternatives,
    warnings,
  };
}

/** Everything an import would do, without writing anything. */
export async function planBudgetImport(spec: BudgetSpec) {
  const fields = buildBudgetFields(spec);
  const existing = spec.sessionId
    ? await BudgetSession.findOne({ sessionId: spec.sessionId })
    : null;
  const sessionId =
    spec.sessionId ??
    (await ensureUniqueSessionId(
      generateSessionId(fields.name, fields.municipality),
      BudgetSession,
    ));
  const outcome: ImportOutcome = !existing
    ? "create"
    : existing.status === "draft"
      ? "replace-draft"
      : "update-alternatives";
  return { fields, existing, preview: previewOf(fields, sessionId, outcome) };
}

/**
 * Saves what planBudgetImport previewed. A new budget is a draft (activate it
 * in admin); a draft is replaced; an active or closed budget only gets its
 * parties' proposals updated. Post images come from the image library.
 */
export async function applyBudgetImport(spec: BudgetSpec, createdBy?: unknown) {
  const { fields, existing, preview } = await planBudgetImport(spec);

  if (preview.outcome === "update-alternatives") {
    existing.alternatives = fields.alternatives;
    await existing.save();
    return preview;
  }

  const creator =
    createdBy ??
    existing?.createdBy ??
    (await User.findOne({ isSuperAdmin: true }).select("_id"))?._id;
  if (!creator)
    throw new BudgetSpecError("Ingen superadmin att stå som skapare.");

  const doc = existing ?? new BudgetSession({ status: "draft" });
  doc.set({ ...fields, sessionId: preview.sessionId, createdBy: creator });
  applyPostImages(doc, await postImageMap());
  await doc.save();
  return preview;
}
