import { useCallback, useRef, useState } from "react";
import { ImageUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  onSelect: (file: File) => void;
  /** Once a photo is loaded the zone collapses so the frame takes the stage. */
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
      <div className="flex items-center justify-between gap-3">
        <p className="truncate font-mono-display text-micro text-muted-foreground">
          {fileName ?? "image loaded"}
        </p>
        <Button variant="ghost" size="sm" onClick={browse} disabled={disabled}>
          <RefreshCw />
          Replace photo
        </Button>
        {hiddenInput}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Choose a photo to anonymize"
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
        "grid-field group grid cursor-pointer place-items-center rounded-panel border border-dashed px-6 py-20 text-center transition-colors",
        isDragging
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/70",
      )}
    >
      <div className="max-w-md space-y-4">
        <ImageUp
          className={cn(
            "mx-auto h-8 w-8 transition-colors",
            isDragging ? "text-primary-text" : "text-muted-foreground",
          )}
          strokeWidth={1.6}
        />
        <div className="space-y-1.5">
          <p className="text-lead font-medium text-foreground">
            Drop a photo here
          </p>
          <p className="text-meta text-muted-foreground">
            Or click to choose. JPG, PNG, WebP, BMP and GIF all work.
          </p>
        </div>
        <p className="font-mono-display text-micro text-muted-foreground">
          stays on this device
        </p>
      </div>
      {hiddenInput}
    </div>
  );
}
