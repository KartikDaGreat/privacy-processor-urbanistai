import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Download, Loader2, Play, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { describeProcessingError } from "@/lib/apiError";
import { downloadBlob, outputFileName, runPipeline } from "@/lib/pipeline";
import {
  BLUR_METHODS,
  MODELS,
  REAL_MODEL_IDS,
  modelLabel,
  type BlurMethod,
  type DetectionModelId,
  type RealModelId,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface ComparisonCard {
  id: string;
  model: DetectionModelId;
  blurMethod: BlurMethod;
  status: "idle" | "processing" | "done" | "error";
  url: string | null;
  blob: Blob | null;
  faceCount: number;
  message: string | null;
}

/** What each detector found, reported back so the tour can narrate real numbers. */
export interface GridResult {
  modelId: RealModelId;
  faceCount: number;
  failed: boolean;
}

export interface ComparisonGridHandle {
  /** Line every detector up against the current photo and run them. */
  addAllAndRun: () => Promise<GridResult[]>;
}

interface ComparisonGridProps {
  sourceImage: ImageData | null;
  sourceName?: string;
  defaultBlurMethod: BlurMethod;
  onResults?: (results: GridResult[]) => void;
}

let nextId = 0;
const makeId = () => `card-${nextId++}`;

function newCard(
  model: DetectionModelId,
  blurMethod: BlurMethod,
): ComparisonCard {
  return {
    id: makeId(),
    model,
    blurMethod,
    status: "idle",
    url: null,
    blob: null,
    faceCount: 0,
    message: null,
  };
}

/**
 * A contact sheet: the same photo through every detector at once.
 *
 * The value being compared is the face count, so it is the largest thing in
 * each frame's caption — scanning the column answers "which model caught the
 * most here?" without reading a word.
 */
export const ComparisonGrid = forwardRef<ComparisonGridHandle, ComparisonGridProps>(
  function ComparisonGrid(
    { sourceImage, sourceName, defaultBlurMethod, onResults },
    ref,
  ) {
  const [cards, setCards] = useState<ComparisonCard[]>([]);
  const [isRunningAll, setIsRunningAll] = useState(false);

  // Object URLs are owned by this component; revoke them when they go away.
  const urlsRef = useRef(new Set<string>());
  const trackUrl = useCallback((url: string) => {
    urlsRef.current.add(url);
  }, []);
  const releaseUrl = useCallback((url: string | null) => {
    if (url && urlsRef.current.delete(url)) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  // A new source photo invalidates every rendered frame.
  useEffect(() => {
    setCards((previous) => {
      for (const card of previous) releaseUrl(card.url);
      return previous.map((card) => ({
        ...card,
        status: "idle" as const,
        url: null,
        blob: null,
        faceCount: 0,
        message: null,
      }));
    });
  }, [sourceImage, releaseUrl]);

  const updateCard = useCallback((id: string, patch: Partial<ComparisonCard>) => {
    setCards((previous) =>
      previous.map((card) => (card.id === id ? { ...card, ...patch } : card)),
    );
  }, []);

  const addAllModels = () => {
    setCards((previous) => {
      for (const card of previous) releaseUrl(card.url);
      return REAL_MODEL_IDS.map((model) => newCard(model, defaultBlurMethod));
    });
  };

  const addCard = () => {
    setCards((previous) => [...previous, newCard("mediapipe", defaultBlurMethod)]);
  };

  const removeCard = (id: string) => {
    setCards((previous) => {
      const card = previous.find((c) => c.id === id);
      releaseUrl(card?.url ?? null);
      return previous.filter((c) => c.id !== id);
    });
  };

  const runCard = useCallback(
    async (card: ComparisonCard): Promise<GridResult> => {
      const model = card.model as RealModelId;
      if (!sourceImage) return { modelId: model, faceCount: 0, failed: true };
      releaseUrl(card.url);
      updateCard(card.id, {
        status: "processing",
        url: null,
        blob: null,
        message: null,
      });
      try {
        const output = await runPipeline({
          image: sourceImage,
          model: card.model,
          blurMethod: card.blurMethod,
        });
        trackUrl(output.url);
        updateCard(card.id, {
          status: "done",
          url: output.url,
          blob: output.blob,
          faceCount: output.faceCount,
          message: null,
        });
        return { modelId: model, faceCount: output.faceCount, failed: false };
      } catch (error) {
        const message = describeProcessingError(error);
        updateCard(card.id, { status: "error", message });
        toast.error(`${modelLabel(card.model)} failed`, { description: message });
        return { modelId: model, faceCount: 0, failed: true };
      }
    },
    [sourceImage, releaseUrl, trackUrl, updateCard],
  );

  const runAll = async () => {
    if (!sourceImage || cards.length === 0) return;
    setIsRunningAll(true);
    try {
      onResults?.(await Promise.all(cards.map((card) => runCard(card))));
    } finally {
      setIsRunningAll(false);
    }
  };

  /*
   * Drives the whole sheet in one call, for the guided tour. It runs the cards
   * it just built rather than reading them back from state, which would still
   * hold the previous set on this tick.
   */
  const addAllAndRun = useCallback(async (): Promise<GridResult[]> => {
    if (!sourceImage) return [];
    const fresh = REAL_MODEL_IDS.map((model) => newCard(model, defaultBlurMethod));
    setCards((previous) => {
      for (const card of previous) releaseUrl(card.url);
      return fresh;
    });
    setIsRunningAll(true);
    try {
      const results = await Promise.all(fresh.map((card) => runCard(card)));
      onResults?.(results);
      return results;
    } finally {
      setIsRunningAll(false);
    }
  }, [sourceImage, defaultBlurMethod, releaseUrl, runCard, onResults]);

  useImperativeHandle(ref, () => ({ addAllAndRun }), [addAllAndRun]);

  const disabled = !sourceImage || isRunningAll;

  /*
   * Mark the standout only when there is one. If every detector ties — the
   * common case on a simple photo — highlighting all of them says nothing,
   * so nothing gets marked.
   */
  const done = cards.filter((c) => c.status === "done");
  const best = Math.max(0, ...done.map((c) => c.faceCount));
  const leaders = done.filter((c) => c.faceCount === best).length;
  const hasStandout = best > 0 && leaders < done.length;

  return (
    <section className="mt-12 border-t border-border pt-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-title font-semibold text-foreground">
            Compare detectors
          </h2>
          <p className="mt-1 max-w-md text-meta text-muted-foreground">
            Run the same photo through several models to see which one catches
            the most faces.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={addAllModels} disabled={disabled}>
            Add all five
          </Button>
          <Button variant="outline" size="sm" onClick={addCard} disabled={disabled}>
            <Plus />
            Add
          </Button>
          <Button size="sm" onClick={runAll} disabled={disabled || cards.length === 0}>
            {isRunningAll ? <Loader2 className="animate-spin" /> : <Play />}
            Run all
          </Button>
        </div>
      </div>

      {cards.length === 0 ? (
        <p className="rounded-panel border border-dashed border-border px-4 py-10 text-center text-meta text-muted-foreground">
          Nothing to compare yet. Add a frame, or line all five detectors up
          against this photo at once.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const isBest =
              hasStandout && card.status === "done" && card.faceCount === best;
            return (
              <article
                key={card.id}
                className={cn(
                  "group overflow-hidden rounded-panel border bg-card transition-colors",
                  isBest ? "border-primary/70" : "border-border",
                )}
              >
                <div className="relative aspect-[4/3] bg-background">
                  {card.status === "processing" && (
                    <div className="absolute inset-0 grid place-items-center">
                      <Loader2 className="h-4 w-4 animate-spin text-primary-text" />
                    </div>
                  )}

                  {card.status === "idle" && (
                    <button
                      type="button"
                      onClick={() => runCard(card)}
                      disabled={disabled}
                      className="absolute inset-0 grid place-items-center text-micro text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed"
                    >
                      Run this model
                    </button>
                  )}

                  {card.status === "error" && (
                    <p className="absolute inset-0 grid place-items-center px-4 text-center text-micro text-destructive">
                      {card.message}
                    </p>
                  )}

                  {card.status === "done" && card.url && (
                    <>
                      <img
                        src={card.url}
                        alt={`${modelLabel(card.model)} result`}
                        className="h-full w-full object-contain"
                      />
                      <div className="absolute inset-x-0 bottom-0 flex justify-end p-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            card.blob &&
                            downloadBlob(
                              card.blob,
                              outputFileName(sourceName, card.model),
                            )
                          }
                        >
                          <Download />
                          Save
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 border-t border-border px-3 py-2">
                  <span
                    className={cn(
                      "font-mono-display text-meta font-medium tnum",
                      card.status === "done"
                        ? isBest
                          ? "text-primary-text"
                          : "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {card.status === "done" ? card.faceCount : "—"}
                  </span>
                  <span className="truncate text-micro text-muted-foreground">
                    {card.faceCount === 1 ? "face" : "faces"}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCard(card.id)}
                    disabled={isRunningAll}
                    aria-label={`Remove the ${modelLabel(card.model)} frame`}
                    className="ml-auto rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex gap-1.5 border-t border-border p-2">
                  <Select
                    value={card.model}
                    onValueChange={(value) =>
                      updateCard(card.id, { model: value as DetectionModelId })
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger aria-label="Detection model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={card.blurMethod}
                    onValueChange={(value) =>
                      updateCard(card.id, { blurMethod: value as BlurMethod })
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger className="w-[6.5rem] shrink-0" aria-label="Blur method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BLUR_METHODS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
  },
);
