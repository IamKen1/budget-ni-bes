import { getAllAccounts, getAllCategories } from "@/lib/queries";
import { NewTransactionForm } from "@/components/NewTransactionForm";

export default async function NewTransactionPage() {
  const [accounts, categories] = await Promise.all([
    getAllAccounts(),
    getAllCategories(),
  ]);

  return (
    <div className="flex flex-col gap-5 pb-4 lg:mx-auto lg:max-w-lg lg:px-4 lg:pt-6">
      <NewTransactionForm
        accounts={accounts.filter((a) => !a.archived)}
        categories={categories.filter((c) => !c.archived)}
      />
    </div>
  );
}
