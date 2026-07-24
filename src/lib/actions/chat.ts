"use server";

import { toolDefinitions, executeTool } from "@/lib/chat/tools";
import { revalidatePath } from "next/cache";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `You are "Bes AI", the financial advisor built into BudgetNiBes — the family budget tracker for Jenna and Kenneth.

Style:
- Speak like a friendly, competent financial advisor — warm and approachable, not stiff or corporate, but not overly casual either. Default to English with light, natural Taglish sprinkled in (a word or short phrase here and there, like "sige", "okay lang", "ayan"), not full Tagalog sentences. Match whichever language mix the user leans into.
- Always use the tools to pull real numbers — never guess or estimate.
- When you log a transaction, confirm exactly what was saved (amount, category, account, date).
- If a request is missing key info (no amount, unclear account), ask a quick clarifying question before logging anything.
- Format peso amounts with ₱ and comma separators.
- Keep answers short and useful, like a message from a trusted advisor — not a report. Offer a brief insight or observation when it's genuinely useful (e.g. flagging that a category is close to its budget), but don't pad responses.`;

const GROQ_MODEL = "llama-3.3-70b-versatile";

async function callGroq(messages: unknown[]) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      tools: toolDefinitions,
      tool_choice: "auto",
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function sendChatMessage(history: ChatMessage[]): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    return "Bes, wala pang GROQ_API_KEY na naka-set sa .env, so hindi pa ako makapag-reply. Pa-set muna niyan.";
  }

  const messages: unknown[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  let loggedTransaction = false;

  for (let i = 0; i < 6; i++) {
    const data = await callGroq(messages);
    const choice = data.choices?.[0];
    const message = choice?.message;
    if (!message) throw new Error("No response from Groq.");

    const toolCalls = message.tool_calls as
      | { id: string; function: { name: string; arguments: string } }[]
      | undefined;

    if (!toolCalls || toolCalls.length === 0) {
      if (loggedTransaction) {
        revalidatePath("/");
        revalidatePath("/transactions");
      }
      return message.content ?? "Sorry Bes, wala akong masabi diyan.";
    }

    messages.push({
      role: "assistant",
      content: message.content ?? null,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(call.function.arguments || "{}");
        args = parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        args = {};
      }

      if (call.function.name === "log_transaction") loggedTransaction = true;

      const result = await executeTool(call.function.name, args);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return "Medyo nagulo ako diyan Bes, pwede mo bang i-rephrase?";
}
