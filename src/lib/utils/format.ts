export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyExact(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatPercentExact(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatMonths(months: number): string {
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (years === 0) return `${remaining} month${remaining !== 1 ? "s" : ""}`;
  if (remaining === 0) return `${years} year${years !== 1 ? "s" : ""}`;
  return `${years}y ${remaining}m`;
}
