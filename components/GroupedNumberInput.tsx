import type { ComponentPropsWithoutRef } from "react";

type GroupedNumberInputProps = Omit<ComponentPropsWithoutRef<"input">, "inputMode" | "onChange" | "type" | "value"> & {
  onChange: (value: string) => void;
  value: string;
};

export function GroupedNumberInput({ onChange, value, ...props }: GroupedNumberInputProps) {
  return (
    <input
      {...props}
      inputMode="text"
      onChange={(event) => {
        const normalized = normalizeGroupedNumberInput(event.target.value);
        if (normalized !== null) onChange(normalized);
      }}
      spellCheck={false}
      title={props.title ?? "Enter a number; k, m, and b suffixes are supported."}
      type="text"
      value={formatGroupedNumberInput(value)}
    />
  );
}

export function normalizeGroupedNumberInput(value: string): string | null {
  const ungrouped = value.replace(/[\s,\u00a0\u202f]/g, "");
  if (/^\d*\.?\d*$/.test(ungrouped)) return ungrouped;

  const shorthand = ungrouped.match(/^(\d*\.?\d+)([kmb])$/i);
  if (!shorthand) return null;

  const suffix = shorthand[2].toLowerCase() as "k" | "m" | "b";
  const exponent = { k: 3, m: 6, b: 9 }[suffix];
  return shiftDecimalRight(shorthand[1], exponent);
}

export function formatGroupedNumberInput(value: string): string {
  const [whole, decimal] = value.split(".");
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decimal === undefined ? groupedWhole : `${groupedWhole}.${decimal}`;
}

function shiftDecimalRight(value: string, places: number): string {
  const [whole = "", decimal = ""] = value.split(".");
  const digits = `${whole}${decimal}`;
  const decimalIndex = whole.length + places;
  const shifted = decimalIndex >= digits.length
    ? `${digits}${"0".repeat(decimalIndex - digits.length)}`
    : `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  const [shiftedWhole, shiftedDecimal] = shifted.split(".");
  const normalizedWhole = shiftedWhole.replace(/^0+(?=\d)/, "") || "0";
  const normalizedDecimal = shiftedDecimal?.replace(/0+$/, "");

  return normalizedDecimal ? `${normalizedWhole}.${normalizedDecimal}` : normalizedWhole;
}
