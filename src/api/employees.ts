export type EmployeeRecord = {
  id: string;
  username: string;
  displayName: string;
  role: "manager" | "cashier";
  hourlyRateVnd: number;
  isActive: boolean;
  createdAt?: string;
};

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "Không thể xử lý nhân viên.");
  return body as T;
}

export async function getEmployees(): Promise<EmployeeRecord[]> {
  return (await readResponse<{ employees: EmployeeRecord[] }>(await fetch("/api/employees"))).employees;
}

export async function createEmployee(input: Pick<EmployeeRecord, "username" | "displayName" | "role" | "hourlyRateVnd"> & { password: string }): Promise<EmployeeRecord> {
  return (await readResponse<{ employee: EmployeeRecord }>(await fetch("/api/employees", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  }))).employee;
}

export async function updateEmployee(id: string, changes: Partial<Pick<EmployeeRecord, "displayName" | "role" | "hourlyRateVnd" | "isActive">>): Promise<EmployeeRecord> {
  return (await readResponse<{ employee: EmployeeRecord }>(await fetch(`/api/employees/${id}`, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(changes),
  }))).employee;
}
