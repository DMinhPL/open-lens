// One-off generator for /data/dummy-work-packages.json. Run with: node scripts/generate-dummy-data.mjs
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Simple seeded PRNG (mulberry32) so the dataset is reproducible across runs.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

const statuses = ["New", "In progress", "Closed", "On hold"];
const statusWeights = [0.2, 0.25, 0.45, 0.1];
const priorities = ["Low", "Normal", "High", "Immediate"];
const priorityWeights = [0.2, 0.45, 0.25, 0.1];
const projects = ["Website Redesign", "Mobile App", "Internal Tools", "API Platform", "Customer Portal"];
const assignees = [
  "Alex Johnson",
  "Priya Sharma",
  "Marco Rossi",
  "Yuki Tanaka",
  "Sofia Martinez",
  "David Kim",
  "Emma Wilson",
];
const subjects = [
  "Fix login redirect loop",
  "Add pagination to tickets table",
  "Improve dashboard load time",
  "Update dependency versions",
  "Design new onboarding flow",
  "Refactor auth middleware",
  "Write integration tests for API",
  "Investigate memory leak",
  "Add dark mode support",
  "Set up CI pipeline",
  "Migrate database schema",
  "Improve error messages",
  "Add export to CSV feature",
  "Fix responsive layout on mobile",
  "Optimize image loading",
  "Add search filters",
  "Implement rate limiting",
  "Fix timezone bug in reports",
  "Add audit logging",
  "Improve accessibility of forms",
  "Set up monitoring alerts",
  "Fix flaky test suite",
  "Add bulk edit for tickets",
  "Update API documentation",
  "Fix broken pagination links",
];

function weightedPick(items, weights) {
  const r = rand();
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    acc += weights[i];
    if (r <= acc) return items[i];
  }
  return items[items.length - 1];
}

function pick(items) {
  return items[Math.floor(rand() * items.length)];
}

function daysAgo(days) {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const COUNT = 55;
const SPAN_DAYS = 182; // ~2 quarters

const workPackages = [];

for (let i = 0; i < COUNT; i++) {
  const id = 1000 + i;
  const createdDaysAgo = Math.floor(rand() * SPAN_DAYS);
  const createdAt = daysAgo(createdDaysAgo);

  const status = weightedPick(statuses, statusWeights);
  const priority = weightedPick(priorities, priorityWeights);

  let updatedAt = addDays(createdAt, Math.floor(rand() * Math.min(createdDaysAgo, 30)));
  let closedAt;
  let percentDone;

  if (status === "Closed") {
    const closeOffset = Math.floor(rand() * createdDaysAgo) + 1;
    closedAt = addDays(createdAt, closeOffset);
    if (closedAt > new Date()) closedAt = new Date();
    updatedAt = closedAt;
    percentDone = 100;
  } else if (status === "In progress") {
    percentDone = 10 + Math.floor(rand() * 80);
  } else if (status === "On hold") {
    percentDone = Math.floor(rand() * 60);
  } else {
    percentDone = 0;
  }

  workPackages.push({
    id,
    subject: pick(subjects),
    status,
    priority,
    project: pick(projects),
    assignee: pick(assignees),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    ...(closedAt ? { closedAt: closedAt.toISOString() } : {}),
    percentDone,
  });
}

workPackages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

const outPath = join(__dirname, "..", "data", "dummy-work-packages.json");
writeFileSync(outPath, JSON.stringify(workPackages, null, 2) + "\n");
console.log(`Wrote ${workPackages.length} work packages to ${outPath}`);
