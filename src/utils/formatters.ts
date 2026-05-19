export function formatCurrency(value?: number | null): string {
  const safeValue = Number.isFinite(value ?? NaN) ? value ?? 0 : 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(safeValue);
}

export function formatCurrencyWithCents(value?: number | null): string {
  const safeValue = Number.isFinite(value ?? NaN) ? value ?? 0 : 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeValue);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
