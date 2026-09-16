import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GridResult } from "@/components/ComparisonGrid";
import { modelLabel } from "@/lib/types";

/**
 * A guided run, not a coachmark tour.
 *
 * Each step makes the app do the real thing — load a photo, chain every
 * detector, then run the five separately — and narrates what just happened
 * using the numbers that actually came back. The point it builds to is that
 * no single detector catches everyone, which is why Run All exists.
 */
export type TourStep = "intro" | "loaded" | "chained" | "compared";

export const TOUR_STEPS: TourStep[] = ["intro", "loaded", "chained", "compared"];

interface TourProps {
  step: TourStep;
  busy: boolean;
  busyLabel?: string;
  /** Faces blurred by the chained Run All pass. */
  chainedCount: number;
  results: GridResult[] | null;
  onNext: () => void;
  onExit: () => void;
}

export function Tour({
  step,
  busy,
  busyLabel,
  chainedCount,
  results,
  onNext,
  onExit,
}: TourProps) {
  const index = TOUR_STEPS.indexOf(step);
  const content = COPY[step];
  const title =
    step === "compared" ? comparedTitle(chainedCount, results) : content.title;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4">
      <aside
        role="region"
        aria-label="Guided tour"
        aria-live="polite"
        className="pointer-events-auto max-h-[70vh] w-full max-w-2xl overflow-y-auto rounded-panel border border-primary/50 bg-card/95 p-4 shadow-2xl backdrop-blur"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono-display text-micro text-muted-foreground">
              Step {index + 1} of {TOUR_STEPS.length}
            </p>
            <h2 className="mt-0.5 text-meta font-semibold text-foreground">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onExit}
            aria-label="Leave the tour"
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-2 text-meta leading-relaxed text-muted-foreground">
          {step === "chained" ? (
            <ChainedBody chainedCount={chainedCount} />
          ) : step === "compared" ? (
            <ComparedBody chainedCount={chainedCount} results={results} />
          ) : (
            <p>{content.body}</p>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Button size="sm" onClick={onNext} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {busy ? (busyLabel ?? "Working") : content.cta}
          </Button>
          {!busy && (
            <button
              type="button"
              onClick={onExit}
              className="text-micro text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
            >
              Skip the tour
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

const COPY: Record<TourStep, { title: string; body: string; cta: string }> = {
  intro: {
    title: "See what every detector catches",
    body: "This runs one real photo through all five face detectors so you can compare them. It happens in this browser — nothing is uploaded, and nothing leaves your machine.",
    cta: "Start with a group photo",
  },
  loaded: {
    title: "A deliberately hard photo",
    body: "Dozens of faces, most of them small and some turned away. A single detector will not find all of them, which is exactly what makes it worth looking at.",
    cta: "Chain all five detectors",
  },
  chained: {
    title: "Run All chained the detectors",
    body: "",
    cta: "Now run each one separately",
  },
  compared: {
    // Replaced at render time by comparedTitle, which reads the real results.
    title: "Comparison finished",
    body: "",
    cta: "Finish",
  },
};

function ChainedBody({ chainedCount }: { chainedCount: number }) {
  return (
    <p>
      Each detector ran on the previous one&rsquo;s output, so their coverage
      adds up instead of competing.{" "}
      <strong className="font-medium text-foreground">
        {chainedCount} {chainedCount === 1 ? "face" : "faces"}
      </strong>{" "}
      blurred. Drag the divider on the photo to wipe between the original and
      the result — the blue marks show exactly which regions were changed.
    </p>
  );
}

/**
 * Why a detector found nothing. These differ per model, so the tour must not
 * blame them all on the same cause — only the Caffe SSD rescales to 300x300.
 */
function zeroReason(modelId: GridResult["modelId"]): string {
  switch (modelId) {
    case "opencv_dnn":
      return "it rescales the photo to 300×300 before looking, so faces this small disappear";
    case "mediapipe":
      return "its short-range model expects faces close to the camera";
    case "mediapipe_full":
      return "even its full-range model is tuned for faces far larger in frame than these";
    case "haar":
      return "it only matches near-frontal, upright faces";
    case "yunet":
      return "its confidence threshold rejected everything at this size";
  }
}

function list(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function comparedTitle(chainedCount: number, results: GridResult[] | null): string {
  if (!results || results.length === 0) return "Comparison finished";
  const best = Math.max(...results.map((r) => r.faceCount));
  return chainedCount > best
    ? "No single detector caught everyone"
    : "The detectors disagree sharply";
}

function ComparedBody({
  chainedCount,
  results,
}: {
  chainedCount: number;
  results: GridResult[] | null;
}) {
  if (!results || results.length === 0) {
    return <p>The comparison did not return any results.</p>;
  }

  const ranked = [...results].sort((a, b) => b.faceCount - a.faceCount);
  const best = ranked[0];
  const empty = ranked.filter((r) => !r.failed && r.faceCount === 0);
  const beatsBest = chainedCount > best.faceCount;

  // Group the empty-handed detectors by the reason they came up empty.
  const reasons = new Map<string, string[]>();
  for (const r of empty) {
    const reason = zeroReason(r.modelId);
    reasons.set(reason, [...(reasons.get(reason) ?? []), modelLabel(r.modelId)]);
  }

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {ranked.map((result) => (
          <li key={result.modelId} className="flex items-baseline gap-1.5">
            <span className="font-mono-display text-meta font-medium text-foreground tnum">
              {result.failed ? "—" : result.faceCount}
            </span>
            <span className="text-micro text-muted-foreground">
              {modelLabel(result.modelId)}
            </span>
          </li>
        ))}
      </ul>

      <p>
        {beatsBest ? (
          <>
            Chained, they blurred{" "}
            <strong className="font-medium text-foreground">{chainedCount}</strong>{" "}
            faces — more than any one of them managed alone, the best being{" "}
            {modelLabel(best.modelId)} at{" "}
            <strong className="font-medium text-foreground">{best.faceCount}</strong>.
          </>
        ) : (
          <>
            {modelLabel(best.modelId)} alone found{" "}
            <strong className="font-medium text-foreground">{best.faceCount}</strong>,
            matching the chained pass. On another photo a different detector
            wins, which is why it is worth comparing rather than picking one and
            trusting it.
          </>
        )}
      </p>

      {empty.length > 0 && (
        <div>
          <p className="text-micro">
            {list(empty.map((r) => modelLabel(r.modelId)))} found nothing at all:
          </p>
          <ul className="mt-1 space-y-0.5">
            {[...reasons.entries()].map(([reason, models]) => (
              <li key={reason} className="text-micro leading-snug">
                <span className="text-foreground">{list(models)}</span> — {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
