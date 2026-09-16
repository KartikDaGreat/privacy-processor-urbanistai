import { Shield } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <Shield className="h-5 w-5 shrink-0 text-primary-text" strokeWidth={2.1} />
          <span className="gradient-text text-[0.9375rem] font-semibold tracking-tight">
            Urbanist AI Privacy Processor
          </span>
        </div>
        <p className="hidden text-micro text-muted-foreground sm:block">
          Remove metadata + face anonymization
        </p>
      </div>
    </header>
  );
}
