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
      <legend className="mb-2.5 text-meta font-medium text-foreground">
        Blur method
      </legend>

      <div className="grid grid-cols-2 gap-1.5">
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
                "rounded-md px-2 py-2 text-meta transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-50",
                selected
                  ? "bg-primary/15 font-medium text-primary-text ring-1 ring-inset ring-primary/70"
                  : "bg-raised text-muted-foreground hover:text-foreground",
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
