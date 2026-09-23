// Parses "@leo ..." commands entirely client-side. Nothing here is ever sent to the
// server or the other participant — reminders/timers/maps run locally on this device.

function normalizeUnit(u) {
  u = u.toLowerCase();
  if (u.startsWith("sec")) return "seconds";
  if (u.startsWith("min")) return "minutes";
  return "hours";
}

export function unitToMs(amount, unit) {
  const mult = unit === "seconds" ? 1000 : unit === "minutes" ? 60000 : 3600000;
  return amount * mult;
}

export function parseLeoCommand(raw) {
  const text = raw.replace(/^@leo\s*/i, "").trim();
  if (!text) return { type: "empty" };

  const durationRe = "(\\d+)\\s*(sec(?:ond)?s?|min(?:ute)?s?|hours?|hrs?)";

  let m =
    text.match(new RegExp(`(?:set (?:a |an )?)?timer (?:for )?${durationRe}`, "i")) ||
    text.match(new RegExp(`${durationRe}\\s*timer`, "i"));
  if (m) return { type: "timer", amount: +m[1], unit: normalizeUnit(m[2]) };

  m = text.match(new RegExp(`remind me(?: to (.*?))? in ${durationRe}(?: to (.*))?$`, "i"));
  if (m) {
    const label = (m[1] || m[4] || "").trim() || "Reminder";
    return { type: "reminder", amount: +m[2], unit: normalizeUnit(m[3]), label };
  }

  m = text.match(/^(?:navigate to|directions to|route to|take me to)\s+(.+)/i);
  if (m) return { type: "directions", place: m[1].trim() };

  m = text.match(/^(?:map(?:s)?|show|find)\s+(.+?)\s*(?:on (?:the )?map|nearby|near me)?$/i);
  if (m && /map|nearby|near me/i.test(text)) return { type: "search-map", place: m[1].trim() };

  return { type: "freeform", text };
}
