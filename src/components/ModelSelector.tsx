import { Layers } from "lucide-react";
import { MODELS, type DetectionModelId } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  value: DetectionModelId;
  onChange: (value: DetectionModelId) => void;
  disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="mb-2 flex items-center gap-2 text-[11px] font-mono-display uppercase tracking-widest text-muted-foreground">
        <Layers className="h-3.5 w-3.5" />
        Detection model
      </legend>

      {MODELS.map((model) => {
        const selected = model.id === value;
        return (
          <button
            key={model.id}
            type="button"
            onClick={() => onChange(model.id)}
            aria-pressed={selected}
            className={cn(
              "w-full rounded-lg border px-3 py-2.5 text-left transition-all",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              selected
                ? "border-primary bg-primary/10 glow-primary"
                : "border-border bg-background/40 hover:border-primary/50 hover:bg-primary/5",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  selected ? "bg-primary" : "bg-muted-foreground/40",
                )}
              />
              <span className="font-mono-display text-xs text-foreground">
                {model.label}
              </span>
            </div>
            <p className="mt-0.5 pl-3.5 text-[11px] leading-snug text-muted-foreground">
              {model.description}
            </p>
          </button>
        );
      })}
    </fieldset>
  );
}
