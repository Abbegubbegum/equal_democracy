import connectDB from "./mongodb";
import { CitizenProposal, QuestionComment } from "./models";
import {
  reviewContent,
  findDuplicates,
  findDuplicateArguments,
  type ReviewResult,
  type DuplicateMatch,
} from "./ai";
import { createLogger } from "./logger";

const log = createLogger("majReview");

// A flagged duplicate plus the display field a create sheet needs to render it.
export type DuplicateHit = DuplicateMatch & { title: string };

export interface MajReviewResponse extends ReviewResult {
  duplicates: DuplicateHit[];
}

/**
 * MAJ's help at creation time, shared by the web (`/api/maj/review`) and mobile
 * (`/api/mobile/maj/review`) routes so both behave identically. For any draft it
 * returns { corrected, concise } writing suggestions; for a proposal it also
 * returns `duplicates` — existing active proposals MAJ thinks describe the same
 * idea. Fails open (nulls / empty list) so it never blocks posting.
 */
export async function runMajReview(opts: {
  text: string;
  kind: "proposal" | "argument";
  title?: string;
  questionId?: string;
  stance?: string;
}): Promise<MajReviewResponse> {
  const { text, kind, title = "", questionId, stance } = opts;
  const isProposal = kind === "proposal";

  // Writing tips and the duplicate scan are independent — run them together.
  // Proposals dedupe against the active proposal stack; debate arguments dedupe
  // against same-stance arguments on the same question.
  const [review, duplicates] = await Promise.all([
    reviewContent({ text, kind }),
    isProposal
      ? findProposalDuplicates(title, text)
      : questionId
        ? findArgumentDuplicates(questionId, stance, text)
        : Promise.resolve<DuplicateHit[]>([]),
  ]);

  return { ...review, duplicates };
}

/**
 * Fetch the active proposal stack and ask MAJ which (if any) the draft
 * duplicates. Returns hits enriched with the existing proposal's title so a
 * create sheet can show it. Fails open (empty list).
 */
async function findProposalDuplicates(
  title: string,
  description: string,
): Promise<DuplicateHit[]> {
  try {
    await connectDB();
    const existing = (await CitizenProposal.find({ status: "active" })
      .select({ title: 1, description: 1 })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()) as any[];

    if (!existing.length) return [];

    const byId = new Map<string, string>(
      existing.map((p) => [p._id.toString(), p.title]),
    );

    const matches = await findDuplicates({
      title,
      description,
      candidates: existing.map((p) => ({
        id: p._id.toString(),
        title: p.title,
        description: p.description || "",
      })),
    });

    return matches.map((m) => ({ ...m, title: byId.get(m.id) || "" }));
  } catch (error) {
    log.error("MAJ duplicate check failed", {
      error: (error as Error).message,
    });
    return [];
  }
}

/**
 * Fetch the same-stance arguments on a question and ask MAJ which (if any) the
 * draft argument duplicates. Returns hits with the existing argument's text
 * (truncated) as the display `title`. Fails open (empty list).
 */
async function findArgumentDuplicates(
  questionId: string,
  stance: string | undefined,
  text: string,
): Promise<DuplicateHit[]> {
  try {
    await connectDB();
    const query: Record<string, unknown> = { questionId };
    if (stance) query.type = stance; // same-stance comparison only

    const existing = (await QuestionComment.find(query)
      .select({ text: 1 })
      .sort({ createdAt: -1 })
      .limit(80)
      .lean()) as any[];

    if (!existing.length) return [];

    const byId = new Map<string, string>(
      existing.map((c) => [c._id.toString(), c.text || ""]),
    );

    const matches = await findDuplicateArguments({
      text,
      candidates: existing.map((c) => ({
        id: c._id.toString(),
        text: c.text || "",
      })),
    });

    return matches.map((m) => {
      const full = byId.get(m.id) || "";
      const title = full.length > 140 ? `${full.slice(0, 140).trim()}…` : full;
      return { ...m, title };
    });
  } catch (error) {
    log.error("MAJ argument duplicate check failed", {
      error: (error as Error).message,
    });
    return [];
  }
}
