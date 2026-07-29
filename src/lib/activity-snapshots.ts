function toNumber(value: unknown): number {
  return typeof value === "object" && value !== null && "toNumber" in value
    ? (value as { toNumber: () => number }).toNumber()
    : Number(value);
}

export function transactionSnapshot(tx: {
  date: Date;
  entryType: string;
  amount: unknown;
  person: string;
  particulars: string | null;
  accountId: string;
  categoryId: string | null;
  toAccountId: string | null;
}) {
  return {
    date: tx.date.toISOString(),
    entryType: tx.entryType,
    amount: toNumber(tx.amount),
    person: tx.person,
    particulars: tx.particulars,
    accountId: tx.accountId,
    categoryId: tx.categoryId,
    toAccountId: tx.toAccountId,
  };
}

export function accountSnapshot(a: {
  name: string;
  type: string;
  archived: boolean;
  sortOrder: number;
  monthlyTarget: unknown;
}) {
  return {
    name: a.name,
    type: a.type,
    archived: a.archived,
    sortOrder: a.sortOrder,
    monthlyTarget: toNumber(a.monthlyTarget),
  };
}

export function loanPaymentSnapshot(l: {
  payee: string;
  dueDate: Date;
  amount: unknown;
  particulars: string | null;
  remainingBalance: unknown;
  person: string;
  paid: boolean;
  sortOrder: number;
  accountId: string;
  categoryId: string | null;
  transactionId: string | null;
}) {
  return {
    payee: l.payee,
    dueDate: l.dueDate.toISOString(),
    amount: toNumber(l.amount),
    particulars: l.particulars,
    remainingBalance: l.remainingBalance === null ? null : toNumber(l.remainingBalance),
    person: l.person,
    paid: l.paid,
    sortOrder: l.sortOrder,
    accountId: l.accountId,
    categoryId: l.categoryId,
    transactionId: l.transactionId,
  };
}

export function categorySnapshot(c: {
  name: string;
  kind: string;
  monthlyTarget: unknown;
  goalTarget: unknown;
  archived: boolean;
  sortOrder: number;
}) {
  return {
    name: c.name,
    kind: c.kind,
    monthlyTarget: toNumber(c.monthlyTarget),
    goalTarget: toNumber(c.goalTarget),
    archived: c.archived,
    sortOrder: c.sortOrder,
  };
}
