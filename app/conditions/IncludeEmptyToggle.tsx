"use client";

type IncludeEmptyToggleProps = {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
};

export default function IncludeEmptyToggle({ checked, onCheckedChange }: IncludeEmptyToggleProps) {
  return (
    <label className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        aria-label="Include conditions with no active trials"
      />
      <span className="select-none">Include empty conditions</span>
    </label>
  );
}
