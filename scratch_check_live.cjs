require("dotenv").config();
const passcode = process.env.APP_PASSCODE;
const BASE = "https://budget-tracker-beta-livid.vercel.app";

async function main() {
  const loginPage = await (await fetch(`${BASE}/login`)).text();
  const actionIdMatch = loginPage.match(/name="(\$ACTION_ID_[a-f0-9]+)"/);
  const fd = new FormData();
  fd.set(actionIdMatch[1], "");
  fd.set("passcode", passcode);
  fd.set("from", "/");
  const postRes = await fetch(`${BASE}/login`, { method: "POST", body: fd, redirect: "manual" });
  const cookie = postRes.headers.get("set-cookie").split(";")[0];
  const html = await (await fetch(BASE, { headers: { cookie } })).text();

  const idx1 = html.indexOf("monthly budget");
  console.log("HERO LINE:", html.slice(idx1 - 150, idx1 + 30).replace(/<[^>]+>/g, " | "));

  const idx2 = html.indexOf("spending money");
  console.log("SPENDING CARD:", idx2 === -1 ? "NOT FOUND (old deploy)" : html.slice(idx2 - 60, idx2 + 150).replace(/<[^>]+>/g, " | "));

  const idx3 = html.indexOf("Maribank");
  console.log("FIRST Maribank MENTION:", html.slice(idx3 - 100, idx3 + 150).replace(/<[^>]+>/g, " | "));
}

main().catch((e) => console.error(e));
