# open-lens

open-lens is a project/ticket intelligence dashboard for [OpenProject](https://www.openproject.org/), built with [Next.js](https://nextjs.org). It surfaces burnup, throughput, workload, and hierarchy views over OpenProject work packages so teams can track delivery health without living inside the ticket tracker.

## Features

- **Dashboard** — burnup, ticket-type throughput, and stuck-ticket charts (Chart.js / Recharts)
- **Tickets** — work package listing and filtering
- **Hierarchy** — work package tree/graph visualization (`@xyflow/react` + `dagre`)
- **Workload** — team/assignee load view
- **Projects** — OpenProject project overview
- **Settings** — app configuration

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Configuration

The app talks to an OpenProject instance via `core/openproject/openproject-client.ts`. Relevant environment variables:

| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | Base URL of the OpenProject instance | `https://proj.mecury.com.vn` |
| `USE_DUMMY_DATA` | Set to `"false"` to use live OpenProject data instead of dummy data | dummy data outside production |

## Tech Stack

- Next.js 16 (App Router) + React 19
- Redux Toolkit / React Redux for state
- Tailwind CSS 4 + Radix UI + shadcn primitives
- Chart.js / react-chartjs-2 and Recharts for visualizations
- `@xyflow/react` + `@dagrejs/dagre` for the hierarchy graph

## Code Intelligence

This repo is indexed by [GitNexus](https://github.com/) — see [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md) for how to use impact analysis, execution-flow queries, and safe refactoring tools when working in this codebase.
