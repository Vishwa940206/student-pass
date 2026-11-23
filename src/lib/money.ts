/** All money is integer LKR cents. */
export const toCents = (rupees: number) => Math.round(rupees * 100);

export function formatLkr(cents: number): string {
  const rupees = cents / 100;
  return (
    "LKR " +
    rupees.toLocaleString("en-LK", {
      minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}
