export type SortDirection = "asc" | "desc";

type SortValue = number | string | null | undefined;

export function sortTableRows<T>(
  rows: T[],
  valueFor: (row: T) => SortValue,
  direction: SortDirection
): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftValue = valueFor(left.row);
      const rightValue = valueFor(right.row);
      const leftUnavailable = leftValue === null || leftValue === undefined;
      const rightUnavailable = rightValue === null || rightValue === undefined;

      // Keep unknown values at the end regardless of sort direction.
      if (leftUnavailable || rightUnavailable) {
        if (leftUnavailable && rightUnavailable) return left.index - right.index;
        return leftUnavailable ? 1 : -1;
      }

      const comparison = compareValues(leftValue, rightValue);
      if (comparison === 0) return left.index - right.index;
      return direction === "asc" ? comparison : -comparison;
    })
    .map(({ row }) => row);
}

function compareValues(left: SortValue, right: SortValue): number {
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
  }

  return Number(left) - Number(right);
}
