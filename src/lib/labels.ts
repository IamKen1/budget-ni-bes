import type { AccountType, EntryType, Person } from "@/generated/prisma/client";

export const accountTypeLabel: Record<AccountType, string> = {
  BANK: "Bank",
  CASH: "Cash",
  EWALLET: "E-Wallet",
};

export const entryTypeLabel: Record<EntryType, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
  SAVINGS_DEPOSIT: "Savings Deposit",
  SAVINGS_WITHDRAW: "Savings Withdraw",
  TRANSFER: "Transfer",
};

export const personLabel: Record<Person, string> = {
  JENNA: "Jenna",
  KENNETH: "Kenneth",
  SHARED: "Shared",
};

export const personInitial: Record<Person, string> = {
  JENNA: "J",
  KENNETH: "K",
  SHARED: "S",
};
