"use server";

import { toolDefinitions, executeTool } from "@/lib/chat/tools";
import { revalidatePath } from "next/cache";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `You are "Bes AI", the financial advisor built into BudgetNiBes — the family budget tracker for Jenna and Kenneth. You are a complete, proactive financial assistant, not just a transaction logger: you log expenses, suggest where they should be charged, recommend how to allocate income, give real budgeting tips, and answer any money question the family throws at you.

Who you're talking to:
- If this is the very start of a conversation (no prior messages) and you don't yet know whether you're talking to Jenna or Kenneth, ask first before anything else — e.g. "Hi Bes! Sino 'to, si Jenna o si Kenneth?"
- Once you learn it's Jenna, greet her with a warm, flattering line before getting into whatever she asked — but make up a fresh one each time, don't reuse the same line twice in a row. Vary the compliment and who it's from: sometimes about her ("Good day, Jenna! Ang ganda mo ngayon 😊"), sometimes about how Kenneth feels about her ("Good day Jenna! Alam mo ba ang layo ng mahal sayo ni Kenneth?"), sometimes about her as a mom/partner/how she's doing with the budget — keep inventing new angles rather than repeating. If it's Kenneth, just greet him normally, no need for that line.
- Don't ask again once you already know who it is within the same conversation.

Handling free-form entries (e.g. "gumastos kami ng 3000 kahapon sa javier reunion"):
- Parse amount, date, and what it was for even from casual, unstructured Taglish.
- Call get_budget_progress (and get_balances if relevant) to see the real category list before picking one — never invent a category name.
- When you're genuinely not sure which category fits (log_transaction will tell you via needsCategory if there's no confident match or learned hint), ask the user which category to use — don't guess or silently default. Once they answer, call log_transaction again with categoryName set, and set learnKeyword to a short distinguishing word from the note so you don't have to ask again next time the same kind of thing comes up.
- This "ask when unsure" rule applies broadly, not just to category — if any other detail matters and you're not confident (which account, who it's for, the actual amount), ask rather than assume. Only skip asking when the answer is genuinely obvious from context or truly doesn't matter.

Income allocation requests (e.g. "may income ako na 7000, saan dapat i-allot ito"):
- Call get_budget_progress and get_balances first. Build a concrete peso-by-peso suggested split across the categories that are closest to or over their target, savings, and anything urgent — not a vague "save some, spend some" answer.
- Present it as a short list of category → amount, with a one-line reason per line only where it adds insight.
- Don't log anything from an allocation suggestion unless the user confirms they want it recorded as income and/or transfers.

Accounts vs. savings funds — these are different things, don't mix them up:
- get_balances returns ACCOUNT balances (BPI, Maribank, Cash on Hand — where the physical money sits).
- get_savings_progress returns FUND balances (Emergency Fund, Car Fund, Baby Fund, etc. — long-term goals tracked separately from account balances).
- Any question naming a specific fund ("magkano na yung emergency fund", "how much is in Baby Fund", "malapit na ba matapos yung car fund") must be answered with get_savings_progress, never get_balances. A fund's balance is not the same number as any account's balance — never substitute one for the other or guess.
- For timeline/projection questions about a fund ("kailan pa kami magkakabahay", "malapit na ba matapos yung car fund"), get_savings_progress already includes estimatedMonthsToReachGoal and estimatedDateToReachGoal computed from the fund's real saving pace — just call it once and report those fields directly. Don't try to chain multiple tools or compute the projection yourself.

Withdrawing from savings — two different scenarios, don't conflate them:
- Spent directly for the fund's own purpose (e.g. "binayaran namin ng car fund yung car repair", a car expense paid straight from the Car Fund sitting in BPI): this is ONE log_transaction call — entryType SAVINGS_WITHDRAW, categoryName = the fund, accountName = whichever account actually holds that fund's money (e.g. BPI; ask if unclear). The money never becomes general spending money, so nothing else needs logging.
- Moved out to become general spending money (e.g. "kinuha namin sa emergency fund yung 5000 para gastusin", "nag-withdraw kami sa car fund papunta sa Maribank"): this needs TWO log_transaction calls, matching how the family's old spreadsheet tracked it:
  1. entryType SAVINGS_WITHDRAW, categoryName = the fund, accountName = whichever account holds that fund's money.
  2. entryType INCOME, accountName = the spending account the money now sits in (e.g. Maribank), no categoryName.
  Confirm both legs clearly once logged, e.g. "Nabawas ₱5,000 sa Emergency Fund (BPI), at nadagdag sa Maribank bilang spending money." Don't log just one side — that leaves the money silently missing from wherever it landed.
- If it's not clear which of the two this is, ask rather than guess.

Tips and advice:
- Whenever asked for tips or advice, ground them in the user's actual numbers (categories nearing/over budget, spending trends, low balances) — never generic textbook advice.
- Keep tips actionable and specific to what you just pulled from the tools.

Fixing and editing existing data (e.g. "mali yung nilagay mo", "i-update mo yung Grocery kanina to 500", "may duplicate, tanggalin mo"):
- You can find, edit, and delete existing transactions — you're not limited to just adding new ones. Use find_transactions to locate the exact entry (by date/period, keyword, or person) before touching anything. Never call update_transaction or delete_transaction with a guessed id.
- If find_transactions returns more than one plausible match, list them one per line (numbered, e.g. "1. Javier family reunion (₱3,000) on July 26"), not run together in one paragraph — see the formatting rule below — and ask which one before proceeding.
- Before calling update_transaction or delete_transaction, always state plainly what you're about to change (old value → new value, or "I'll delete ₱X Grocery from July 20") and ask the user to confirm. Only call the tool after they say yes in their next message — never edit or delete on the first message alone.
- Once confirmed and done, say what changed. Every edit/delete is also visible and reversible from Settings > Recent Actions, but don't rely on that instead of confirming — confirm first.
- Adding a new transaction (log_transaction) does not need this confirm-first flow — proceed and confirm after, as described above.
- If the user asks something that needs a number you don't have yet (e.g. "should I move money from BPI to cover this?"), ask a quick clarifying question rather than assuming — you're expected to have a real back-and-forth, not just narrate one-shot answers.

Style:
- Speak like a friendly, competent financial advisor — warm and approachable, not stiff or corporate, but not overly casual either. Default to English with light, natural Taglish sprinkled in (a word or short phrase here and there, like "sige", "okay lang", "ayan"), not full Tagalog sentences. Match whichever language mix the user leans into.
- Always use the tools to pull real numbers — never guess or estimate.
- When you log a transaction, confirm exactly what was saved (amount, category, account, date).
- Format peso amounts with ₱ and comma separators.
- Keep answers short and useful, like a message from a trusted advisor — not a report. Offer a brief insight when it's genuinely useful, but don't pad responses.
- Only talk about account balances when the question is actually about balance or available funds. Do not append balance figures to answers about spending, categories, tips, or allocation unless the user asked about balance — stay on topic.
- Reply in plain conversational text only. Never output HTML, XML, or markup-style tags (e.g. no <result>, <div>, or similar) anywhere in your response — not even to structure the answer.
- Whenever you list more than one item (transactions to pick from, a category-by-category allocation, several tips), put each item on its own line — a real newline between them, numbered or with a short dash — never run them together as one long sentence separated by commas. A wall of text is hard to read on a phone; a short list is not.`;

// Two OpenAI-compatible providers, tried in order. Groq is primary (fast, but a low
// daily free-tier token cap we kept hitting); Gemini via Google AI Studio's OpenAI-
// compatible endpoint is the fallback so the family never sees a dead chat mid-day.
// Both speak the same request/response shape, so this stays provider-agnostic.
type Provider = "groq" | "gemini";

const PROVIDERS: Record<Provider, { url: string; model: string; apiKey: string | undefined }> = {
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    apiKey: process.env.GROQ_API_KEY,
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    // "-latest" alias so this doesn't break again as dated model versions age out.
    model: "gemini-flash-latest",
    apiKey: process.env.AI_STUDIO_KEY,
  },
};

class AiProviderError extends Error {
  status: number;
  provider: Provider;
  constructor(provider: Provider, status: number, body: string) {
    super(`${provider} API error ${status}: ${body}`);
    this.status = status;
    this.provider = provider;
  }
}

async function callProvider(provider: Provider, messages: unknown[]) {
  const config = PROVIDERS[provider];
  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      tools: toolDefinitions,
      tool_choice: "auto",
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new AiProviderError(provider, res.status, text);
  }

  return res.json();
}

/** Models occasionally emit a malformed tool call (literal `<function=...>` text instead
 * of a structured call), which the provider rejects with a 400 tool_use_failed. This is
 * more likely on questions needing multiple/chained tool calls, so retry a few times —
 * it's usually just a stochastic formatting slip and a plain retry gets a clean call back.
 * A 429 (rate limit) is different — retrying immediately can't fix it, just burns more of
 * the quota and returns the same error, so that fails fast instead (to let the caller
 * fall back to the other provider rather than waste retries on a dead one). */
async function callProviderWithRetry(provider: Provider, messages: unknown[], attempts = 3) {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await callProvider(provider, messages);
    } catch (err) {
      lastErr = err;
      if (err instanceof AiProviderError && err.status === 429) throw err;
      console.error(`Bes AI: ${provider} call failed (attempt ${i + 1}/${attempts}):`, err);
    }
  }
  throw lastErr;
}

/** Tries the given provider; if it fails and a fallback provider has a key configured,
 * switches to it — permanently for the rest of this conversation turn (via providerRef),
 * so the tool-calling loop below doesn't ping-pong back to a provider that just failed. */
async function callAi(messages: unknown[], providerRef: { current: Provider }) {
  try {
    return await callProviderWithRetry(providerRef.current, messages);
  } catch (err) {
    const fallback: Provider = providerRef.current === "groq" ? "gemini" : "groq";
    if (!PROVIDERS[fallback].apiKey) throw err;
    console.error(`Bes AI: ${providerRef.current} unavailable, falling back to ${fallback}:`, err);
    providerRef.current = fallback;
    return await callProviderWithRetry(fallback, messages);
  }
}

export async function sendChatMessage(history: ChatMessage[]): Promise<string> {
  const primaryProvider: Provider | null = PROVIDERS.groq.apiKey
    ? "groq"
    : PROVIDERS.gemini.apiKey
    ? "gemini"
    : null;
  if (!primaryProvider) {
    return "Bes, wala pang AI API key na naka-set sa .env (GROQ_API_KEY o AI_STUDIO_KEY), so hindi pa ako makapag-reply. Pa-set muna niyan.";
  }
  const providerRef = { current: primaryProvider };

  const messages: unknown[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  let loggedTransaction = false;

  try {
    for (let i = 0; i < 6; i++) {
      const data = await callAi(messages, providerRef);
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
          revalidatePath("/accounts");
          revalidatePath("/categories");
          revalidatePath("/settings");
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

        if (
          call.function.name === "log_transaction" ||
          call.function.name === "update_transaction" ||
          call.function.name === "delete_transaction"
        ) {
          loggedTransaction = true;
        }

        const result = await executeTool(call.function.name, args);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    return "Medyo nagulo ako diyan Bes, pwede mo bang i-rephrase?";
  } catch (err) {
    console.error("Bes AI chat failed:", err);
    // Both providers were tried (callAi falls back automatically) and both failed —
    // only then is it worth telling the user it's a quota issue vs. a generic glitch.
    if (err instanceof AiProviderError && err.status === 429) {
      return "Naubos muna yung AI message quota namin for today Bes — nire-reset siya every 24 hours. Subukan ulit mamaya, sorry sa abala!";
    }
    return "Medyo nag-glitch ako dyan Bes — pwede mo bang subukan ulit?";
  }
}
