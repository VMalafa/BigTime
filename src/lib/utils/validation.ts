export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isPositiveNumber(value: number): boolean {
  return typeof value === "number" && value > 0 && isFinite(value);
}

export function isValidAPR(apr: number): boolean {
  return typeof apr === "number" && apr >= 0 && apr <= 100;
}

export function isValidPercentage(value: number): boolean {
  return typeof value === "number" && value >= 0 && value <= 100;
}

export function generateId(): string {
  return crypto.randomUUID();
}
