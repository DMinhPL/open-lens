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

### 4.3 Verify

- Call the `initial` tool (`mcp__knowns__initial`) — **must be called at the start of every session** before other Knowns work. It returns project state (doc/task/memory counts), code-intelligence rules, and workflow guidance.
- Confirm the active project with `project({ action: "current" })`; switch with `project({ action: "set" })` if it resolved to the wrong root.
- Run `search({ action: "search", query: "<anything>", type: "doc" })` to confirm the docs index responds (0 results is fine on a fresh project — it just means no docs exist yet).

## 5. Combined Sanity Check

Once both servers are registered and verified:

1. `gitnexus://repo/{name}/context` returns a fresh index summary
2. `mcp__knowns__initial` returns session-ready instructions without errors
3. `/mcp` (Claude Code) lists both `gitnexus` and `knowns` as connected

If any check fails, re-run the corresponding install step above rather than proceeding — GitNexus rules in [AGENTS.md](../AGENTS.md) require impact analysis before symbol edits, and Knowns rules require code actions (`code.find`, `code.symbols`, etc.) over raw grep/edit for code work. Both fail silently if the MCP server isn't actually connected.

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| `node .gitnexus/run.cjs` → `Cannot find module` | Runner is gitignored and missing (fresh clone / `git clean`); regenerate with `npx gitnexus analyze` |
| GitNexus index stale after re-analyzing | Restart the agent host to reload the MCP server |
| Embeddings generation slow | Omit `--embeddings` (off by default), or set `OPENAI_API_KEY` for faster API-based embeddings |
| Knowns `search` returns 0 results unexpectedly | Verify active project via `project({ action: "current" })`; semantic runtime may also be degraded/unavailable — keyword-only results still work |
| "Not inside a git repository" from GitNexus | Run all GitNexus commands from a directory inside a git repo |
