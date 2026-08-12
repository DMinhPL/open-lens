import { CHART_COLORS } from "@/core/colors/chart-theme";

export const CFD_STAGES = [
  {
    key: "backlog",
    label: "Backlog",
    color: CHART_COLORS.slate,
    description: "Work that is not yet fully specified or ready to start.",
    statuses: ["Open", "Reopen", "In Specification"],
  },
  {
    key: "ready",
    label: "Ready",
    color: CHART_COLORS.yellow,
    description: "Specified work waiting for development to begin.",
    statuses: ["Specified", "Ready"],
  },
  {
    key: "development",
    label: "Development",
    color: CHART_COLORS.blue,
    description: "Work that is actively being implemented.",
    statuses: ["In Progress", "Developing"],
  },
  {
    key: "review",
    label: "Review",
    color: CHART_COLORS.purple,
    description: "Implemented work waiting for or undergoing code review.",
    statuses: ["Need to Review", "Reviewed"],
  },
  {
    key: "testing",
    label: "Testing / Acceptance",
    color: CHART_COLORS.pink,
    description: "Work moving through QA, demos, acceptance, and deployment preparation.",
    statuses: [
      "Developed",
      "Testing",
      "Tested",
      "Confirmed",
      "Ready to Demo",
      "Deployed Demo",
      "Ready to SAT",
      "Done SAT",
      "Deploying",
      "Ready to Live",
    ],
  },
  {
    key: "done",
    label: "Done",
    color: CHART_COLORS.green,
    description: "Work that has been released or otherwise completed.",
    statuses: ["Deployed Live", "Done", "Resolved"],
  },
] as const;

export type CfdStage = (typeof CFD_STAGES)[number]["key"];

export const CFD_STAGE_BY_STATUS: Record<string, CfdStage> = {
  open: "backlog",
  reopen: "backlog",
  "in specification": "backlog",
  specified: "ready",
  ready: "ready",
  "in progress": "development",
  developing: "development",
  "need to review": "review",
  reviewed: "review",
  developed: "testing",
  testing: "testing",
  tested: "testing",
  confirmed: "testing",
  "ready to demo": "testing",
  "deployed demo": "testing",
  "ready to sat": "testing",
  "done sat": "testing",
  deploying: "testing",
  "ready to live": "testing",
  "deployed live": "done",
  done: "done",
  resolved: "done",
};
