# Next.js App Structure Standard

A reusable architecture standard for Next.js (App Router) applications. It is based on OpenLens but contains nothing specific to it, so any project can adopt it, new or existing.

**How to read this document**
- **MUST** = a rule of the standard. Every project follows it.
- **SHOULD** = the default. Deviate only for a stated reason.
- **Optional module** = include it only if the project needs it (§6).
- Placeholders: `<feature>` = a page or area (e.g. `orders`), `<service>` = an external system or backend (e.g. `stripe`, `cms`, `db`), `<Entity>` = a domain type (e.g. `Order`).

---

## 1. Principles

1. **Routing is thin.** `app/` only maps URLs to features and hosts route handlers.
2. **Features are self-contained.** Each feature's UI lives in `feature/<feature>/`.
3. **Shared code flows one way:** `app → feature → components → core`. Code never imports in the opposite direction.
4. **Secrets stay on the server.** The browser talks only to the app's own `/api/**` (or to Server Components / Server Actions). It never calls a secret-bearing external API directly.
5. **Business logic is pure.** It lives in `core/domain/` with no React or Next imports, so it can be tested in isolation.
6. **One way to do each thing:** one HTTP client, one data-fetching layer, one error shape.

---

## 2. Stack

| Concern | Standard | Notes |
|---|---|---|
| Framework | Next.js (App Router) + React + TypeScript (`strict`) | Use the current major versions |
| Styling | Tailwind CSS + shadcn/ui, lucide icons | Primitives live in `components/ui/` |
| Theming | `next-themes` (class strategy) | Optional if the app has no dark mode |
| Client data / state | Redux Toolkit + RTK Query | See §6 for a lighter alternative |
| Toasts | `sonner` | |
| Class utils | `clsx` + `tailwind-merge` → `cn()` | |
| Package manager | pnpm | Any manager works; pick one per repo |
| Path alias | `@/*` → repo root | MUST |

Pick charts, dates, forms, validation and other libraries per project. They belong to the project, not to this standard.

---

## 3. Folder layout

```
app/                           ROUTING ONLY
  layout.tsx                   The single root layout: providers + shell
  page.tsx                     Home (or redirect to the main feature)
  globals.css                  Tailwind + design tokens (light/dark)
  not-found.tsx                Optional
  error.tsx                    Optional root error boundary
  <feature>/page.tsx           One-line re-export from feature/
  <feature>/[id]/page.tsx      Dynamic routes follow the same rule
  api/                         Route handlers (backend-for-frontend)
    <resource>/route.ts
    <resource>/[id]/route.ts

feature/<feature>/             One folder per feature: the real UI
  <feature>-page.tsx           Page component (default export)
  components/                  Components used only by this feature
  use-<feature>-*.ts           Feature-only hooks
  <feature>-utils.ts           Feature-only pure helpers

components/                    Shared UI (no business logic)
  ui/                          shadcn primitives (button, card, dialog, ...)
  layout/                      sidebar.tsx, topbar.tsx, nav-config.ts
  providers/                   redux-provider.tsx, theme-provider.tsx, ...

core/                          Shared non-visual code
  api/
    http.ts                    apiFetch() + ApiError (same-origin JSON client)
    api-slice.ts               The single RTK Query createApi
  store/
    index.ts                   configureStore
    hooks.ts                   useAppDispatch / useAppSelector
    <name>-slice.ts            Client-only global state
  domain/
    types.ts                   Shared domain types
    <topic>.ts                 Pure business logic (filtering, calculations, mapping)
  services/<service>/          SERVER-ONLY integrations (one folder per backend)
    <service>-client.ts        Facade: the only file route handlers import
    <service>-api.ts           Real implementation
    <service>-mock.ts          Optional mock implementation (§6)
    <service>-config.ts        Reads env and settings
  config/
    env.ts                     Validated server env (server-only)
  contexts/                    Cross-page UI state (sidebar, filters, ...)
  utils.ts                     cn() and tiny generic helpers

data/                          Mock fixtures (optional)
scripts/                       Dev scripts (seeding, generators)
public/                        Static assets
```

### 3.1 Import rules (MUST)

```
app/            → feature/, components/, core/
app/api/        → core/services/, core/domain/, core/config/
feature/<a>/    → components/, core/          (never feature/<b>/)
components/     → core/ (utils, contexts, domain types only)
core/domain/    → nothing outside core/domain/ (pure TS)
core/services/  → core/domain/, core/config/  (server-only)
```

- Code shared by two features moves to `components/` (UI) or `core/` (logic).
- Client code (`"use client"`) never imports `core/services/` or `core/config/`. Mark both with `import "server-only"` so a mistake fails the build.
- See §9.3 for enforcing these rules with ESLint.

### 3.2 Naming (MUST)

| Thing | Convention | Example |
|---|---|---|
| Files and folders | kebab-case | `order-list.tsx`, `api-slice.ts` |
| Components | PascalCase export | `export function OrderList()` |
| Feature page | `<feature>-page.tsx`, default export | `orders-page.tsx` |
| Hooks | `use-*.ts` file, `useX` export | `use-order-filters.ts` |
| Redux slices | `<name>-slice.ts` | `ui-slice.ts` |
| Storage keys | `<app>_<key>` | `myapp_sidebar_collapsed` |
| Env vars | `UPPER_SNAKE`; only non-secrets get `NEXT_PUBLIC_` | `PAYMENTS_API_KEY` |

---

## 4. Core patterns

### 4.1 Thin routes, fat features (MUST)

```tsx
// app/orders/page.tsx
export { default } from "@/feature/orders/orders-page";
```

If a route needs route-level Next exports (`metadata`, `generateStaticParams`, `dynamic`), define them in the route file and keep rendering in the feature:

```tsx
// app/orders/[id]/page.tsx
import OrderDetailPage from "@/feature/orders/order-detail-page";
export const metadata = { title: "Order" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailPage id={id} />;
}
```

### 4.2 One root layout (SHOULD)

- `app/layout.tsx` is the only layout. It holds the providers, cross-page contexts and the app shell (sidebar, topbar, `<main>`).
- The layout stays a Server Component. Each provider is a small `"use client"` component that takes `children`.
- Add a route group (`app/(bare)/...` with its own layout) only when a page must render without the shell, such as a print view, an embed or a future login page. See §7.3.

### 4.3 Server boundary (MUST)

- The browser calls only same-origin `/api/**`, or uses Server Components / Server Actions.
- Secrets come from server env vars through `core/config/env.ts`. Never prefix a secret with `NEXT_PUBLIC_`.
- Responses to the client never include secrets. A settings endpoint returns `hasCredentials: true`, never the token.

### 4.4 Service facade (MUST when calling any backend)

Route handlers import only `core/services/<service>/<service>-client.ts`. The facade:
1. reads config once (`<service>-config.ts`), then
2. delegates to the real implementation (`<service>-api.ts`), or to the mock (`<service>-mock.ts`) when mocks are enabled or config is missing.

The facade stays a thin dispatcher with no business logic. Swapping a backend or adding a mock never touches route handlers or UI.

### 4.5 Route handler shape (MUST)

`validate input → call facade → apply core/domain logic → NextResponse.json(data)`

- Success: return the payload, for example `{ items: [...] }`.
- Failure: return `{ error: string }` with a correct status code (400 for bad input, 404 when not found, 500 for unexpected errors).
- Every route uses this error shape; `apiFetch` depends on it.

### 4.6 Client data layer (SHOULD)

- **`apiFetch()`** is the only `fetch` wrapper for same-origin calls. It handles the JSON header, threads `AbortSignal` and throws a typed `ApiError`.
- **One RTK Query `createApi`** with a `baseQuery` that wraps `apiFetch`. Every same-origin GET is an endpoint there, so components contain no ad-hoc `fetch`.
  - Use tags for cache invalidation (`providesTags` / `invalidatesTags`).
  - `refetchOnMountOrArgChange: 30` gives stale-while-revalidate behaviour.
  - `setupListeners` enables refetch on window focus and on reconnect.
- **Redux slices** hold client-only global state (UI preferences, session info). Server data belongs in RTK Query, not in slices.

### 4.7 Contexts for cross-page UI state (SHOULD)

- Use a React context for state that several pages share but that doesn't need Redux (sidebar open, current filter, view mode).
- Keep one concern per context.
- Read `localStorage` in `useEffect` after mount, never in a `useState` initializer, because the initializer also runs during SSR and causes hydration mismatches.
- Wrap storage access in `try/catch`, since it can throw in private mode.

### 4.8 Pure domain logic (MUST)

Types, filtering, calculations and mapping from API shapes to domain shapes live in `core/domain/`. Route handlers and components both call these functions; neither re-implements them.

---

## 5. Starter code

### 5.1 `app/layout.tsx`
```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AppProviders } from "@/components/providers/app-providers";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export const metadata: Metadata = { title: "MyApp", description: "..." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <AppProviders>
          <div className="flex min-h-screen w-full">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar />
              <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
            </div>
          </div>
          <Toaster />
        </AppProviders>
      </body>
    </html>
  );
}
```

### 5.2 `components/providers/app-providers.tsx`
One place that composes all client providers. To add or remove a provider, edit only this file.
```tsx
"use client";
import { useEffect } from "react";
import { Provider } from "react-redux";
import { setupListeners } from "@reduxjs/toolkit/query";
import { ThemeProvider } from "next-themes";
import { store } from "@/core/store";
import { SidebarProvider } from "@/core/contexts/sidebar-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => setupListeners(store.dispatch), []);
  return (
    <Provider store={store}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <SidebarProvider>{children}</SidebarProvider>
      </ThemeProvider>
    </Provider>
  );
}
```

### 5.3 `core/store/index.ts` and `core/store/hooks.ts`
```ts
import { configureStore } from "@reduxjs/toolkit";
import uiReducer from "@/core/store/ui-slice";
import { appApi } from "@/core/api/api-slice";

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    [appApi.reducerPath]: appApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(appApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```
```ts
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import type { AppDispatch, RootState } from "@/core/store";

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

### 5.4 `core/api/http.ts`
```ts
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Same-origin JSON fetch. Throws ApiError for non-2xx, using the `{ error }` body when present. */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers;
  const res = await fetch(input, { ...init, headers });
  const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : res.statusText || `Request to ${input} failed with status ${res.status}`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}
```

### 5.5 `core/api/api-slice.ts`
```ts
import { createApi, type BaseQueryFn } from "@reduxjs/toolkit/query/react";
import { apiFetch, ApiError } from "@/core/api/http";
import type { Entity } from "@/core/domain/types";

export interface ApiQueryError { status?: number; message: string }
export interface ApiRequestArgs { url: string; method?: string; body?: unknown }

const apiBaseQuery: BaseQueryFn<string | ApiRequestArgs, unknown, ApiQueryError> = async (arg, api) => {
  const { url, method, body } = typeof arg === "string" ? { url: arg, method: undefined, body: undefined } : arg;
  try {
    const data = await apiFetch(url, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: api.signal,
    });
    return { data };
  } catch (err) {
    if (err instanceof ApiError) return { error: { status: err.status, message: err.message } };
    return { error: { message: err instanceof Error ? err.message : "Request failed" } };
  }
};

export const appApi = createApi({
  reducerPath: "appApi",
  baseQuery: apiBaseQuery,
  refetchOnMountOrArgChange: 30,
  tagTypes: ["Entity"],
  endpoints: (builder) => ({
    getEntities: builder.query<{ items: Entity[] }, void>({
      query: () => "/api/entities",
      providesTags: ["Entity"],
    }),
    createEntity: builder.mutation<Entity, Omit<Entity, "id">>({
      query: (body) => ({ url: "/api/entities", method: "POST", body }),
      invalidatesTags: ["Entity"],
    }),
  }),
});

export const { useGetEntitiesQuery, useCreateEntityMutation } = appApi;
```

### 5.6 `core/config/env.ts`
Validate server env in one place so a missing variable fails clearly instead of producing `undefined` deep in a request.
```ts
import "server-only";

function optional(name: string) {
  return process.env[name] || null;
}

export const env = {
  useMocks: process.env.USE_MOCKS === "true",
  service: {
    baseUrl: optional("SERVICE_BASE_URL"),
    apiKey: optional("SERVICE_API_KEY"),
  },
};
```
You can swap in a schema validator (such as zod) if the project already uses one.

### 5.7 `core/services/<service>/` (facade + implementations)
```ts
// <service>-config.ts
import "server-only";
import { env } from "@/core/config/env";

export function getServiceConfig() {
  const { baseUrl, apiKey } = env.service;
  return { baseUrl, apiKey, useMock: env.useMocks || !baseUrl || !apiKey };
}
```
```ts
// <service>-api.ts
import "server-only";
import type { Entity } from "@/core/domain/types";
import { toEntity } from "@/core/domain/entity-mapping";

export async function fetchEntities(baseUrl: string, apiKey: string): Promise<Entity[]> {
  const res = await fetch(`${baseUrl}/entities`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Service responded ${res.status}`);
  const json = await res.json();
  return json.data.map(toEntity);
}
```
```ts
// <service>-mock.ts
import "server-only";
import fixtures from "@/data/entities.json";
import type { Entity } from "@/core/domain/types";

export async function getMockEntities(): Promise<Entity[]> {
  return fixtures as Entity[];
}
```
```ts
// <service>-client.ts (the only file route handlers import)
import "server-only";
import type { Entity } from "@/core/domain/types";
import { getServiceConfig } from "./service-config";
import { fetchEntities } from "./service-api";
import { getMockEntities } from "./service-mock";

export async function getEntities(): Promise<Entity[]> {
  const cfg = getServiceConfig();
  if (cfg.useMock) return getMockEntities();
  return fetchEntities(cfg.baseUrl!, cfg.apiKey!);
}
```

### 5.8 `app/api/entities/route.ts`
```ts
import { NextRequest, NextResponse } from "next/server";
import { getEntities } from "@/core/services/service/service-client";
import { filterEntities } from "@/core/domain/entity-filters";

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    const items = await getEntities();
    return NextResponse.json({ items: filterEntities(items, { status }) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load entities" },
      { status: 500 },
    );
  }
}
```

### 5.9 Feature page
```tsx
// feature/entities/entities-page.tsx
"use client";
import { useGetEntitiesQuery } from "@/core/api/api-slice";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityTable } from "./components/entity-table";

export default function EntitiesPage() {
  const { data, isLoading, error } = useGetEntitiesQuery();

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error) return <p className="text-destructive">{"message" in error ? error.message : "Failed"}</p>;
  return <EntityTable items={data?.items ?? []} />;
}
```

### 5.10 Context template (SSR-safe storage)
```tsx
"use client";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

const KEY = "myapp_sidebar_open";
const SidebarContext = createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState(true);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      if (stored !== null) setOpenState(stored === "1");
    } catch {}
  }, []);

  function setOpen(v: boolean) {
    setOpenState(v);
    try { window.localStorage.setItem(KEY, v ? "1" : "0"); } catch {}
  }

  return <SidebarContext.Provider value={{ open, setOpen }}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
```

### 5.11 `components/layout/nav-config.ts`
```ts
import { LayoutDashboard, List, Settings, type LucideIcon } from "lucide-react";

export interface NavItem { href: string; label: string; icon: LucideIcon }

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/entities", label: "Entities", icon: List },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);
```

### 5.12 `core/utils.ts`
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 6. Optional modules

Add only what the project needs. Each module is self-contained.

| Module | Add when | What it adds |
|---|---|---|
| **Mock data** | The backend is unavailable in dev, or for demos and offline work | `<service>-mock.ts`, `data/*.json`, `USE_MOCKS` env flag |
| **Runtime settings** | Users toggle behaviour at runtime (such as mock vs live) | `app/api/settings/route.ts` (GET returns flags only, PATCH sets a cookie), `getSettings`/`updateSettings` endpoints |
| **Theme toggle** | The app supports dark mode | `next-themes` provider + a toggle in the topbar |
| **Charts** | Dashboards | A charts library plus `core/colors/` for chart theme tokens |
| **Lighter data layer** | Small app with no global client state | Replace Redux + RTK Query with TanStack Query; keep `apiFetch` and the same `{ error }` contract |
| **Server-rendered data** | SEO pages or static content | Server Components call `core/services/*` directly (no `/api` hop); client interactivity stays in feature components |
| **Server Actions** | Form mutations | `feature/<feature>/actions.ts` (`"use server"`) calling the service facade |

---

## 7. Variants

### 7.1 No external backend (the app owns its data)
Treat the database as a service: `core/services/db/db-client.ts` (facade), `db-api.ts` (ORM queries), and an optional `db-mock.ts`. Everything else stays the same.

### 7.2 Several backends
Give each one its own folder: `core/services/payments/`, `core/services/cms/`, and so on. A route handler may call several facades and combine the results with `core/domain` functions.

### 7.3 Adding auth later
1. Move the shelled pages into `app/(app)/` with the shell layout, and put `login/` outside the group. URLs don't change, because route groups are not part of the path.
2. Make the root layout providers-only.
3. Guard routes in Next middleware/proxy, and check the session again inside route handlers.
4. Store tokens in httpOnly cookies, read only on the server.

### 7.4 Public API without secrets
Calling a public API straight from the client is acceptable. Still add an RTK Query endpoint, either through a second `createApi` or `fetchBaseQuery` with that base URL, so components contain no ad-hoc `fetch`.

---

## 8. Adopting the standard in an existing project

Migrate in this order; each step ships on its own.

1. **Alias and folders:** add `@/*`, then create `feature/`, `components/{ui,layout,providers}` and `core/{api,store,domain,services,config,contexts}`.
2. **Providers:** collect every existing client provider into `components/providers/app-providers.tsx` and render it once in `app/layout.tsx`.
3. **Shell:** move the sidebar/topbar into `components/layout/` and the nav list into `nav-config.ts`.
4. **Routes:** for each page, move its body to `feature/<feature>/<feature>-page.tsx` and replace `app/<feature>/page.tsx` with the one-line re-export.
5. **HTTP:** add `core/api/http.ts`, then convert existing route handlers to return `{ error }` on failure.
6. **Data layer:** add `api-slice.ts`, then replace ad-hoc `fetch` / `useEffect` loading one feature at a time.
7. **Server code:** move external calls and secrets into `core/services/<service>/` + `core/config/env.ts`, and add `import "server-only"`.
8. **Domain:** extract filtering, calculations and mapping into `core/domain/`.
9. **Enforce:** turn on the lint rules in §9.3.

Keep existing setup (fonts, analytics, i18n, design tokens) in place, and put it in the matching folder: providers in `app-providers.tsx`, tokens in `globals.css`.

---

## 9. Quality gates

### 9.1 Scripts (`package.json`)
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit"
  }
}
```

### 9.2 TypeScript
`"strict": true`, `"paths": { "@/*": ["./*"] }`.

### 9.3 Enforcing boundaries (ESLint)
```js
// eslint.config.mjs (add to the existing config)
{
  files: ["feature/**", "components/**"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["@/core/services/*", "@/core/config/*"], message: "Server-only. Call it via /api or a Server Component." },
      ],
    }],
  },
},
{
  files: ["core/**"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [{ group: ["@/feature/*", "@/app/*"], message: "core/ must not depend on features or routes." }],
    }],
  },
},
```
Add one rule per feature to block imports from other features if the team wants that enforced too.

### 9.4 `.env.example`
Commit the variable names with no values:
```
USE_MOCKS=true
SERVICE_BASE_URL=
SERVICE_API_KEY=
```

---

## 10. Checklist: adding a feature

1. **Types:** add to `core/domain/types.ts`; put pure logic in `core/domain/<topic>.ts`.
2. **Service:** add the real call to `<service>-api.ts`, optionally a mock to `<service>-mock.ts`, and a dispatcher to `<service>-client.ts`.
3. **Route handler:** `app/api/<resource>/route.ts` (validate, call the facade, `NextResponse.json`, `{ error }` on failure).
4. **Data hook:** add an endpoint and tags in `core/api/api-slice.ts`, then export the hook.
5. **UI:** `feature/<feature>/<feature>-page.tsx`, with feature components in `feature/<feature>/components/`.
6. **Route:** `app/<feature>/page.tsx` → `export { default } from "@/feature/<feature>/<feature>-page";`
7. **Nav:** add the item to `components/layout/nav-config.ts`.
8. **Verify:** run `pnpm lint && pnpm typecheck && pnpm build`.

---

## 11. Bootstrapping a new project

```bash
pnpm create next-app@latest my-app --ts --tailwind --app --eslint --import-alias "@/*"
cd my-app
pnpm add @reduxjs/toolkit react-redux next-themes sonner lucide-react clsx tailwind-merge class-variance-authority server-only
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card input label select dialog dropdown-menu table tabs badge skeleton separator sonner
```

Then create the folders from §3 and copy the starter files from §5.
