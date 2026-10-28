import type { Account } from "../api/auth";

const accessiblePaths: Record<Account["role"], readonly string[]> = {
  owner: ["/", "/pos", "/pos/select", "/tables", "/menu", "/employees", "/work-schedule", "/payroll", "/inventory-check", "/invoices", "/cashbook", "/customers", "/more", "/settings", "/price-lists", "/purchases", "/attendance", "/shift-handovers", "/reports/analysis", "/reports/daily", "/reports/products", "/reports/sales", "/activity"],
  manager: ["/", "/pos", "/pos/select", "/tables", "/menu", "/inventory-check", "/invoices", "/cashbook", "/customers", "/more", "/settings", "/price-lists", "/purchases", "/attendance", "/shift-handovers", "/reports/analysis", "/reports/daily", "/reports/products", "/reports/sales", "/activity"],
  cashier: ["/", "/pos", "/pos/select", "/invoices", "/more", "/attendance", "/shift-handovers", "/reports/daily", "/work-schedule"],
};

export function canAccessPath(role: Account["role"], path: string): boolean {
  return accessiblePaths[role].includes(path);
}

export function landingPath(role: Account["role"], requestedPath: "/" | "/pos"): string {
  if (!canAccessPath(role, requestedPath)) return "/pos/select";
  return requestedPath === "/pos" ? "/pos/select" : requestedPath;
}
