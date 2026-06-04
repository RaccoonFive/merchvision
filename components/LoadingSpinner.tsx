type LoadingSpinnerProps = {
  label?: string;
  size?: "small" | "medium";
  variant?: "panel" | "inline" | "button";
};

export function LoadingSpinner({
  label,
  size = "medium",
  variant = "panel"
}: LoadingSpinnerProps) {
  return (
    <span
      aria-label={label}
      aria-live="polite"
      className={`loading-state loading-state-${variant}`}
      role={label ? "status" : undefined}
    >
      <span aria-hidden="true" className={`loading-spinner loading-spinner-${size}`} />
      {label ? <span>{label}</span> : null}
    </span>
  );
}
