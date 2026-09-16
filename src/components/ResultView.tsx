import { Download, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResultViewProps {
  originalUrl: string | null;
  processedUrl: string | null;
  isProcessing: boolean;
  progressLabel?: string;
  resultSummary?: string;
  onDownload: () => void;
}

function Panel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-mono-display uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="checker flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-border bg-background/40">
        {children}
      </div>
    </div>
  );
}

export function ResultView({
  originalUrl,
  processedUrl,
  isProcessing,
  progressLabel,
  resultSummary,
  onDownload,
}: ResultViewProps) {
  return (
    <div className="glass-surface rounded-xl p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Panel label="Original">
          {originalUrl ? (
            <img
              src={originalUrl}
              alt="The image as uploaded"
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-xs text-muted-foreground">No image yet</span>
          )}
        </Panel>

        <Panel label="Processed">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-3 px-4 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs font-mono-display text-muted-foreground">
                {progressLabel ?? "Processing..."}
              </span>
            </div>
          ) : processedUrl ? (
            <img
              src={processedUrl}
              alt="The anonymized result"
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="px-4 text-center text-xs text-muted-foreground">
              Run the processor to see the result
            </span>
          )}
        </Panel>
      </div>

      {processedUrl && !isProcessing && (
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs font-mono-display text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[hsl(var(--success))]" />
            <span>{resultSummary ?? "Metadata stripped"}</span>
          </p>
          <Button onClick={onDownload} className="glow-primary">
            <Download />
            Download
          </Button>
        </div>
      )}
    </div>
  );
}
