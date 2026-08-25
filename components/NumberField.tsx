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
      <input id={id} min="0" onChange={(event) => onChange(event.target.value)} type="number" value={value} />
    </div>
  );
}
