"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableFilter, type TableFilterField } from "@/components/TableFilter";
import type { SortDirection } from "@/lib/tableSort";

export function SortableTableHeader({
  label,
  active,
  direction,
  onSort,
  filter
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
  filter?: {
    active?: boolean;
    fields: TableFilterField[];
    onApply: (values: Record<string, string | boolean>) => void;
  };
}) {
  const nextDirection: SortDirection = active && direction === "asc" ? "desc" : "asc";
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={active ? "is-sorted" : undefined}
    >
      <div className="table-header-controls">
        <button
          aria-label={`Sort by ${label} ${nextDirection === "asc" ? "ascending" : "descending"}`}
          className="table-sort-button"
          onClick={onSort}
          type="button"
        >
          <span>{label}</span>
          <Icon aria-hidden="true" size={14} strokeWidth={2} />
        </button>
        {filter ? <TableFilter active={filter.active} fields={filter.fields} label={label} onApply={filter.onApply} /> : null}
      </div>
    </th>
  );
}
