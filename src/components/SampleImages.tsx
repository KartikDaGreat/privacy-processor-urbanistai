import { Fragment, useState } from "react";
import { Loader2 } from "lucide-react";
import { SAMPLES, loadSample, type SampleImage } from "@/lib/samples";
import { cn } from "@/lib/utils";

interface SampleImagesProps {
  onSelect: (file: File) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

export function SampleImages({ onSelect, onError, disabled }: SampleImagesProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const choose = async (sample: SampleImage) => {
    if (loadingId) return;
    setLoadingId(sample.id);
    try {
      onSelect(await loadSample(sample));
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-meta text-muted-foreground">
        No photo handy? Start with one of these.
      </h2>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SAMPLES.map((sample) => {
          const isLoading = loadingId === sample.id;
          return (
            <li key={sample.id}>
              <button
                type="button"
                onClick={() => choose(sample)}
                disabled={disabled || Boolean(loadingId)}
                className={cn(
                  "group w-full overflow-hidden rounded-panel border border-border bg-card text-left transition-colors",
                  "hover:border-primary/70 disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                <span className="relative block aspect-[16/9] overflow-hidden bg-background">
                  <img
                    src={sample.thumb}
                    alt=""
                    loading="lazy"
                    width={400}
                    className="h-full w-full object-cover"
                  />
                  {isLoading && (
                    <span className="absolute inset-0 grid place-items-center bg-background/70">
                      <Loader2 className="h-4 w-4 animate-spin text-primary-text" />
                    </span>
                  )}
                </span>
                <span className="block px-3 py-2">
                  <span className="block text-meta font-medium text-foreground">
                    {sample.label}
                  </span>
                  <span className="mt-0.5 block text-micro leading-snug text-muted-foreground">
                    {sample.note}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* CC BY requires the credit to travel with the image, so it lives here. */}
      <p className="text-micro leading-relaxed text-muted-foreground">
        Samples from Wikimedia Commons:{" "}
        {SAMPLES.map((sample, index) => (
          <Fragment key={sample.id}>
            {index > 0 && "; "}
            <a
              href={sample.credit.source}
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {sample.credit.author}
            </a>{" "}
            ({sample.credit.licence})
          </Fragment>
        ))}
        .
      </p>
    </section>
  );
}
