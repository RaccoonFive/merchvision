"use client";

import { Filter, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GroupedNumberInput } from "@/components/GroupedNumberInput";

type Position = {
  left: number;
  top: number;
};

type FilterValue = string | boolean;

export type TableFilterField = {
  clearValue?: FilterValue;
  id: string;
  label: string;
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
  type?: "checkbox" | "number" | "select" | "text";
  value: FilterValue;
};

export function TableFilter({
  active = false,
  fields,
  label,
  onApply
}: {
  active?: boolean;
  fields: TableFilterField[];
  label: string;
  onApply: (values: Record<string, FilterValue>) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ left: 8, top: 8 });
  const [draft, setDraft] = useState<Record<string, FilterValue>>(() => fieldValues(fields));

  function updatePosition() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    setPosition({
      left: Math.max(8, Math.min(rect.right - 264, window.innerWidth - 272)),
      top: rect.bottom + 8
    });
  }

  function toggle() {
    if (!open) {
      setDraft(fieldValues(fields));
      updatePosition();
    }
    setOpen((current) => !current);
  }

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePress(event: PointerEvent) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Filter ${label}`}
        className={`table-filter-button${active ? " is-active" : ""}`}
        onClick={toggle}
        ref={buttonRef}
        title={`Filter ${label}`}
        type="button"
      >
        <Filter aria-hidden="true" size={13} strokeWidth={2} />
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <div
          aria-label={`Filter ${label}`}
          className="table-filter-popover"
          ref={popoverRef}
          role="dialog"
          style={position}
        >
          <div className="table-filter-popover-head">
            <strong>{label}</strong>
            <button aria-label={`Close ${label} filter`} onClick={() => setOpen(false)} type="button">
              <X aria-hidden="true" size={15} />
            </button>
          </div>
          <form className="table-filter-fields" onSubmit={(event) => {
            event.preventDefault();
            onApply(draft);
          }}>
            {fields.map((field) => {
              if (field.type === "checkbox") {
                return (
                  <label className="table-filter-check" key={field.id}>
                    <input
                      checked={draft[field.id] === true}
                      onChange={(event) => setDraft((current) => ({ ...current, [field.id]: event.target.checked }))}
                      type="checkbox"
                    />
                    {field.label}
                  </label>
                );
              }

              if (field.type === "select") {
                return (
                  <label key={field.id}>
                    {field.label}
                    <select
                      onChange={(event) => setDraft((current) => ({ ...current, [field.id]: event.target.value }))}
                      value={String(draft[field.id] ?? "")}
                    >
                      {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                );
              }

              const numeric = field.type === "number";

              return (
                <label key={field.id}>
                  {field.label}
                  {numeric ? (
                    <GroupedNumberInput
                      min="0"
                      onChange={(value) => setDraft((current) => ({ ...current, [field.id]: value }))}
                      placeholder={field.placeholder}
                      value={String(draft[field.id] ?? "")}
                    />
                  ) : (
                    <input
                      onChange={(event) => setDraft((current) => ({ ...current, [field.id]: event.target.value }))}
                      placeholder={field.placeholder}
                      type={field.type ?? "text"}
                      value={String(draft[field.id] ?? "")}
                    />
                  )}
                </label>
              );
            })}
            <div className="table-filter-actions">
              <button
                className="table-filter-clear"
                onClick={() => {
                  const cleared = clearFieldValues(fields);
                  setDraft(cleared);
                  onApply(cleared);
                }}
                type="button"
              >
                Clear
              </button>
              <button className="table-filter-apply" type="submit">Apply</button>
            </div>
          </form>
        </div>,
        document.body
      ) : null}
    </>
  );
}

function fieldValues(fields: TableFilterField[]): Record<string, FilterValue> {
  return Object.fromEntries(fields.map((field) => [field.id, field.value]));
}

function clearFieldValues(fields: TableFilterField[]): Record<string, FilterValue> {
  return Object.fromEntries(fields.map((field) => [
    field.id,
    field.clearValue ?? (field.type === "checkbox" ? false : "")
  ]));
}
