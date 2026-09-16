import { Droplet } from "lucide-react";
import { BLUR_METHODS, type BlurMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BlurSelectorProps {
  value: BlurMethod;
  onChange: (value: BlurMethod) => void;
  disabled?: boolean;
}

export function BlurSelector({ value, onChange, disabled }: BlurSelectorProps) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 flex items-center gap-2 text-[11px] font-mono-display uppercase tracking-widest text-muted-foreground">
        <Droplet className="h-3.5 w-3.5" />
        Blur method
      </legend>

      <div className="grid grid-cols-2 gap-2">
        {BLUR_METHODS.map((method) => {
          const selected = method.id === value;
          return (
            <button
              key={method.id}
              type="button"
              onClick={() => onChange(method.id)}
              aria-pressed={selected}
              title={method.description}
              className={cn(
                "rounded-lg border px-3 py-2 text-center font-mono-display text-xs transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                selected
                  ? "border-primary bg-primary/10 text-foreground glow-primary"
                  : "border-border bg-background/40 text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {method.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
