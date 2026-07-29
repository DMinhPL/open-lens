# AI Agent Setup: GitNexus & Knowns

> Step-by-step instructions for an AI coding agent to install, register, and verify GitNexus (code intelligence) and Knowns (docs/tasks/memory MCP) in this project.

## 1. Purpose

This guide walks an AI agent (or a developer scripting one) through setting up the two MCP servers this project depends on:

- **GitNexus** — code knowledge graph: impact analysis, execution-flow queries, safe refactors (rules in [AGENTS.md](../AGENTS.md) / [CLAUDE.md](../CLAUDE.md))
- **Knowns** — docs, tasks, memory, and decisions MCP (this doc's canonical copy lives there, at `guides/ai-agent-setup-gitnexus-knowns`)

Run these steps in order. Each step includes how to verify it worked before moving on.

## 2. Prerequisites

- Node.js + npm/npx available on PATH
- Working inside a git repository (GitNexus requires this)
- Claude Code (or another MCP-capable agent host) with `claude mcp` CLI access

## 3. Install & Register GitNexus

### 3.1 Build the index

```bash
npx gitnexus analyze
```

Run from the project root. This parses source files, builds the knowledge graph under `.gitnexus/`, and generates/updates `CLAUDE.md` and `AGENTS.md` context files.

**Known issue (npm 11.x):** if `npx` crashes during install (`node.target is null`), install globally once instead:

```bash
npm i -g gitnexus
gitnexus analyze
```

Alternative if that still fails: `pnpm --allow-build=@ladybugdb/core --allow-build=gitnexus --allow-build=tree-sitter dlx gitnexus@latest analyze`. See [GitNexus#1939](https://github.com/abhigyanpatwari/GitNexus/issues/1939).

After this step, `.gitnexus/run.cjs` exists in the project — later CLI calls should go through `node .gitnexus/run.cjs <command>` (it auto-picks an available runner: global `gitnexus`, else `pnpm dlx`, else `npx`).

### 3.2 Register the GitNexus MCP server

Register it with your agent host so its tools (`impact`, `context`, `query`, `explain`, etc.) become available. For Claude Code:

```bash
claude mcp add gitnexus -- gitnexus mcp
```

> The exact invocation can vary by GitNexus version — run `gitnexus --help` (or `node .gitnexus/run.cjs --help`) if `mcp` isn't the right subcommand. Confirm registration with `/mcp` inside Claude Code; the server should show as connected.

### 3.3 Verify

- Read resource `gitnexus://repo/{name}/context` — should return a codebase overview and confirm the index is fresh (not stale).
- If it reports stale, re-run `node .gitnexus/run.cjs analyze`.
- Restart the agent host (Claude Code) after any MCP registration change or re-index, so the MCP server reloads.

## 4. Install & Register Knowns

### 4.1 Install the Knowns CLI

Install `knowns` so the `knowns` command is on PATH (npm global install or the platform-specific method Knowns publishes — check the Knowns project README for the current install command, since this project doesn't pin one).

### 4.2 Register the Knowns MCP server

Add an `.mcp.json` at the project root (or merge into an existing one) with:

```json
{
  "mcpServers": {
    "knowns": {
      "command": "knowns",
      "args": ["mcp", "--stdio"]
    }
  }
}
```

This project already has this entry — see [.mcp.json](../.mcp.json).

### 4.3 Register agent slash-command integration

Beyond the raw MCP tools, Knowns ships agent-native shortcuts — `/kn-*` for Claude Code, `$kn-*` for Codex. Install both once per machine (or per project, if your Knowns version scopes it that way):

```bash
knowns setup claude --global
knowns setup codex --global
```

This is what makes `/kn-init` and `$kn-init` (Section 6) available inside each agent host, rather than only the lower-level `mcp__knowns__*` tool calls.

### 4.4 Verify

- Call the `initial` tool (`mcp__knowns__initial`, or `/kn-init` / `$kn-init` once slash-command setup is done — **must be called at the start of every session** before other Knowns work). It returns project state (doc/task/memory counts), code-intelligence rules, and workflow guidance.
- Confirm the active project with `project({ action: "current" })`; switch with `project({ action: "set" })` if it resolved to the wrong root.
- Run `search({ action: "search", query: "<anything>", type: "doc" })` to confirm the docs index responds (0 results is fine on a fresh project — it just means no docs exist yet).

## 4.5 Starting a Session — Required Order

Every session, before any other Knowns call:

```
1. /kn-init  (Claude Code)  or  $kn-init  (Codex)   # always first — loads project state + workflow rules
2. project({ action: "current" })                   # confirm you're pointed at the right project root
```

Skipping step 1 is the most common cause of an agent silently ignoring Knowns for the rest of the session — the other tools may still work, but the agent won't know it's supposed to check memory/tasks before acting, since that instruction only arrives via `init`.

> Exact tool/action names below follow the pattern shown in `search()` (`{ action, ...params }`). If your installed Knowns version exposes a different action set, run `/kn-init` (or `mcp__knowns__initial`) and read the returned tool list — it's the authoritative source for this project's version, more reliable than this doc if the two ever disagree.

## 4.6 Common Knowns Features & Commands

| Feature               | Purpose                                                                                                                                 | Example call                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Docs**              | Durable project knowledge — architecture, specs, onboarding, rationale for non-obvious decisions                                        | `search({ action: "search", query: "auth flow", type: "doc" })` · create/update via the doc-write tool exposed in your session's tool list (name may vary by version — check `/kn-init`'s tool list) |
| **Tasks / Plans**     | Planned work with status, acceptance criteria, notes; the handoff mechanism between sessions/agents                                     | `/kn-plan <task-id>` (Claude) / `$kn-plan <task-id>` (Codex) to resume a plan; `search({ query: "field cleanup", type: "task" })` to find an existing one before creating a new one                  |
| **Memory**            | Short reusable facts that should survive across sessions — conventions, gotchas, rejected alternatives, non-obvious exceptions          | `kn memory add "<specific, self-contained statement>"` · `kn memory list` · via agent: `$kn-memory` (Codex) / equivalent Claude tool call                                                            |
| **Decisions**         | Recorded rationale for choices made — distinct from memory: a decision explains _why X over Y_, memory is a standing fact/gotcha        | `kn decision add "<what was decided and why>"` · `kn decision list` · via agent: `$kn-decision` (Codex)                                                                                              |
| **Semantic Search**   | One entry point across docs + tasks + memory + decisions + code references, ranked by relevance                                         | `kn search "<topic>"` or `search({ query: "<topic>" })` with no `type` filter — broadest first pass when you don't know which bucket the answer lives in                                             |
| **Code intelligence** | `code.find`, `code.symbols` and similar actions — Knowns' own code-aware lookups, preferred over raw grep/edit per this project's rules | `code.find({ query: "OrderResponse" })` / `code.symbols({ file: "types/api/order.ts" })` — exact signature TBD; confirm via `/kn-init`'s tool list before relying on this in automation              |
| **Project**           | Which repo/root Knowns is currently scoped to — matters in monorepos or multi-root workspaces                                           | `project({ action: "current" })` / `project({ action: "set" })`                                                                                                                                      |

### Practical sequencing within a task

```
1. kn search "<topic>"                              # cast wide first — no type filter
2. search({ ..., type: "memory" })                  # narrow if step 1 hints at a gotcha/exception
3. search({ ..., type: "task" })                     # check if this work is already tracked
4. /kn-plan <task-id>  or  $kn-plan <task-id>        # resume, or create a new plan/task if none exists
5. [do the work — prefer code.find/code.symbols over grep for code lookups]
6. [update task: status + notes]
7. kn memory add "..."   and/or   kn decision add "..."   # capture anything non-obvious learned
```

This mirrors the GitNexus-side discipline in [AGENTS.md](../AGENTS.md)/[CLAUDE.md](../CLAUDE.md) (impact analysis before edit, `detect_changes()` after) — the two are meant to run as one combined loop, not independently. See the "Combined Workflow" note in CLAUDE.md if present.

## 5. Combined Sanity Check

Once both servers are registered and verified, run:

```bash
knowns doctor
gitnexus status
claude mcp list
codex mcp list
```

All four should report clean/connected. Then confirm at the tool level:

1. `gitnexus://repo/{name}/context` returns a fresh index summary
2. `/kn-init` (or `mcp__knowns__initial`) returns session-ready instructions without errors, for both Claude Code and Codex
3. `/mcp` (Claude Code) lists both `gitnexus` and `knowns` as connected
   If any check fails, re-run the corresponding install step above rather than proceeding — GitNexus rules in [AGENTS.md](../AGENTS.md) require impact analysis before symbol edits, and Knowns rules require code actions (`code.find`, `code.symbols`, etc.) over raw grep/edit for code work. Both fail silently if the MCP server isn't actually connected.

## 6. Working With Knowns From an Agent Session

### 6.1 Claude Code

```bash
/kn-init                # required first call each session
/kn-plan <task-id>       # resume a specific plan/task
```

### 6.2 Codex

```bash
$kn-init
$kn-plan <task-id>
```

### 6.3 Memory & Decision Tracking (optional but recommended)

Via agent shortcut:

```bash
$kn-memory      # Codex — interactive memory add/browse
$kn-decision    # Codex — interactive decision add/browse
```

Via bare CLI (works from either agent's shell access, or directly by a developer):

```bash
kn memory add "Fields kept in OrderResponse for audit-trail export even though unused in app code"
kn decision add "Chose Knowns for task tracking over a separate tool to keep tasks queryable alongside code/docs/memory"
```

Verify entries landed:

```bash
kn memory list
kn decision list
kn search "audit-trail"
```

> Tip: when testing that memory/search actually round-trips (not just that the agent says it does), add one entry with a unique, made-up token — e.g. `kn memory add "VERIFY-TOKEN-8842: <anything>"` — then confirm `kn search "VERIFY-TOKEN-8842"` returns it. A token that couldn't be guessed is the clearest proof the write and read paths both work.
