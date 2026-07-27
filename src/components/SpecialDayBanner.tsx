import dayjs from "dayjs";

function getSpecialDay(now = dayjs()) {
  const day = now.date();
  const month = now.month() + 1;

  if (month === 1 && day === 24) {
    return {
      emoji: "💍",
      title: "Happy Wedding Anniversary!",
      message: "Here's to another year together, Jenna & Kenneth.",
    };
  }
  if (day === 12) {
    return {
      emoji: "💚",
      title: "Happy Monthsary, Jenna!",
      message: "Grateful for another month with you.",
    };
  }
  return null;
}

export function SpecialDayBanner() {
  const special = getSpecialDay();
  if (!special) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 p-4 text-white shadow-lg shadow-rose-500/20">
      <p className="text-sm font-semibold">
        {special.emoji} {special.title}
      </p>
      <p className="mt-1 text-xs text-rose-50">{special.message}</p>
    </div>
  );
}
