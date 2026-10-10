export type MetricTone = "profit" | "positive" | "negative" | "muted";

type MetricProps = {
  label: string;
  value: string;
  detail?: string;
  tone?: MetricTone;
  accent?: "sky" | "violet" | "gold";
  className?: string;
};

export function Metric({ label, value, detail, tone, accent, className }: MetricProps) {
  return (
    <div className={`metric${className ? ` ${className}` : ""}`} data-accent={accent} data-tone={tone}>
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}
