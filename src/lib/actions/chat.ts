"use server";

import dayjs from "dayjs";
import { toolDefinitions, executeTool } from "@/lib/chat/tools";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `You are "Bes AI", the financial advisor built into BudgetNiBes — the family budget tracker for Jenna and Kenneth. You are a complete, proactive financial assistant, not just a transaction logger: you log expenses, suggest where they should be charged, recommend how to allocate income, give real budgeting tips, and answer any money question the family throws at you.

Who you're talking to:
- If this is the very start of a conversation (no prior messages) and you don't yet know whether you're talking to Jenna or Kenneth, ask first before anything else — e.g. "Hi Bes! Sino 'to, si Jenna o si Kenneth?"
- Once you learn it's Jenna, greet her with a warm, flattering line before getting into whatever she asked — but make up a fresh one each time, don't reuse the same line twice in a row. Vary the compliment and who it's from: sometimes about her ("Good day, Jenna! Ang ganda mo ngayon 😊"), sometimes about how Kenneth feels about her ("Good day Jenna! Alam mo ba ang layo ng mahal sayo ni Kenneth?"), sometimes about her as a mom/partner/how she's doing with the budget — keep inventing new angles rather than repeating. If it's Kenneth, just greet him normally, no need for that line.
- Don't ask again once you already know who it is within the same conversation.

How the app works — answer "how do I..." / "paano..." questions about BudgetNiBes itself, and offer to just do it:
- Home dashboard: total balance, this month's income/expense/saved, budget progress bars, savings goals, recent activity. Tap the eye icon to hide/show balances (privacy toggle). Tap any account or category card to see just its transactions.
- Transactions / History: every transaction, tap one to view full detail with Edit and Delete buttons right there.
- Accounts page: add accounts, set a monthly deposit target, archive/restore.
- Categories page: add expense categories or savings funds, set monthly/goal targets, archive/restore.
- Settings: "Recent Actions" lists the last ~20 changes with an Undo button each (everything is reversible this way, including things you or I did); "Export" downloads everything as an Excel file; "Danger Zone" has a passcode-gated "Clear all transactions" that resets all balances to zero but keeps accounts/categories.
- Desktop (wide screen): a single-page dashboard — sidebar with balances/accounts/categories, a quick-add form, and the transaction list, all without navigating between pages.
- When the user asks how to do something you actually have a tool for (log a transaction, edit/delete one, create or archive an account/category, change a target), explain briefly if useful, then explicitly ask if they'd like you to just do it right now instead of them doing it manually — e.g. "Gusto mo ba ako na lang gumawa nito?" If they say yes, do it using the same confirm-first rules as everywhere else (ask when unsure, confirm before archiving/deleting). When they ask about something you can't do (e.g. desktop-only features, changing the passcode), just explain where to find it.

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

Batch allocation requests (e.g. "allocate the following: 2500 Emergency fund for BPI / 1000 Home Fund for BPI / 5000 Baby Fund for BPI"):
- These list several fund deposits (or expenses) in one message, one item per line or per "/". Parse every item first — amount, fund/category name, account — before calling anything.
- Then call log_transaction once per item (entryType SAVINGS_DEPOSIT, the item's categoryName and amount, accountName as given), issuing all of them as separate tool calls rather than trying to cram multiple items into one call's arguments. It's fine to make several log_transaction calls in the same turn.
- If any single item's account is omitted, reuse the account stated earlier in the same message for the rest. If a fund name doesn't match an existing category, treat it like any other ambiguous category — ask rather than guess.
- Once all items are saved, confirm the full list back in one short message (item — amount — account), not one confirmation per item.

Moving money between accounts (e.g. "mag-transfer ka ng 2000 galing BPI papunta Maribank"):
- Use transfer_between_accounts for plain account-to-account movement of already-general spending money. Don't use two log_transaction calls for this — that pattern is only for the savings-fund scenario above.

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

Special days (today's real date is given to you in a separate message right after this one):
- The rule is fixed: monthsary is the 12th of every month, wedding anniversary is January 24. If asked "kailan ang monthsary/anniversary namin?", just state that rule directly — don't try to compute or guess a specific past/next date, and never describe it as "kahapon"/"bukas"/some other relative day unless you've actually checked the date you were given against the 12th and gotten it exactly right.
- If today is the 12th of any month, it's their monthsary. If today is January 24, it's their wedding anniversary.
- If you already know it's Jenna, greet her with a warm "Happy Monthsary!" or "Happy Wedding Anniversary!" (fresh wording each time, don't reuse the flattery lines verbatim) before getting into whatever she asked.
- If you don't yet know whether it's Jenna or Kenneth, just say "Happy Monthsary, Bes!" or "Happy Anniversary, Bes!" — don't ask who it is just for this, and don't assume it's Jenna.
- Only greet once per conversation, not on every message that same day. If it's not actually the 12th or Jan 24 per the date you were given, don't mention either occasion.

Wiping everything and starting fresh (e.g. "iclear mo lahat at magstart tayo sa 5000 sa BPI"):
- You can do this with reset_all_transactions — but it's irreversible, so never call it on the first message. First state plainly what will happen: every transaction gets deleted, every account and fund balance goes to zero, and then (if they gave a starting amount) that amount gets logged as the new balance for the account named. Wait for an explicit yes.
- Only after they confirm, ask for the app passcode (the same one used to unlock the app / Settings > Danger Zone). Never call reset_all_transactions without a passcode the user typed in this conversation for this request — don't reuse one from earlier in the chat for something else, don't guess it.
- If they only say "iclear mo lahat" with no starting amount, that's fine — just skip the starting balance step and confirm balances are now zero.

Style:
- Speak like a friendly, competent financial advisor — warm and approachable, not stiff or corporate, but not overly casual either. Default to English with light, natural Taglish sprinkled in (a word or short phrase here and there, like "sige", "okay lang", "ayan"), not full Tagalog sentences. Match whichever language mix the user leans into.
- Always use the tools to pull real numbers — never guess or estimate.
- When you log a transaction, confirm exactly what was saved (amount, category, account, date).
- Format peso amounts with ₱ and comma separators.
- Keep answers short and useful, like a message from a trusted advisor — not a report. A tips or allocation answer should read like 4-6 short lines total, not a bulleted essay with a sub-explanation under every point. Offer a brief insight when it's genuinely useful, but don't pad responses, and don't always close with a generic "let me know how you'd like to proceed"-style line — vary it or skip it.
- Only talk about account balances when the question is actually about balance or available funds. Do not append balance figures to answers about spending, categories, tips, or allocation unless the user asked about balance — stay on topic.
- This chat only renders plain text, not markdown — never use **bold**, tables (| like | this |), headers (#), or any other markdown syntax, since the symbols themselves would show up literally on screen instead of being styled. For emphasis just say the number or word plainly, or lead with it. Never output HTML, XML, or markup-style tags (e.g. no <result>, <div>, or similar) either.
- Whenever you list more than one item (transactions to pick from, a category-by-category allocation, several tips), put each item on its own line — a real newline between them, numbered or with a short dash — never run them together as one long sentence separated by commas, and never as a markdown table. A wall of text is hard to read on a phone; a short list is not.`;

// An ordered chain of OpenAI-compatible providers/models, all free tier, tried in
// order until one answers. More entries = more daily runway for zero cost, since each
// is its own separately-metered quota. Order is fastest/most-generous first, tiniest
// quota (Gemini, 20 req/day) last so it's only ever used as a last resort.
type ProviderConfig = {
  id: string;
  url: string;
  model: string;
  apiKey: string | undefined;
  headers?: Record<string, string>;
};

const PROVIDERS: ProviderConfig[] = [
  {
    id: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    apiKey: process.env.GROQ_API_KEY,
  },
  // OpenRouter meters free (":free") models separately per model, so two different
  // free models on the same account/key act as two more independent daily quotas.
  // Verified working with tool-calling as of this writing — OpenRouter's free model
  // lineup churns, so if one 404s as "unavailable for free" later, check
  // https://openrouter.ai/api/v1/models for a current ":free" model with
  // supported_parameters including "tools" and swap it in.
  {
    id: "openrouter-nemotron",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    apiKey: process.env.OPENROUTER_KEY,
  },
  {
    id: "openrouter-gpt-oss",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "openai/gpt-oss-20b:free",
    apiKey: process.env.OPENROUTER_KEY,
  },
  {
    id: "gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    // "-latest" alias so this doesn't break again as dated model versions age out.
    model: "gemini-flash-latest",
    apiKey: process.env.AI_STUDIO_KEY,
  },
];

class AiProviderError extends Error {
  status: number;
  providerId: string;
  constructor(providerId: string, status: number, body: string) {
    super(`${providerId} API error ${status}: ${body}`);
    this.status = status;
    this.providerId = providerId;
  }
}

async function callProvider(provider: ProviderConfig, messages: unknown[]) {
  const res = await fetch(provider.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
      ...provider.headers,
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      tools: toolDefinitions,
      tool_choice: "auto",
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new AiProviderError(provider.id, res.status, text);
  }

  return res.json();
}

async function callProviderWithRetry(provider: ProviderConfig, messages: unknown[], attempts = 4) {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await callProvider(provider, messages);
    } catch (err) {
      lastErr = err;
      if (err instanceof AiProviderError && err.status === 429) throw err;
      console.error(`Bes AI: ${provider.id} call failed (attempt ${i + 1}/${attempts}):`, err);
    }
  }
  throw lastErr;
}

/** Groq's error text gives an accurate wait time for its daily token cap, e.g.
 * "Please try again in 1h15m51.552s." — parse it so we know exactly when to retry.
 * Free-tier "requests per day" quotas (Gemini, OpenRouter free models) reset roughly
 * every 24h, but any retryDelay they return (e.g. Gemini's "17s") is a generic
 * per-minute hint that wildly understates a daily-quota wait, so that's ignored in
 * favor of a flat 24h whenever the error body itself says the limit is per-day. */
function parseRetryAfterMs(providerId: string, body: string): number {
  if (providerId === "groq") {
    const match = body.match(/try again in\s*(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/i);
    if (match) {
      const hours = Number(match[1] ?? 0);
      const minutes = Number(match[2] ?? 0);
      const seconds = Number(match[3] ?? 0);
      const ms = ((hours * 60 + minutes) * 60 + seconds) * 1000;
      if (ms > 0) return ms;
    }
  }
  if (/per\s*day/i.test(body) || /PerDay/i.test(body)) {
    return 24 * 60 * 60 * 1000;
  }
  return 5 * 60 * 1000;
}

/** Remembers a 429 so subsequent messages skip straight past this provider instead of
 * re-hitting it (and wasting other providers' tiny daily quotas on a doomed retry)
 * every single time until this provider's own reset window has actually passed. */
async function markProviderExhausted(providerId: string, body: string) {
  const retryAfter = new Date(Date.now() + parseRetryAfterMs(providerId, body));
  await prisma.aiProviderStatus.upsert({
    where: { provider: providerId },
    update: { retryAfter },
    create: { provider: providerId, retryAfter },
  });
}

async function getExhaustedProviders(): Promise<Map<string, Date>> {
  const rows = await prisma.aiProviderStatus.findMany();
  const now = new Date();
  const exhausted = new Map<string, Date>();
  for (const row of rows) {
    if (row.retryAfter > now) exhausted.set(row.provider, row.retryAfter);
  }
  return exhausted;
}

/** Walks the provider chain starting from wherever the last successful (or last-tried)
 * call left off, skipping anything already known-exhausted, and sticks with the first
 * one that answers for the rest of this turn (via chainPositionRef) — so a 6-iteration
 * tool-calling loop doesn't re-try providers that already failed earlier in the turn. */
async function callAi(
  messages: unknown[],
  candidates: ProviderConfig[],
  chainPositionRef: { current: number },
  knownExhausted: Map<string, Date>
) {
  let lastErr: unknown;
  for (let i = chainPositionRef.current; i < candidates.length; i++) {
    const provider = candidates[i];
    if (knownExhausted.has(provider.id)) continue;
    try {
      const result = await callProviderWithRetry(provider, messages);
      chainPositionRef.current = i;
      return result;
    } catch (err) {
      lastErr = err;
      if (err instanceof AiProviderError && err.status === 429) {
        await markProviderExhausted(provider.id, err.message);
        knownExhausted.set(provider.id, new Date(Date.now() + parseRetryAfterMs(provider.id, err.message)));
      }
      console.error(`Bes AI: ${provider.id} unavailable, trying next:`, err);
    }
  }
  throw lastErr;
}

/** The chat UI renders plain text only (no markdown parser), and the free fallback
 * models don't all follow the "no markdown" prompt instruction as reliably as the
 * primary one — so this is a safety net that strips common markdown syntax from
 * whatever comes back, regardless of which provider answered. */
function stripMarkdown(text: string): string {
  let out = text;
  out = out.replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ""));
  out = out.replace(/\*\*\*(.+?)\*\*\*/g, "$1");
  out = out.replace(/\*\*(.+?)\*\*/g, "$1");
  out = out.replace(/__(.+?)__/g, "$1");
  out = out.replace(/(^|[^*])\*(?!\*)([^*\n]+?)\*(?!\*)/g, "$1$2");
  out = out.replace(/^[ \t]*#{1,6}[ \t]+/gm, "");
  // Table separator rows, e.g. "|---|---|" or ":--|--:". Note: [ \t] not \s here —
  // \s also matches newlines, which would swallow the line break into the match and
  // silently delete it (the replacement callback only returns the row text).
  out = out.replace(/^[ \t]*\|?[ \t:|-]*-{2,}[ \t:|-]*\|?[ \t]*$/gm, "");
  // Remaining table rows: "| a | b |" -> "a — b"
  out = out.replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (_m, row: string) =>
    row
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean)
      .join(" — ")
  );
  out = out.replace(/\|/g, " ");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

// Client sends the full running conversation on every turn (stateless API), and it only
// grows. Past a point that's pure token waste — the model re-fetches real numbers from
// tools every time anyway, it never relies on old chat text for data. Cap what we forward,
// but always keep the opening exchange since that's where "Jenna or Kenneth?" gets
// answered and the system prompt says never to ask that twice in one conversation.
const MAX_HISTORY_MESSAGES = 20;

function trimHistory(history: ChatMessage[]): ChatMessage[] {
  if (history.length <= MAX_HISTORY_MESSAGES) return history;
  const head = history.slice(0, 2);
  const tail = history.slice(-(MAX_HISTORY_MESSAGES - head.length));
  return [...head, ...tail];
}

export async function sendChatMessage(history: ChatMessage[]): Promise<string> {
  const configured = PROVIDERS.filter((p) => p.apiKey);
  if (configured.length === 0) {
    return "Bes, wala pang AI API key na naka-set sa .env (hal. GROQ_API_KEY), so hindi pa ako makapag-reply. Pa-set muna niyan.";
  }

  // All configured providers already known to be past their daily cap? Say so
  // immediately — don't spend a single request confirming what we already know,
  // especially since some of these (Gemini, OpenRouter free models) only allow a
  // couple dozen requests/day total.
  const exhausted = await getExhaustedProviders();
  const available = configured.filter((p) => !exhausted.has(p.id));
  if (available.length === 0) {
    const soonest = new Date(Math.min(...configured.map((p) => exhausted.get(p.id)!.getTime())));
    return `Naubos muna yung AI message quota namin for today Bes — magre-reset ito around ${dayjs(soonest).format("h:mm A")}. Subukan ulit mamaya, sorry sa abala!`;
  }

  const chainPositionRef = { current: PROVIDERS.indexOf(available[0]) };

  const messages: unknown[] = [
    { role: "system", content: SYSTEM_PROMPT },
    // Kept separate from SYSTEM_PROMPT (which is otherwise byte-identical across every
    // call) so the static instructions stay eligible for provider-side prompt caching —
    // only this line changes, and only once a day.
    { role: "system", content: `Today's date is ${dayjs().format("YYYY-MM-DD (dddd)")}.` },
    ...trimHistory(history).map((m) => ({ role: m.role, content: m.content })),
  ];

  // Revalidate whenever any tool ran this turn, rather than allowlisting specific
  // "mutating" tool names — that list drifted out of sync before (manage_account and
  // manage_category were never added to it, so new accounts/categories saved fine but
  // silently didn't show up until something else happened to revalidate the page).
  // revalidatePath is cheap and idempotent, so it's fine to call even after a
  // read-only tool like get_balances.
  let anyToolCalled = false;

  try {
    for (let i = 0; i < 10; i++) {
      const data = await callAi(messages, PROVIDERS, chainPositionRef, exhausted);
      const choice = data.choices?.[0];
      const message = choice?.message;
      if (!message) throw new Error("No response from AI provider.");

      const toolCalls = message.tool_calls as
        | { id: string; function: { name: string; arguments: string } }[]
        | undefined;

      if (!toolCalls || toolCalls.length === 0) {
        if (anyToolCalled) {
          revalidatePath("/");
          revalidatePath("/transactions");
          revalidatePath("/accounts");
          revalidatePath("/categories");
          revalidatePath("/settings");
        }
        return message.content ? stripMarkdown(message.content) : "Sorry Bes, wala akong masabi diyan.";
      }

      anyToolCalled = true;

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

        // A single tool throwing (e.g. a transient DB hiccup) used to kill the whole
        // reply with the generic glitch message and no chance to recover. Feeding the
        // error back as a tool result instead lets the model see it, retry a different
        // way, or explain the problem — same pattern as any other tool-level failure.
        let result: unknown;
        try {
          result = await executeTool(call.function.name, args);
        } catch (err) {
          console.error(`Bes AI: tool ${call.function.name} failed:`, err);
          result = { error: "This tool failed to run. Let the user know something went wrong rather than guessing the result." };
        }
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
