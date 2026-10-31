export type CashbookEntryRecord = {
  id: string;
  title: string;
  reference: string;
  direction: "in" | "out";
  category: string;
  partyGroup: string | null;
  partyName: string | null;
  description: string | null;
  amountVnd: number;
  cashier: string | null;
  occurredAt: string;
  account: string;
  accountType: "cash" | "bank";
};

export type CashbookData = {
  entries: CashbookEntryRecord[];
  totals: { openingVnd: number; incomeVnd: number; expenseVnd: number };
};

export type BankAccount = {
  id: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  isDefault: boolean;
};

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "Không thể tải sổ quỹ.");
  return body as T;
}

export async function getCashbook(account: "cash" | "bank" | "all"): Promise<CashbookData> {
  return readResponse<CashbookData>(await fetch(`/api/cashbook?account=${account}`));
}

export async function createCashbookEntry(input: { title: string; amountVnd: number; direction: "in" | "out" }): Promise<void> {
  await readResponse(await fetch("/api/cashbook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }));
}

export async function getBankAccounts(): Promise<BankAccount[]> {
  return (await readResponse<{ accounts: BankAccount[] }>(await fetch("/api/cashbook/bank-accounts"))).accounts;
}

export async function saveBankAccount(input: Omit<BankAccount, "id" | "isDefault">): Promise<BankAccount> {
  return readResponse<BankAccount>(await fetch("/api/cashbook/bank-accounts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }));
}

export async function updateBankAccount(id: string, input: Omit<BankAccount, "id" | "isDefault">): Promise<BankAccount> {
  return readResponse<BankAccount>(await fetch(`/api/cashbook/bank-accounts/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }));
}

export async function deleteBankAccount(id: string): Promise<void> {
  await readResponse(await fetch(`/api/cashbook/bank-accounts/${id}`, { method: "DELETE" }));
}

export async function setDefaultBankAccount(id: string): Promise<void> {
  await readResponse(await fetch(`/api/cashbook/bank-accounts/${id}/default`, { method: "PATCH" }));
}
