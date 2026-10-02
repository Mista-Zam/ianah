export const BRAND = {
  name: "Kindness Wall for Teachers",
  short: "KWT",
  tagline: "A space for every student's voice.",
  supporting: "Thank you. Appreciate. Speak.",
  moderator: "Admin",
};

/* Sticky note palette — deliberately saturated so notes are the brightest
   elements on the dark canvas. */
export const NOTE_COLORS = [
  { id: "yellow", name: "Yellow", hex: "#FFE566", ink: "#2E2506", glow: "rgba(255,229,102,0.55)" },
  { id: "pink", name: "Pink", hex: "#FF8FB3", ink: "#3A0C1C", glow: "rgba(255,143,179,0.55)" },
  { id: "blue", name: "Blue", hex: "#70CFFF", ink: "#04252F", glow: "rgba(112,207,255,0.55)" },
  { id: "green", name: "Green", hex: "#7BE0B2", ink: "#04291B", glow: "rgba(123,224,178,0.55)" },
  { id: "lavender", name: "Lavender", hex: "#B89CFF", ink: "#1D1040", glow: "rgba(184,156,255,0.55)" },
  { id: "orange", name: "Orange", hex: "#FFAA68", ink: "#3A1A03", glow: "rgba(255,170,104,0.55)" },
  { id: "purple", name: "Purple", hex: "#D09CFF", ink: "#290D3E", glow: "rgba(208,156,255,0.55)" },
];

export const NOTE_COLOR_MAP = Object.fromEntries(NOTE_COLORS.map((c) => [c.id, c]));

export const colorById = (id) => NOTE_COLOR_MAP[id] ?? NOTE_COLORS[0];

export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "classroom", label: "Classroom" },
  { id: "teaching-life", label: "School Life" },
  { id: "vent", label: "Honest Thoughts" },
  { id: "wins", label: "Wins" },
  { id: "advice", label: "Advice" },
  { id: "appreciation", label: "Thank You" },
  { id: "funny", label: "Funny" },
  { id: "motivation", label: "Motivation" },
  { id: "random", label: "Random" },
];

export const POST_CATEGORIES = CATEGORIES.filter((c) => c.id !== "all");

export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

/* Status vocabulary for the moderation console. Each badge carries an icon +
   text label so meaning never depends on colour alone. */
export const STATUS = {
  pending: {
    id: "pending",
    label: "Pending",
    dot: "bg-warn",
    text: "text-warn",
    chip: "bg-warn/12 text-warn border-warn/30",
    description: "Awaiting moderator review",
  },
  published: {
    id: "published",
    label: "Published",
    dot: "bg-ok",
    text: "text-ok",
    chip: "bg-ok/12 text-ok border-ok/30",
    description: "Visible on the Kindness Wall",
  },
  rejected: {
    id: "rejected",
    label: "Rejected",
    dot: "bg-danger",
    text: "text-danger",
    chip: "bg-danger/12 text-danger border-danger/30",
    description: "Kept private",
  },
  reported: {
    id: "reported",
    label: "Reported",
    dot: "bg-brand-soft",
    text: "text-brand-soft",
    chip: "bg-brand/12 text-brand-soft border-brand/35",
    description: "Flagged by a community member",
  },
  removed: {
    id: "removed",
    label: "Removed",
    dot: "bg-faint",
    text: "text-muted",
    chip: "bg-surface-4/60 text-muted border-line",
    description: "Taken down by a moderator",
  },
};

/* Private moderator notes — never shown to the public. */
export const REJECTION_REASONS = [
  "Inappropriate content",
  "Offensive language",
  "Harassment",
  "Spam",
  "Advertising",
  "Personal information",
  "Duplicate",
  "Other",
];

export const REPORT_REASONS = [
  "Offensive content",
  "Harassment",
  "Spam",
  "Personal information",
  "Other",
];

export const COMMUNITY_STATS = [
  { id: "thoughts", value: "0", label: "Notes Shared", hint: "Approved and live on the wall" },
  { id: "teachers", value: "0", label: "Students", hint: "Students taking part" },
  { id: "today", value: "0", label: "Notes Today", hint: "Published in the last 24 hours" },
  { id: "anonymous", value: "0%", label: "Anonymous Notes", hint: "Written without a name" },
];

export const MAX_THOUGHT_LENGTH = 600;

/**
 * Moderator accounts are provisioned in the database, never shipped in the
 * bundle. Promote a real user with:
 *
 *   update public.profiles set role = 'admin' where id = (
 *     select id from auth.users where email = 'you@school.org'
 *   );
 *
 * There is deliberately no client-side notion of an admin credential to check —
 * `profiles.role` and the RLS policies are the only authority.
 */