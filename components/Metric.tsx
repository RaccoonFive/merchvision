export type MetricTone = "profit" | "positive" | "negative" | "muted";

type MetricProps = {
  label: string;
  value: string;
  detail?: string;
  tone?: MetricTone;
  className?: string;
};

export function Metric({ label, value, detail, tone, className }: MetricProps) {
  return (
    <div className={`metric${className ? ` ${className}` : ""}`}>
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}
