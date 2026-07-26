"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUndoToast } from "@/components/ToastContext";

export function LoggedToast({ activityId }: { activityId: string }) {
  const { showUndo } = useUndoToast();
  const router = useRouter();

  useEffect(() => {
    showUndo(activityId, "Transaction logged");
    router.replace("/transactions");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  return null;
}
