'use client';
import { CONDITIONS, ConditionSlug } from '@/shared/conditions';

export default function ConditionSelect(
  { name = 'condition', value, defaultValue = '', onChange, className = '' }:
    { name?: string; value?: ConditionSlug; defaultValue?: string; onChange?: (v: ConditionSlug) => void; className?: string }
) {
  return (
    <select
      name={name}
      defaultValue={value ?? defaultValue}
      onChange={e => onChange?.(e.target.value as ConditionSlug)}
      className={`pm-native-select w-full border rounded p-2 ${className}`}
      aria-label="Condition"
    >
      {CONDITIONS.map(c => (
        <option key={c.slug} value={c.slug}>{c.label}</option>
      ))}
    </select>
  );
}

