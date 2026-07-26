import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import {
  getAllTransactions,
  getAccountsWithBalances,
  getExpenseCategoriesWithProgress,
  getSavingsCategoriesWithProgress,
} from "@/lib/queries";
import { entryTypeLabel, personLabel, accountTypeLabel } from "@/lib/labels";

export async function GET() {
  const [transactions, accounts, expenseCategories, savingsCategories] = await Promise.all([
    getAllTransactions(),
    getAccountsWithBalances(),
    getExpenseCategoriesWithProgress(),
    getSavingsCategoriesWithProgress(),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BudgetNiBes";
  workbook.created = new Date();

  const txSheet = workbook.addWorksheet("Transactions");
  txSheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Type", key: "type", width: 16 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Account", key: "account", width: 16 },
    { header: "To Account", key: "toAccount", width: 16 },
    { header: "Category", key: "category", width: 18 },
    { header: "Who", key: "person", width: 10 },
    { header: "Note", key: "note", width: 32 },
    { header: "Account Balance After", key: "runningBalance", width: 18 },
  ];
  txSheet.getRow(1).font = { bold: true };
  for (const tx of [...transactions].reverse()) {
    txSheet.addRow({
      date: tx.date.toISOString().slice(0, 10),
      type: entryTypeLabel[tx.entryType],
      amount: tx.amount,
      account: tx.account.name,
      toAccount: tx.toAccount?.name ?? "",
      category: tx.category?.name ?? "",
      person: personLabel[tx.person],
      note: tx.particulars ?? "",
      runningBalance: tx.runningBalance ?? "",
    });
  }
  txSheet.getColumn("amount").numFmt = "#,##0.00";
  txSheet.getColumn("runningBalance").numFmt = "#,##0.00";

  const accountsSheet = workbook.addWorksheet("Accounts");
  accountsSheet.columns = [
    { header: "Name", key: "name", width: 20 },
    { header: "Type", key: "type", width: 12 },
    { header: "Current Balance", key: "balance", width: 18 },
    { header: "Monthly Target", key: "target", width: 16 },
  ];
  accountsSheet.getRow(1).font = { bold: true };
  for (const a of accounts) {
    accountsSheet.addRow({
      name: a.name,
      type: accountTypeLabel[a.type],
      balance: a.balance,
      target: a.monthlyTarget,
    });
  }
  accountsSheet.getColumn("balance").numFmt = "#,##0.00";
  accountsSheet.getColumn("target").numFmt = "#,##0.00";

  const budgetSheet = workbook.addWorksheet("Budget Categories");
  budgetSheet.columns = [
    { header: "Category", key: "name", width: 20 },
    { header: "Monthly Target", key: "target", width: 16 },
    { header: "Spent This Month", key: "spent", width: 18 },
    { header: "Remaining", key: "remaining", width: 16 },
  ];
  budgetSheet.getRow(1).font = { bold: true };
  for (const c of expenseCategories) {
    budgetSheet.addRow({
      name: c.name,
      target: c.monthlyTarget,
      spent: c.periodTotal,
      remaining: c.monthlyTarget - c.periodTotal,
    });
  }
  budgetSheet.getColumn("target").numFmt = "#,##0.00";
  budgetSheet.getColumn("spent").numFmt = "#,##0.00";
  budgetSheet.getColumn("remaining").numFmt = "#,##0.00";

  const savingsSheet = workbook.addWorksheet("Savings Funds");
  savingsSheet.columns = [
    { header: "Fund", key: "name", width: 20 },
    { header: "Goal Target", key: "goal", width: 16 },
    { header: "Current Balance", key: "balance", width: 18 },
    { header: "Remaining to Goal", key: "remaining", width: 18 },
    { header: "% Achieved", key: "pct", width: 12 },
  ];
  savingsSheet.getRow(1).font = { bold: true };
  for (const c of savingsCategories) {
    savingsSheet.addRow({
      name: c.name,
      goal: c.goalTarget,
      balance: c.allTimeTotal,
      remaining: c.goalTarget > 0 ? c.goalTarget - c.allTimeTotal : "",
      pct: c.goalTarget > 0 ? `${Math.round((c.allTimeTotal / c.goalTarget) * 100)}%` : "",
    });
  }
  savingsSheet.getColumn("goal").numFmt = "#,##0.00";
  savingsSheet.getColumn("balance").numFmt = "#,##0.00";
  savingsSheet.getColumn("remaining").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `BudgetNiBes_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
