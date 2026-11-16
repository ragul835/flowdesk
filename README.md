# FlowDesk

**Team collaboration & project management SaaS** — an all-in-one workspace for tasks and boards with **real-time sync**.

Built with **Next.js (App Router) · Node.js · PostgreSQL · Prisma · Socket.io · Tailwind CSS · TypeScript**.

---

## Features

- 🔐 **Auth** — email/password with hashed passwords (bcrypt) and JWT session cookies
- 🏢 **Workspaces & roles** — Owner / Admin / Member role-based access control
- 🗂️ **Projects & Kanban boards** — default columns (Backlog → To Do → In Progress → Done)
- 🖱️ **Drag-and-drop** — move tasks between columns (native HTML5 DnD, no heavy deps)
- ⚡ **Real-time sync** — changes and **live presence** broadcast via WebSockets (Socket.io)
- 👤 **Task details** — title, description, priority, assignee, **due dates** (with overdue flags)
- 💬 **Comments** — threaded discussion on each task
- 🔎 **Search & filter** — filter the board by text, priority, or assignee
- ⚙️ **Project settings** — rename or delete projects (role-gated)
- 📊 **Analytics dashboard** — completion rate, tasks by status, by priority, by contributor
- ✅ **Validation** — all API input validated with Zod

---

## Architecture

```
Browser (Next.js client)
   │  REST (fetch, cookie auth)        │  WebSocket (socket.io-client)
   ▼                                   ▼
Next.js API routes  ──Prisma──►  PostgreSQL        Realtime server (Node + Socket.io)
(app/api/**)                                        (realtime/server.ts, port 4000)
```

- **REST API** (`src/app/api/**`) handles all data mutations with auth + access control.
- **Realtime server** (`realtime/server.ts`) is a standalone Node process that relays
  board-change events and tracks presence per project room. After a client mutates data
  via REST, it emits an event so every other viewer reloads instantly.

---

## Prerequisites

- **Node.js 18+**
- **PostgreSQL** — a local system install (recommended), or Docker via the included `docker-compose.yml`.

---

## Quick start (recommended: `manage.sh`)

The easiest path uses the bundled management script with your **system PostgreSQL**:

```bash
./manage.sh
```

Then choose **3. First-time setup** (installs deps → starts PostgreSQL → creates the
`flowdesk` database → pushes the schema → seeds sample data). No `sudo` needed — it
connects as the `postgres` user over TCP.

After that, choose **5. Start DEV** to run the app (Next.js on `:3000` + realtime on `:4000`).

### Manual steps (equivalent)

```bash
# 1. Install dependencies (also runs `prisma generate`)
npm install

# 2. Configure environment
cp .env.example .env

# 3. Create the database (uses the postgres superuser — no sudo)
PGPASSWORD=postgres createdb -h localhost -U postgres flowdesk

# 4. Create the schema and load sample data
npm run db:push
npm run db:seed

# 5. Run the app (Next.js on :3000 + realtime server on :4000)
npm run dev
```

> Using a different Postgres user/password? Update `DATABASE_URL` in `.env` to match.
> Prefer Docker? Run `docker compose up -d db` instead of step 3 (requires Docker).

Open **http://localhost:3000**.

### Sample accounts (password for all: `password123`)

| Email                | Role   |
| -------------------- | ------ |
| `ada@flowdesk.dev`   | Owner  |
| `linus@flowdesk.dev` | Admin  |
| `grace@flowdesk.dev` | Member |
| `mateo@flowdesk.dev` | Member |
| `priya@flowdesk.dev` | Member |

> **Try real-time:** open the same board in two browser windows (e.g. one normal, one
> incognito logged in as a different user). Drag a task or add one in window A — it
> appears in window B instantly, and you'll see each other in the presence avatars.

---

## Scripts

| Command           | Description                                           |
| ----------------- | ----------------------------------------------------- |
| `npm run dev`     | Next.js + realtime server together (dev)              |
| `npm run dev:web` | Next.js only                                          |
| `npm run dev:ws`  | Realtime (Socket.io) server only                      |
| `npm run build`   | Production build                                      |
| `npm start`       | Run production build (web + realtime)                 |
| `npm run db:push` | Push Prisma schema to the database                    |
| `npm run db:seed` | Seed sample team, projects, tasks, comments           |
| `npm run db:reset`| Reset the database and re-seed                         |
| `npm run db:studio`| Open Prisma Studio to inspect data                   |

---

## Environment variables

| Variable             | Purpose                                      |
| -------------------- | -------------------------------------------- |
| `DATABASE_URL`       | PostgreSQL connection string                 |
| `JWT_SECRET`         | Secret for signing session tokens            |
| `WS_PORT`            | Port for the realtime server (default 4000)  |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL the browser connects to        |

---

## Project structure

```
flowdesk/
├─ prisma/
│  ├─ schema.prisma        # User, Workspace, Membership, Project, Column, Task, Comment
│  └─ seed.ts              # sample data
├─ realtime/
│  └─ server.ts            # Socket.io presence + board-change relay
├─ src/
│  ├─ app/
│  │  ├─ page.tsx          # marketing / landing
│  │  ├─ login, register/  # auth pages
│  │  ├─ (app)/            # authenticated shell (guarded)
│  │  │  ├─ dashboard/     # projects + analytics
│  │  │  └─ board/[id]/    # Kanban board
│  │  └─ api/              # REST endpoints (auth, projects, tasks, analytics)
│  ├─ components/          # Board, TaskCard, TaskDialog, dialogs, nav
│  └─ lib/                 # prisma, auth, access control, validation, socket hook
├─ docker-compose.yml      # PostgreSQL 16
└─ .env.example
```

---

## Roadmap

Planned enhancements: refresh-token rotation, rate limiting, email verification,
server-side authorization on the realtime channel, task-order persistence within a
column, file attachments, @mentions in comments, and an audit log.

## License

MIT © FlowDesk
