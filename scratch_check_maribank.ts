import "dotenv/config";
import { prisma } from "@/lib/prisma";

function toNumber(v: unknown): number {
  return typeof v === "object" && v !== null && "toNumber" in v
    ? (v as { toNumber: () => number }).toNumber()
    : Number(v);
}

async function main() {
  const account = await prisma.account.findFirst({ where: { name: "Maribank" } });
  if (!account) throw new Error("Maribank account not found");

  const txs = await prisma.transaction.findMany({
    where: { OR: [{ accountId: account.id }, { toAccountId: account.id }] },
    include: { category: true },
    orderBy: { date: "asc" },
  });

  let balance = 0;
  for (const tx of txs) {
    const amount = toNumber(tx.amount);
    if (tx.accountId === account.id) {
      if (tx.entryType === "INCOME" || tx.entryType === "SAVINGS_DEPOSIT") balance += amount;
      else if (tx.entryType === "EXPENSE" || tx.entryType === "SAVINGS_WITHDRAW") balance -= amount;
      else if (tx.entryType === "TRANSFER") balance -= amount;
    }
    if (tx.toAccountId === account.id && tx.entryType === "TRANSFER") balance += amount;
  }

  console.log("Total transactions touching Maribank:", txs.length);
  console.log("Date range:", txs[0]?.date, "to", txs[txs.length - 1]?.date);
  console.log("Computed balance:", balance);
  console.log("---");
  console.log("By entryType:");
  const byType = new Map<string, { count: number; total: number }>();
  for (const tx of txs) {
    if (tx.accountId !== account.id) continue;
    const key = tx.entryType;
    const cur = byType.get(key) ?? { count: 0, total: 0 };
    cur.count++;
    cur.total += toNumber(tx.amount);
    byType.set(key, cur);
  }
  for (const [k, v] of byType) console.log(`  ${k}: ${v.count} txs, total ${v.total}`);
  console.log("---");
  console.log("All rows:");
  for (const tx of txs) {
    console.log(
      `${tx.date.toISOString().slice(0, 10)} | ${tx.entryType} | ${toNumber(tx.amount)} | ${tx.category?.name ?? "-"} | ${tx.particulars ?? ""}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
