const INR_DECIMAL = /^(0|[1-9]\d{0,12})(?:\.(\d{1,2}))?$/;

export function parseInrToMinor(value: string): number {
  const normalized = value.trim();
  const match = INR_DECIMAL.exec(normalized);
  if (!match)
    throw new Error("Enter a valid INR amount with at most two decimal places");
  const rupees = Number(match[1]);
  const paise = Number((match[2] ?? "").padEnd(2, "0"));
  const result = rupees * 100 + paise;
  if (!Number.isSafeInteger(result))
    throw new Error("The INR amount is too large");
  return result;
}

export function sumMinor(values: readonly number[]): number {
  return values.reduce((total, value) => {
    if (!Number.isSafeInteger(value))
      throw new Error("Money must use integer minor units");
    const next = total + value;
    if (!Number.isSafeInteger(next))
      throw new Error("The monetary total is too large");
    return next;
  }, 0);
}

export function formatInr(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor))
    throw new Error("Money must use integer minor units");
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function assertAllocationTotal(
  amountMinor: number,
  allocations: readonly number[],
) {
  if (amountMinor <= 0 || sumMinor(allocations) !== amountMinor)
    throw new Error("Payment allocations must equal the payment amount");
}
