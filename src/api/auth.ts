export type Account = {
  id: string;
  username: string;
  displayName: string;
  role: "owner" | "manager" | "cashier";
};

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.message ?? "Không thể kết nối đến máy chủ.");
  }
  return body as T;
}

export async function login(username: string, password: string, destination: "/" | "/pos") {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password, destination }),
  });
  return parseResponse<{ account: Account; destination: "/" | "/pos" }>(response);
}

export async function getCurrentAccount(): Promise<Account | null> {
  const response = await fetch("/api/auth/me");
  if (response.status === 401) return null;
  return (await parseResponse<{ account: Account }>(response)).account;
}

export async function logout(): Promise<void> {
  const response = await fetch("/api/auth/logout", { method: "POST" });
  if (!response.ok) await parseResponse<void>(response);
}
