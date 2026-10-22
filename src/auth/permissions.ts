import type { Account } from "../api/auth";

const accessiblePaths: Record<Account["role"], readonly string[]> = {
  owner: ["/", "/pos", "/menu", "/employees", "/work-schedule", "/payroll", "/inventory-check", "/invoices", "/cashbook", "/customers", "/more", "/settings"],
  manager: ["/", "/pos", "/menu", "/inventory-check", "/invoices", "/cashbook", "/customers", "/more", "/settings"],
  cashier: ["/pos", "/invoices", "/more"],
};

export function canAccessPath(role: Account["role"], path: string): boolean {
  return accessiblePaths[role].includes(path);
}

export function landingPath(role: Account["role"], requestedPath: "/" | "/pos"): string {
  return canAccessPath(role, requestedPath) ? requestedPath : "/pos";
}
