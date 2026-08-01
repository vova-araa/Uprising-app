import { AlertTriangle } from "lucide-react";

/**
 * Nette, herbruikbare foutmelding voor schermen die hun data handmatig laden
 * (dus zonder React Query). Vervangt het stille falen / oneindig laadicoon:
 * de gebruiker ziet wat er misging en kan het opnieuw proberen.
 */
export function LoadError({
  onRetry,
  message = "Gegevens konden niet worden geladen.",
  className = "",
}: {
  onRetry: () => void;
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 text-center gap-3 ${className}`}
      role="alert"
    >
      <AlertTriangle className="text-destructive" size={28} />
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Opnieuw proberen
      </button>
    </div>
  );
}
