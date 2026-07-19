import { useAddressSearch } from "@/hooks/useAddressSearch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2, Search } from "lucide-react";

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

const AddressInput = ({ value, onChange, label = "Adres", placeholder = "Zoek adres..." }: AddressInputProps) => {
  const { suggestions, showSuggestions, searching, search, select, show, hide } = useAddressSearch();

  return (
    <div className="relative">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          value={value}
          onChange={e => {
            onChange(e.target.value);
            search(e.target.value);
          }}
          onFocus={show}
          onBlur={hide}
          placeholder={placeholder}
        />
        {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
        {!searching && value.length >= 3 && <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-40" />}
      </div>
      {showSuggestions && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-start gap-2"
              onMouseDown={() => onChange(select(s))}
            >
              <MapPin size={12} className="mt-0.5 shrink-0 text-primary" />
              <span className="line-clamp-2">{s.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressInput;
