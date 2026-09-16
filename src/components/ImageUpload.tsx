import { useCallback, useRef, useState } from "react";
import { ImageUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  onSelect: (file: File) => void;
  /** Once an image is loaded the zone collapses so the result takes the stage. */
  hasImage: boolean;
  fileName?: string;
  disabled?: boolean;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/bmp,image/gif";

export function ImageUpload({
  onSelect,
  hasImage,
  fileName,
  disabled,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const browse = useCallback(() => inputRef.current?.click(), []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) onSelect(file);
    },
    [onSelect],
  );

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      className="hidden"
      onChange={(event) => {
        handleFiles(event.target.files);
        // Allow re-selecting the same file straight after a change.
        event.target.value = "";
      }}
    />
  );

  if (hasImage) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg glass-surface px-4 py-3">
        <p className="truncate text-xs font-mono-display text-muted-foreground">
          {fileName ?? "image loaded"}
        </p>
        <Button variant="outline" size="sm" onClick={browse} disabled={disabled}>
          <RefreshCw />
          Change image
        </Button>
        {hiddenInput}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload an image"
      onClick={browse}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          browse();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        "glass-surface flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragging
          ? "border-primary bg-primary/10 glow-primary"
          : "border-border hover:border-primary/60",
      )}
    >
      <div className="rounded-full bg-primary/10 p-4">
        <ImageUp className="h-7 w-7 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="font-mono-display text-sm text-foreground">
          Drop an image here
        </p>
        <p className="text-xs text-muted-foreground">
          or click to browse — JPG, PNG, WebP, BMP, GIF
        </p>
      </div>
      <p className="text-[11px] font-mono-display text-muted-foreground/70">
        Processed entirely in your browser — nothing is uploaded
      </p>
      {hiddenInput}
    </div>
  );
}
