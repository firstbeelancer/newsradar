export const DEFAULT_EMOJI_ITEMS = [
  { name: "breaking", value: "🚨", label: "Breaking" },
  { name: "hot", value: "🔥", label: "Hot" },
  { name: "insight", value: "🧠", label: "Insight" },
  { name: "important", value: "📌", label: "Important" },
  { name: "stats", value: "📊", label: "Stats" },
  { name: "watch", value: "👀", label: "Watch" },
  { name: "action", value: "⚡", label: "Action" },
  { name: "done", value: "✅", label: "Done" },
  { name: "news", value: "📰", label: "News" },
  { name: "search", value: "🔎", label: "Search" },
  { name: "warning", value: "⚠️", label: "Warning" },
  { name: "security", value: "🛡️", label: "Security" },
  { name: "bug", value: "🐞", label: "Bug" },
  { name: "lock", value: "🔒", label: "Lock" },
  { name: "key", value: "🔑", label: "Key" },
  { name: "robot", value: "🤖", label: "Robot" },
  { name: "rocket", value: "🚀", label: "Rocket" },
  { name: "tools", value: "🛠️", label: "Tools" },
  { name: "chart_up", value: "📈", label: "Growth" },
  { name: "chart_down", value: "📉", label: "Drop" },
  { name: "money", value: "💰", label: "Money" },
  { name: "idea", value: "💡", label: "Idea" },
  { name: "target", value: "🎯", label: "Target" },
  { name: "link", value: "🔗", label: "Link" },
  { name: "world", value: "🌍", label: "World" },
  { name: "time", value: "⏱️", label: "Time" },
  { name: "spark", value: "✨", label: "Spark" },
  { name: "question", value: "❓", label: "Question" },
  { name: "memo", value: "📝", label: "Memo" },
  { name: "folder", value: "📂", label: "Folder" },
  { name: "mail", value: "📩", label: "Mail" },
  { name: "megaphone", value: "📣", label: "Megaphone" },
  { name: "pin", value: "📍", label: "Pin" },
  { name: "star", value: "⭐", label: "Star" },
  { name: "trophy", value: "🏆", label: "Trophy" },
  { name: "health", value: "❤️", label: "Health" },
  { name: "science", value: "🔬", label: "Science" },
  { name: "design", value: "🎨", label: "Design" },
  { name: "construction", value: "🏗️", label: "Construction" },
  { name: "calendar", value: "📅", label: "Calendar" },
];

export function normalizeEmojiValues(input: string | string[]): string[] {
  const raw = Array.isArray(input) ? input.join("\n") : input;
  const parts = raw
    .split(/[\s,;|]+/u)
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(parts)).slice(0, 100);
}
