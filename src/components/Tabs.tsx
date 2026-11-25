"use client";

/** Segmented tab bar (prototype `.seg` style) that scrolls sideways on small screens. */
export function Tabs<T extends string>({ tabs, value, onChange, label }: {
  tabs: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg tabs-scroll" role="tablist" aria-label={label}>
      {tabs.map(([v, text]) => (
        <button key={v} role="tab" aria-selected={value === v} onClick={() => onChange(v)}
          style={value === v ? { background: "var(--text)", color: "var(--invert)" } : undefined}>
          {text}
        </button>
      ))}
    </div>
  );
}
