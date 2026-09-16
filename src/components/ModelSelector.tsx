import { MODELS, type DetectionModelId } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  value: DetectionModelId;
  onChange: (value: DetectionModelId) => void;
  disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2.5 text-meta font-medium text-foreground">
        Detection model
      </legend>

      <div className="space-y-1">
        {MODELS.map((model) => {
          const selected = model.id === value;
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => onChange(model.id)}
              aria-pressed={selected}
              className={cn(
                "w-full rounded-md px-2.5 py-1.5 text-left transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-50",
                selected
                  ? "bg-primary/15 ring-1 ring-inset ring-primary/70"
                  : "hover:bg-raised",
              )}
            >
              <span
                className={cn(
                  "block text-meta font-medium",
                  selected ? "text-primary-text" : "text-foreground",
                )}
              >
                {model.label}
              </span>
              <span className="mt-0.5 block text-micro leading-snug text-muted-foreground">
                {model.description}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
