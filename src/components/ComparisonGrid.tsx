import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Grid3x3, Loader2, Play, Plus, Trash2 } from "lucide-react";
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
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface ComparisonCard {
  id: string;
  model: DetectionModelId;
  blurMethod: BlurMethod;
  status: "idle" | "processing" | "done" | "error";
  url: string | null;
  blob: Blob | null;
  message: string | null;
}

interface ComparisonGridProps {
  sourceImage: ImageData | null;
  sourceName?: string;
  defaultBlurMethod: BlurMethod;
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
    message: null,
  };
}

export function ComparisonGrid({
  sourceImage,
  sourceName,
  defaultBlurMethod,
}: ComparisonGridProps) {
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

  // A new source image invalidates every rendered result.
  useEffect(() => {
    setCards((previous) => {
      for (const card of previous) releaseUrl(card.url);
      return previous.map((card) => ({
        ...card,
        status: "idle" as const,
        url: null,
        blob: null,
        message: null,
      }));
    });
  }, [sourceImage, releaseUrl]);

  const updateCard = useCallback(
    (id: string, patch: Partial<ComparisonCard>) => {
      setCards((previous) =>
        previous.map((card) => (card.id === id ? { ...card, ...patch } : card)),
      );
    },
    [],
  );

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
    async (card: ComparisonCard) => {
      if (!sourceImage) return;
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
          message:
            output.faceCount === 0
              ? "no faces found"
              : `${output.faceCount} face${output.faceCount === 1 ? "" : "s"}`,
        });
      } catch (error) {
        const message = describeProcessingError(error);
        updateCard(card.id, { status: "error", message });
        toast.error(`${modelLabel(card.model)} failed`, { description: message });
      }
    },
    [sourceImage, releaseUrl, trackUrl, updateCard],
  );

  const runAll = async () => {
    if (!sourceImage || cards.length === 0) return;
    setIsRunningAll(true);
    try {
      await Promise.all(cards.map((card) => runCard(card)));
    } finally {
      setIsRunningAll(false);
    }
  };

  const disabled = !sourceImage || isRunningAll;

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-mono-display text-sm font-semibold text-foreground">
          <Grid3x3 className="h-4 w-4 text-primary" />
          Model Comparison
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={addAllModels} disabled={disabled}>
            All Models
          </Button>
          <Button variant="outline" size="sm" onClick={addCard} disabled={disabled}>
            <Plus />
            Add
          </Button>
          <Button
            size="sm"
            onClick={runAll}
            disabled={disabled || cards.length === 0}
            className="glow-primary"
          >
            {isRunningAll ? <Loader2 className="animate-spin" /> : <Play />}
            Run All
          </Button>
        </div>
      </div>

      {cards.length === 0 ? (
        <p className="glass-surface rounded-xl px-4 py-8 text-center text-xs text-muted-foreground">
          {sourceImage
            ? "Add a card, or use “All Models” to compare every detector side by side."
            : "Upload an image to start comparing models."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.id}
              className="glass-surface group flex flex-col gap-3 rounded-xl p-3"
            >
              <div className="flex gap-2">
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
                    {MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.label}
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
                  <SelectTrigger className="w-28 shrink-0" aria-label="Blur method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLUR_METHODS.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="checker relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-border bg-background/40">
                {card.status === "processing" && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}

                {card.status === "idle" && (
                  <span className="px-3 text-center text-[11px] text-muted-foreground">
                    Not run yet
                  </span>
                )}

                {card.status === "error" && (
                  <span className="px-3 text-center text-[11px] text-destructive">
                    {card.message}
                  </span>
                )}

                {card.status === "done" && card.url && (
                  <>
                    <img
                      src={card.url}
                      alt={`Result from ${modelLabel(card.model)}`}
                      className="h-full w-full object-contain"
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-end justify-end bg-background/70 p-2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
                      <Button
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
                        Download
                      </Button>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "truncate text-[11px] font-mono-display",
                    card.status === "error"
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {card.status === "done" ? card.message : modelLabel(card.model)}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Run this card"
                    onClick={() => runCard(card)}
                    disabled={disabled}
                  >
                    <Play />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove this card"
                    onClick={() => removeCard(card.id)}
                    disabled={isRunningAll}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
