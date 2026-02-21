# EnterprisePM — Realtime Project Planning & Collaboration

A Jira-like project collaboration platform with AI-powered planning, Kanban boards, real-time collaboration, GitHub integration, and more.

## Features

- **Auth** — JWT + Role-Based Access Control (Admin, Manager, Member)
- **Projects** — Create, manage, and invite team members
- **Kanban Board** — Drag-and-drop task management (Todo → In Progress → Review → Done)
- **Real-time** — Socket.IO powered live updates
- **AI Planner** — Generate full project plans from a description (Mistral / Gemini / Ollama)
- **AI Research Assistant** — Ask questions about your project with context awareness
- **AI Doc Generator** — Auto-generate SRS, PPT outlines, demo scripts, architecture docs
- **Project Health** — AI-powered risk analysis and health scoring
- **Resource Hub** — Knowledge base per project
- **GitHub Integration** — OAuth login, repo linking, webhook support
- **Notifications** — Real-time notification system

## Tech Stack

| Layer      | Technology                              |
| ---------- | --------------------------------------- |
| Frontend   | React 19, Vite, Tailwind CSS 4, dnd-kit |
| Backend    | Node.js, Express 5, Socket.IO          |
| Database   | MongoDB (Mongoose)                      |
| AI         | Mistral AI, Google Gemini, Ollama       |
| Auth       | JWT, bcrypt                             |

---

## Quick Start (Docker) — Recommended

### 1. Pull & run the image

```bash
docker build -t enterprise-pm .
docker run -d -p 5000:5000 --name enterprise-pm enterprise-pm
```

### 2. Open the setup wizard

Navigate to **http://localhost:5000/setup** in your browser.

The setup wizard will guide you through:
- MongoDB connection URI
- AI provider API keys (Mistral / Gemini / Ollama)
- GitHub OAuth credentials (optional)

### 3. Create your admin account

After setup, you'll be redirected to register. The first user you create will be your admin.

### 4. Configure later

Admin users can update all settings anytime at **http://localhost:5000/settings**.

---

## Local Development

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server runs on `http://localhost:5173` and proxies API calls to `http://localhost:5000`.

---

## Environment Variables

See [`backend/.env.example`](backend/.env.example) for all configurable values.

| Variable             | Description                           | Required |
| -------------------- | ------------------------------------- | -------- |
| `MONGO_URI`          | MongoDB connection string             | Yes      |
| `JWT_SECRET`         | Secret key for JWT tokens             | Yes      |
| `AI_PROVIDER`        | `mistral` \| `gemini` \| `ollama`     | Yes      |
| `MISTRAL_API_KEY`    | Mistral AI API key                    | If using Mistral |
| `GEMINI_API_KEY`     | Google Gemini API key                 | If using Gemini  |
| `GITHUB_CLIENT_ID`   | GitHub OAuth App Client ID            | Optional |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret      | Optional |

---

## Project Structure

```
enterprise-pm/
├── Dockerfile
├── .dockerignore
├── backend/
│   ├── server.js          # Express + Socket.IO entry point
│   ├── .env.example       # Environment template
│   ├── middleware/         # Auth & RBAC middleware
│   ├── models/            # Mongoose schemas
│   ├── routes/            # REST API routes
│   └── services/          # AI service (multi-provider)
└── frontend/
    ├── vite.config.js
    └── src/
        ├── components/    # Navbar, NotificationBell, PrivateRoute
        ├── context/       # Auth & Socket context providers
        ├── pages/         # All page components
        └── services/      # Axios API clients
```

## License

MIT
