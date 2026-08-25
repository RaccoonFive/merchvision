import type { ComponentPropsWithoutRef } from "react";

type GroupedNumberInputProps = Omit<ComponentPropsWithoutRef<"input">, "inputMode" | "onChange" | "type" | "value"> & {
  onChange: (value: string) => void;
  value: string;
};

export function GroupedNumberInput({ onChange, value, ...props }: GroupedNumberInputProps) {
  return (
    <input
      {...props}
      inputMode={value.includes(".") ? "decimal" : "numeric"}
      onChange={(event) => {
        const normalized = normalizeGroupedNumberInput(event.target.value);
        if (normalized !== null) onChange(normalized);
      }}
      type="text"
      value={formatGroupedNumberInput(value)}
    />
  );
}

export function normalizeGroupedNumberInput(value: string): string | null {
  const ungrouped = value.replace(/[\s,\u00a0\u202f]/g, "");
  return /^\d*\.?\d*$/.test(ungrouped) ? ungrouped : null;
}

export function formatGroupedNumberInput(value: string): string {
  const [whole, decimal] = value.split(".");
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decimal === undefined ? groupedWhole : `${groupedWhole}.${decimal}`;
}
