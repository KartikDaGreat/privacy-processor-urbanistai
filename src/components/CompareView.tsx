import { useId, useState } from "react";
import { Download, Frame, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FaceBox } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Keeps the frame and its readout inside one screen on a laptop. */
const FRAME_MAX_HEIGHT = "min(64vh, 620px)";

interface CompareViewProps {
  originalUrl: string | null;
  processedUrl: string | null;
  boxes: FaceBox[];
  /** Pixel dimensions the boxes are expressed in. */
  imageWidth: number;
  imageHeight: number;
  isProcessing: boolean;
  progressLabel?: string;
  faceCount: number;
  onDownload: () => void;
}

/**
 * The inspection surface.
 *
 * One image, not two thumbnails: drag the divider to wipe between the original
 * and the anonymized result. The point of this tool is answering "did it miss
 * anyone?", and that question is far easier to answer by wiping one large frame
 * than by flicking between two small ones.
 */
export function CompareView({
  originalUrl,
  processedUrl,
  boxes,
  imageWidth,
  imageHeight,
  isProcessing,
  progressLabel,
  faceCount,
  onDownload,
}: CompareViewProps) {
  const [position, setPosition] = useState(50);
  const [showBoxes, setShowBoxes] = useState(true);
  const sliderId = useId();

  const hasResult = Boolean(processedUrl) && !isProcessing;
  const aspect = imageWidth && imageHeight ? imageWidth / imageHeight : 4 / 3;

  if (!originalUrl) {
    return null;
  }

  return (
    <figure className="overflow-hidden rounded-panel border border-border bg-card">
      <div
        className="relative mx-auto w-full select-none bg-background"
        style={{
          aspectRatio: aspect,
          // Bound the height so the readout below stays in view, but keep the
          // box exactly the image's aspect ratio — the wipe clips against the
          // container, so any letterboxing would desync the divider.
          maxHeight: FRAME_MAX_HEIGHT,
          maxWidth: `calc(${FRAME_MAX_HEIGHT} * ${aspect})`,
        }}
      >
        <img
          src={originalUrl}
          alt="The photograph as uploaded"
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />

        {processedUrl && (
          <img
            src={processedUrl}
            alt="The same photograph with detected faces blurred"
            className="absolute inset-0 h-full w-full object-contain"
            style={{ clipPath: `inset(0 0 0 ${position}%)` }}
            draggable={false}
          />
        )}

        {/* Detection marks, drawn in the source image's own coordinate space. */}
        {hasResult && showBoxes && boxes.length > 0 && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${imageWidth} ${imageHeight}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            {boxes.map((box, index) => (
              <DetectionMark key={index} box={box} scale={imageWidth} />
            ))}
          </svg>
        )}

        {processedUrl && (
          <>
            {/* The wipe divider. */}
            <div
              className="pointer-events-none absolute inset-y-0 -ml-px w-0.5 bg-primary shadow-[0_0_0_1px_hsl(0_0%_100%/0.55)]"
              style={{ left: `${position}%` }}
            />
            <div
              className="pointer-events-none absolute top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-primary bg-background/90 backdrop-blur"
              style={{ left: `${position}%` }}
            >
              <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
                <path
                  d="M6 1 1.5 6 6 11M10 1l4.5 5L10 11"
                  fill="none"
                  stroke="hsl(var(--primary-text))"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <label htmlFor={sliderId} className="sr-only">
              Wipe between the original and the anonymized result
            </label>
            <input
              id={sliderId}
              type="range"
              min={0}
              max={100}
              value={position}
              onChange={(event) => setPosition(Number(event.target.value))}
              className="reveal-range absolute inset-0 h-full w-full cursor-ew-resize"
              aria-valuetext={`${position}% anonymized`}
            />
          </>
        )}

        {isProcessing && (
          <div className="absolute inset-0 grid place-items-center bg-background/75 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary-text" />
              <p className="font-mono-display text-micro text-muted-foreground">
                {progressLabel ?? "Working"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Readout: the evidence, stated as values rather than prose. */}
      <figcaption className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border px-4 py-3">
        <Readout
          label={faceCount === 1 ? "face found" : "faces found"}
          value={hasResult ? String(faceCount) : "—"}
          emphatic={hasResult && faceCount > 0}
        />
        <Readout
          label="pixels"
          value={imageWidth ? `${imageWidth}×${imageHeight}` : "—"}
        />
        <Readout
          label="metadata"
          value={hasResult ? "stripped" : "—"}
          tone={hasResult ? "good" : undefined}
        />

        <div className="ml-auto flex items-center gap-2">
          {hasResult && boxes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBoxes((value) => !value)}
              aria-pressed={showBoxes}
            >
              <Frame />
              {showBoxes ? "Hide marks" : "Show marks"}
            </Button>
          )}
          <Button size="sm" onClick={onDownload} disabled={!hasResult}>
            <Download />
            Download PNG
          </Button>
        </div>
      </figcaption>
    </figure>
  );
}

function Readout({
  label,
  value,
  emphatic,
  tone,
}: {
  label: string;
  value: string;
  emphatic?: boolean;
  tone?: "good";
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className={cn(
          "font-mono-display text-meta font-medium",
          tone === "good" && "text-[hsl(var(--success))]",
          emphatic && "text-primary-text",
          !tone && !emphatic && "text-foreground",
        )}
      >
        {value}
      </span>
      <span className="text-micro text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * A registration mark rather than a plain rectangle: corner ticks read as
 * "this region was surveyed and acted on", and they stay legible over a blurred
 * patch where a solid outline would muddy what is underneath.
 */
function DetectionMark({ box, scale }: { box: FaceBox; scale: number }) {
  const stroke = Math.max(1.5, scale / 480);
  const tick = Math.min(box.width, box.height) * 0.28;
  const { x, y, width: w, height: h } = box;

  return (
    <g fill="none" stroke="#0000FF" strokeWidth={stroke} strokeLinecap="square">
      <rect x={x} y={y} width={w} height={h} strokeOpacity={0.22} />
      <path
        d={[
          `M${x} ${y + tick}V${y}H${x + tick}`,
          `M${x + w - tick} ${y}H${x + w}V${y + tick}`,
          `M${x + w} ${y + h - tick}V${y + h}H${x + w - tick}`,
          `M${x + tick} ${y + h}H${x}V${y + h - tick}`,
        ].join(" ")}
      />
    </g>
  );
}
