import { GroupedNumberInput } from "@/components/GroupedNumberInput";

type NumberFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function NumberField({ id, label, value, onChange }: NumberFieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <GroupedNumberInput id={id} min="0" onChange={onChange} value={value} />
    </div>
  );
}
