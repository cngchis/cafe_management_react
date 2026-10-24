async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "Không thể xóa dữ liệu. Vui lòng thử lại.");
  return body as T;
}

export async function resetOperationalData() {
  const response = await fetch("/api/admin/data-reset", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmation: "XÓA DỮ LIỆU" }),
  });
  return readResponse<{ success: true }>(response);
}
