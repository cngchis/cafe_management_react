import type { Account } from "../api/auth";

const accessiblePaths: Record<Account["role"], readonly string[]> = {
  owner: ["/", "/pos", "/menu", "/employees", "/work-schedule", "/payroll", "/inventory-check", "/invoices", "/cashbook", "/customers", "/more", "/settings", "/price-lists", "/purchases", "/attendance", "/shift-handovers", "/reports/analysis", "/reports/daily", "/reports/products", "/reports/sales", "/activity"],
  manager: ["/", "/pos", "/menu", "/inventory-check", "/invoices", "/cashbook", "/customers", "/more", "/settings", "/price-lists", "/purchases", "/attendance", "/shift-handovers", "/reports/analysis", "/reports/daily", "/reports/products", "/reports/sales", "/activity"],
  cashier: ["/pos", "/invoices", "/more", "/attendance", "/shift-handovers"],
};

export function canAccessPath(role: Account["role"], path: string): boolean {
  return accessiblePaths[role].includes(path);
}

export function landingPath(role: Account["role"], requestedPath: "/" | "/pos"): string {
  return canAccessPath(role, requestedPath) ? requestedPath : "/pos";
}
