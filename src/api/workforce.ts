export type WorkShift = {
  id: string;
  employeeId: string;
  employeeName: string;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  hourlyRateVnd: number;
  note: string | null;
};

export type PayrollRow = {
  id: string;
  displayName: string;
  username: string;
  hourlyRateVnd: number;
  shiftCount: number;
  hoursWorked: number;
  amountVnd: number;
};

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "Không thể tải dữ liệu nhân sự.");
  return body as T;
}

export async function getWorkShifts(from: string, to: string): Promise<WorkShift[]> {
  return (await readResponse<{ shifts: WorkShift[] }>(await fetch(`/api/work-shifts?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`))).shifts;
}

export async function createWorkShift(input: { employeeId: string; startsAt: string; endsAt: string; breakMinutes: number; note?: string }): Promise<void> {
  await readResponse(await fetch("/api/work-shifts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }));
}

export async function deleteWorkShift(id: string): Promise<void> {
  const response = await fetch(`/api/work-shifts/${id}`, { method: "DELETE" });
  if (!response.ok) await readResponse(response);
}

export async function getPayroll(month: string): Promise<PayrollRow[]> {
  return (await readResponse<{ employees: PayrollRow[] }>(await fetch(`/api/payroll?month=${month}`))).employees;
}

export async function downloadPayroll(month: string): Promise<void> {
  const response = await fetch(`/api/payroll/export?month=${month}`);
  if (!response.ok) await readResponse(response);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `bang-luong-${month}.xlsx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
