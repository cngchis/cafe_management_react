export type ServiceTable = { id: string; roomName: string; tableName: string; isOccupied: boolean; activeOrderId: string | null };

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "Không thể tải danh sách phòng bàn.");
  return body as T;
}

export async function getServiceTables(): Promise<ServiceTable[]> {
  const response = await fetch("/api/service-tables");
  return (await readResponse<{ tables: ServiceTable[] }>(response)).tables;
}

export async function createServiceTable(input: { roomName: string; tableName: string }): Promise<void> {
  const response = await fetch("/api/service-tables", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  });
  await readResponse<{ table: Pick<ServiceTable, "id" | "roomName" | "tableName"> }>(response);
}

export async function deactivateServiceTable(id: string): Promise<void> {
  const response = await fetch(`/api/service-tables/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) await readResponse<void>(response);
}
