# HPMS Web

React 19 + TypeScript + Vite frontend for the HPMS FastAPI backend (Phase 6).

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api, /graphql, /ws to :8000
npm test           # Vitest + Testing Library + MSW
npm run build      # typecheck + production build to dist/
npm run lint
```

Set `HPMS_BACKEND_URL` in `.env` to point the dev proxy at another backend (see `.env.example`).

## Stack

| Concern | Choice |
|---|---|
| Routing | React Router (lazy route chunks in `src/router.tsx`) |
| Server state | TanStack Query; keys in `src/hooks/queries.ts` |
| Client state | Zustand: `useAuthStore` (sessionStorage), `useUIStore` (theme, language), `useNotificationStore` |
| HTTP | Axios instance in `src/services/api.ts` (bearer token, `Accept-Language`, 401 → sign out) |
| Real-time | `NotificationSocket` for `/ws/notifications`; events invalidate queries via `useNotificationSocket` |
| Styling | Tailwind v4 with semantic tokens in `src/styles/index.css`; dark mode via `data-theme` |
| Tests | Vitest, Testing Library, MSW handlers in `src/test/server.ts` |

## Layout

```
src/
  components/common   Button, Card, Badge, DataTable, Pagination, Field, StatCard, States…
  components/layout   AppShell + ProtectedRoute, Sidebar, Header, NotificationBell, toggles
  pages/              Login, Dashboard, Projects, ProjectDetail, Loans, placeholders
  services/           api.ts, endpoints.ts, graphql.ts, websocket.ts
  store/ hooks/ utils/ types/ test/
```

## API notes

- Types in `src/types/api.ts` mirror `backend/app/schemas`. Pydantic serializes `Decimal`
  as strings, so money and capacity are parsed only for display (`src/utils/format.ts`).
- Data comes from REST. `services/graphql.ts` is a thin helper; the GraphQL resolvers
  currently reference columns that don't exist on `Project`, so nothing depends on it yet.
- Compliance, Analytics, Maintenance and Admin are placeholders until the backend
  exposes REST routes for `backend/app/compliance` and `backend/app/analytics`.
