import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const items = [
    {
      name: "Royal Banner",
      description: "Deep purple header banner for your profile",
      cost: 80,
      available: true,
      kind: "banner",
      config: { gradientFrom: "#1a1333", gradientTo: "#6C63FF" },
    },
    {
      name: "Commander Title",
      description: 'Show "Commander" as your profile title',
      cost: 60,
      available: true,
      kind: "title",
      config: { text: "Commander" },
    },
    {
      name: "Gold Frame",
      description: "Gold profile border around your stats card",
      cost: 70,
      available: true,
      kind: "border",
      config: { color: "#facc15" },
    },
    {
      name: "Midnight Ops Theme",
      description: "Slightly brighter cards with indigo accents",
      cost: 90,
      available: true,
      kind: "theme",
      config: { accent: "#4f46e5" },
    },
    {
      name: "Priority Boost",
      description: "Temporarily boost task priority scoring",
      cost: 50,
      available: true,
      kind: "generic",
    },
    {
      name: "Schedule Rescue",
      description: "ALFRED suggests a day rescue plan",
      cost: 75,
      available: true,
      kind: "generic",
    },
    {
      name: "Focus Block",
      description: "Block calendar for deep work",
      cost: 100,
      available: true,
      kind: "generic",
    },
    {
      name: "Achievement Unlock",
      description: "Unlock a custom achievement",
      cost: 200,
      available: true,
      kind: "generic",
    },
  ] as const;

  for (const item of items) {
    const existing = await prisma.shopItem.findFirst({
      where: { name: item.name },
    });
    if (!existing) {
      await prisma.shopItem.create({ data: { ...item, rotating: false } });
    }
  }

  const rotatingItems = [
    { name: "Aurora Banner", description: "Soft pink-to-blue gradient header", cost: 65, kind: "banner", config: { gradientFrom: "#fce7f3", gradientTo: "#93c5fd" }, sortOrder: 0 },
    { name: "Scholar Title", description: 'Display "Scholar" on your profile', cost: 45, kind: "title", config: { text: "Scholar" }, sortOrder: 1 },
    { name: "Silver Border", description: "Subtle silver profile border", cost: 55, kind: "border", config: { color: "#94a3b8" }, sortOrder: 2 },
    { name: "Forest Theme", description: "Calm green accent theme", cost: 85, kind: "theme", config: { accent: "#22c55e" }, sortOrder: 3 },
    { name: "Quick Focus", description: "25-min focus sprint suggestion", cost: 40, kind: "generic", sortOrder: 4 },
    { name: "Study Buddy", description: "AI checks in on your progress", cost: 60, kind: "generic", sortOrder: 5 },
    { name: "Sunset Banner", description: "Warm orange-to-purple gradient", cost: 70, kind: "banner", config: { gradientFrom: "#fb923c", gradientTo: "#a78bfa" }, sortOrder: 6 },
    { name: "Veteran Title", description: 'Show "Veteran" as your title', cost: 90, kind: "title", config: { text: "Veteran" }, sortOrder: 7 },
    { name: "Rose Border", description: "Rose gold profile border", cost: 75, kind: "border", config: { color: "#fb7185" }, sortOrder: 8 },
    { name: "Ocean Theme", description: "Deep blue theme for late-night sessions", cost: 95, kind: "theme", config: { accent: "#0ea5e9" }, sortOrder: 9 },
    { name: "Break Reminder", description: "Schedule smart break prompts", cost: 35, kind: "generic", sortOrder: 10 },
    { name: "Task Doubler", description: "2x Rangs on next completed task", cost: 80, kind: "generic", sortOrder: 11 },
    { name: "Starlight Banner", description: "Dark navy with gold accents", cost: 100, kind: "banner", config: { gradientFrom: "#0f172a", gradientTo: "#eab308" }, sortOrder: 12 },
    { name: "Rookie Title", description: 'Display "Rookie" on profile', cost: 30, kind: "title", config: { text: "Rookie" }, sortOrder: 13 },
    { name: "Emerald Border", description: "Green success border", cost: 65, kind: "border", config: { color: "#10b981" }, sortOrder: 14 },
    { name: "Warm Theme", description: "Amber and cream accents", cost: 70, kind: "theme", config: { accent: "#f59e0b" }, sortOrder: 15 },
    { name: "Deadline Shield", description: "Highlight tasks due in 24h", cost: 55, kind: "generic", sortOrder: 16 },
    { name: "Streak Saver", description: "Protect streak for one missed day", cost: 120, kind: "generic", sortOrder: 17 },
    { name: "Mint Banner", description: "Fresh mint-to-teal gradient", cost: 60, kind: "banner", config: { gradientFrom: "#99f6e4", gradientTo: "#2dd4bf" }, sortOrder: 18 },
    { name: "Pro Title", description: 'Show "Pro" as your title', cost: 85, kind: "title", config: { text: "Pro" }, sortOrder: 19 },
    { name: "Copper Border", description: "Warm copper border", cost: 50, kind: "border", config: { color: "#b45309" }, sortOrder: 20 },
    { name: "Minimal Theme", description: "Clean monochrome accents", cost: 75, kind: "theme", config: { accent: "#64748b" }, sortOrder: 21 },
    { name: "Power Hour", description: "Block one hour for deep work", cost: 45, kind: "generic", sortOrder: 22 },
    { name: "Email Digest", description: "Daily task summary by email", cost: 65, kind: "generic", sortOrder: 23 },
    { name: "Crimson Banner", description: "Bold red gradient banner", cost: 88, kind: "banner", config: { gradientFrom: "#7f1d1d", gradientTo: "#ef4444" }, sortOrder: 24 },
    { name: "Elite Title", description: 'Display "Elite" on profile', cost: 150, kind: "title", config: { text: "Elite" }, sortOrder: 25 },
    { name: "Violet Border", description: "Purple profile border", cost: 72, kind: "border", config: { color: "#8b5cf6" }, sortOrder: 26 },
    { name: "Dracula Theme", description: "Dark mode with red accents", cost: 92, kind: "theme", config: { accent: "#dc2626" }, sortOrder: 27 },
    { name: "Motivation Boost", description: "AI sends a motivational message", cost: 25, kind: "generic", sortOrder: 28 },
    { name: "Calendar Clear", description: "Suggest blocks to protect", cost: 78, kind: "generic", sortOrder: 29 },
    { name: "Lavender Banner", description: "Soft lavender gradient", cost: 58, kind: "banner", config: { gradientFrom: "#e9d5ff", gradientTo: "#c084fc" }, sortOrder: 30 },
    { name: "Rising Star Title", description: 'Show "Rising Star" as title', cost: 95, kind: "title", config: { text: "Rising Star" }, sortOrder: 31 },
    { name: "Cyan Border", description: "Bright cyan border", cost: 62, kind: "border", config: { color: "#06b6d4" }, sortOrder: 32 },
    { name: "Sunrise Theme", description: "Warm sunrise color palette", cost: 82, kind: "theme", config: { accent: "#f97316" }, sortOrder: 33 },
    { name: "Quick Task", description: "Add task from chat in one tap", cost: 42, kind: "generic", sortOrder: 34 },
    { name: "Export Week", description: "Export this week's summary", cost: 68, kind: "generic", sortOrder: 35 },
    { name: "Storm Banner", description: "Gray storm cloud gradient", cost: 77, kind: "banner", config: { gradientFrom: "#374151", gradientTo: "#6b7280" }, sortOrder: 36 },
    { name: "Ace Title", description: 'Display "Ace" on profile', cost: 110, kind: "title", config: { text: "Ace" }, sortOrder: 37 },
    { name: "Gold Rush Border", description: "Bright gold border", cost: 105, kind: "border", config: { color: "#eab308" }, sortOrder: 38 },
    { name: "Pastel Theme", description: "Soft pastel accents", cost: 68, kind: "theme", config: { accent: "#a78bfa" }, sortOrder: 39 },
    { name: "Pomodoro Pack", description: "4 Pomodoro blocks pre-scheduled", cost: 52, kind: "generic", sortOrder: 40 },
    { name: "Smart Suggestions", description: "AI task prioritization tips", cost: 88, kind: "generic", sortOrder: 41 },
    { name: "Neon Banner", description: "Electric cyan-to-magenta gradient", cost: 115, kind: "banner", config: { gradientFrom: "#22d3ee", gradientTo: "#d946ef" }, sortOrder: 42 },
    { name: "Grind Master Title", description: 'Show "Grind Master" as title', cost: 130, kind: "title", config: { text: "Grind Master" }, sortOrder: 43 },
    { name: "Rainbow Border", description: "Subtle rainbow gradient border", cost: 140, kind: "border", config: { color: "#6366f1" }, sortOrder: 44 },
    { name: "Nord Theme", description: "Nord color palette", cost: 79, kind: "theme", config: { accent: "#5e81ac" }, sortOrder: 45 },
    { name: "Sync Reminder", description: "Remind to sync calendar", cost: 38, kind: "generic", sortOrder: 46 },
    { name: "Weekly Review", description: "AI-generated weekly recap", cost: 98, kind: "generic", sortOrder: 47 },
    { name: "Obsidian Banner", description: "Pure black elegant banner", cost: 125, kind: "banner", config: { gradientFrom: "#0a0a0a", gradientTo: "#262626" }, sortOrder: 48 },
    { name: "Legend Title", description: 'Display "Legend" on profile', cost: 200, kind: "title", config: { text: "Legend" }, sortOrder: 49 },
  ];

  for (const item of rotatingItems) {
    const existing = await prisma.shopItem.findFirst({
      where: { name: item.name },
    });
    if (!existing) {
      await prisma.shopItem.create({
        data: {
          name: item.name,
          description: item.description ?? null,
          cost: item.cost,
          available: true,
          kind: item.kind,
          config: "config" in item && item.config ? item.config : undefined,
          rotating: true,
          sortOrder: item.sortOrder,
        },
      });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
