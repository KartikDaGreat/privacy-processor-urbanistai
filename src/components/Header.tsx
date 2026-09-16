import { Shield } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <Shield className="h-6 w-6 shrink-0 text-primary" strokeWidth={2.2} />
          <h1 className="gradient-text font-mono-display text-base font-bold sm:text-lg">
            Urbanist AI Privacy Processor
          </h1>
        </div>
        <p className="hidden text-xs font-mono-display text-muted-foreground sm:block">
          Remove metadata + face anonymization
        </p>
      </div>
    </header>
  );
}
