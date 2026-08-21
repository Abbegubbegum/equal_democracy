import { useState, type ReactNode } from "react";
import { Sparkles, X } from "lucide-react";

export interface MajDuplicate {
  id: string;
  title: string;
  relation: "same" | "more_specific" | "more_general";
  reason: string;
}

export interface MajReview {
  corrected: string | null;
  concise: string | null;
  duplicates?: MajDuplicate[];
}

const RELATION_LABEL: Record<MajDuplicate["relation"], string> = {
  same: "Samma idé",
  more_specific: "Mer specifik",
  more_general: "Mer allmän",
};

/**
 * MAJ's writing-help sheet shown when a user posts a proposal/argument.
 * Suggests a corrected + a concise version and (for proposals) an image.
 * "Publicera" posts the working text (original unless a suggestion was applied).
 */
export default function MajReviewSheet({
  originalText,
  review,
  kind,
  hasImage = false,
  onPickImage,
  onPublish,
  onGoToProposal,
  onCancel,
}: {
  originalText: string;
  review: MajReview;
  kind: "proposal" | "argument";
  hasImage?: boolean;
  onPickImage?: () => void;
  onPublish: (finalText: string) => void;
  onGoToProposal?: (id: string) => void;
  onCancel: () => void;
}) {
  const [workingText, setWorkingText] = useState(originalText);
  const [applied, setApplied] = useState<"corrected" | "concise" | null>(null);

  const showImageTip = kind === "proposal";
  const duplicates = review.duplicates ?? [];
  const hasDuplicates = duplicates.length > 0;
  const publishLabel = hasDuplicates
    ? "Lämna ändå"
    : kind === "proposal"
      ? "Publicera förslag"
      : "Publicera argument";
  const nothingToImprove =
    !hasDuplicates && !review.corrected && !review.concise && !showImageTip;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-[22px] sm:rounded-[22px] overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white px-5 py-4 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full grid place-items-center bg-accent-400/20 border border-accent-400/50 shrink-0">
            <Sparkles className="w-5 h-5 text-accent-400" />
          </span>
          <div className="flex-1">
            <h2 className="font-extrabold">MAJ har några tips</h2>
            <p className="text-xs text-primary-100">Innan du publicerar</p>
          </div>
          <button
            onClick={onCancel}
            className="text-white/70 hover:text-white"
            aria-label="Stäng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          {hasDuplicates && (
            <div className="border border-amber-300 bg-amber-50 rounded-2xl p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <span>⚠️</span>
                <span className="text-[0.66rem] font-extrabold uppercase tracking-wide text-amber-700">
                  Kan redan finnas
                </span>
              </div>
              <p className="text-sm text-amber-900 leading-snug mb-3">
                Rösta hellre på ett befintligt förslag än att dela upp rösterna
                på dubletter.
              </p>
              <div className="space-y-2.5">
                {duplicates.map((d) => (
                  <div
                    key={d.id}
                    className="bg-white rounded-xl border border-amber-200 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 text-[0.6rem] font-extrabold uppercase tracking-wide text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 mt-0.5">
                        {RELATION_LABEL[d.relation]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 leading-snug">
                          {d.title}
                        </p>
                        {d.reason && (
                          <p className="text-xs text-gray-500 leading-snug mt-0.5">
                            {d.reason}
                          </p>
                        )}
                      </div>
                    </div>
                    {onGoToProposal && (
                      <button
                        onClick={() => onGoToProposal(d.id)}
                        className="mt-2.5 text-sm font-bold px-3.5 py-2 rounded-btn bg-primary-600 text-white hover:bg-primary-700"
                      >
                        Rösta på det istället
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {review.corrected && (
            <Tip icon="✍️" label="Stavning & språk">
              <p className="text-sm bg-[#f7f8fb] rounded-lg p-3 text-gray-800 leading-relaxed">
                {review.corrected}
              </p>
              <TipUse
                applied={applied === "corrected"}
                label="Använd MAJ:s text"
                onUse={() => {
                  setWorkingText(review.corrected as string);
                  setApplied("corrected");
                }}
              />
            </Tip>
          )}

          {review.concise && (
            <Tip icon="✂️" label="Kortare & tydligare">
              <p className="text-sm bg-[#f7f8fb] rounded-lg p-3 text-gray-800 leading-relaxed">
                {review.concise}
              </p>
              <TipUse
                applied={applied === "concise"}
                label="Använd"
                onUse={() => {
                  setWorkingText(review.concise as string);
                  setApplied("concise");
                }}
              />
            </Tip>
          )}

          {showImageTip && (
            <Tip icon="📷" label="Lägg till en bild">
              {hasImage ? (
                <p className="text-sm text-green-700 font-semibold">
                  ✓ Bild tillagd
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Förslag med bild får mer uppmärksamhet och fler röster.
                  </p>
                  {onPickImage && (
                    <button
                      onClick={onPickImage}
                      className="mt-2 text-sm font-bold px-3.5 py-2 rounded-btn bg-accent-400 text-primary-800 hover:bg-accent-500"
                    >
                      Välj bild
                    </button>
                  )}
                </>
              )}
            </Tip>
          )}

          {nothingToImprove && (
            <p className="text-sm text-gray-500 text-center py-2">
              MAJ hittade inget att förbättra. 👍
            </p>
          )}
        </div>

        <div className="p-5 pt-3 flex gap-3 border-t border-black/5">
          <button
            onClick={() => onPublish(workingText)}
            className="flex-1 bg-accent-400 text-primary-800 font-extrabold py-3 rounded-btn hover:bg-accent-500"
          >
            {publishLabel}
          </button>
          <button
            onClick={onCancel}
            className="text-gray-500 font-bold text-sm px-2"
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}

function Tip({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border border-black/5 rounded-2xl p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <span className="text-[0.66rem] font-extrabold uppercase tracking-wide text-gray-400">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function TipUse({
  applied,
  label,
  onUse,
}: {
  applied: boolean;
  label: string;
  onUse: () => void;
}) {
  return (
    <div className="mt-2.5">
      {applied ? (
        <span className="text-sm font-bold text-green-700">✓ Använd</span>
      ) : (
        <button
          onClick={onUse}
          className="text-sm font-bold px-3.5 py-2 rounded-btn bg-accent-400 text-primary-800 hover:bg-accent-500"
        >
          {label}
        </button>
      )}
    </div>
  );
}
