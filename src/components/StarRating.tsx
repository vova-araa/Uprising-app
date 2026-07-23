import { Star } from "lucide-react";
import { starBreakdown } from "@/lib/ratings";

interface DisplayProps {
  value: number; // 0-5 average
  size?: number;
  showValue?: boolean;
  count?: number;
}

/** Read-only star display for an average rating (supports half stars). */
export const StarDisplay = ({ value, size = 14, showValue = false, count }: DisplayProps) => {
  const { full, half, empty } = starBreakdown(value);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} van 5 sterren`}>
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} size={size} className="fill-primary text-primary" />
      ))}
      {half && (
        <span className="relative inline-block" style={{ width: size, height: size }}>
          <Star size={size} className="absolute inset-0 text-primary" />
          <span className="absolute inset-0 overflow-hidden" style={{ width: size / 2 }}>
            <Star size={size} className="fill-primary text-primary" />
          </span>
        </span>
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} size={size} className="text-muted-foreground/40" />
      ))}
      {showValue && (
        <span className="ml-1 text-xs font-semibold text-foreground">
          {value.toFixed(1)}{typeof count === "number" && <span className="text-muted-foreground font-normal"> ({count})</span>}
        </span>
      )}
    </span>
  );
};

interface InputProps {
  value: number; // 0-5 selected
  onChange: (v: number) => void;
  size?: number;
  disabled?: boolean;
}

/** Interactive 1-5 star picker. */
export const StarInput = ({ value, onChange, size = 30, disabled }: InputProps) => (
  <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Beoordeling">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        disabled={disabled}
        onClick={() => onChange(n)}
        role="radio"
        aria-checked={value === n}
        aria-label={`${n} ${n === 1 ? "ster" : "sterren"}`}
        className="transition-transform active:scale-90 disabled:opacity-50"
      >
        <Star size={size} className={n <= value ? "fill-primary text-primary" : "text-muted-foreground/40"} />
      </button>
    ))}
  </div>
);
