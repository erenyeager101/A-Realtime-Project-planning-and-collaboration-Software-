# EnterprisePM — Realtime Project Planning & Collaboration Software

### *The project management tool built for students who are tired of managing projects in WhatsApp groups.*

---

## The Problem

Every semester, the same story repeats:

- Your team plans the project on WhatsApp — messages get buried in 200 unread texts.
- Tasks live in a shared Google Doc that nobody updates.
- One person does 80% of the work, but there's no proof.
- The night before the demo, you're writing the SRS from scratch.
- You have no idea what's "done" vs "in progress" vs "hasn't started."
- Your guide asks for an architecture diagram and you stare blankly.

**Jira** is too complex. **Trello** has no AI. **Notion** isn't built for dev teams. **None of them** auto-generate your college documents.

EnterprisePM was built to solve exactly this.

---

## What This Actually Does

This is a **full-stack, Jira-style project management platform** with AI superpowers, designed specifically for student teams building software projects.

### Core Platform
| Feature | What it does |
|---------|-------------|
| **Kanban Board** | Drag-and-drop tasks across Todo → In Progress → Review → Done. Real-time sync across all team members. |
| **Project Management** | Create projects, invite team members, track progress with visual completion bars. |
| **Role-Based Access** | Admin, Manager, and Member roles. Admins control settings, managers manage projects, members work on tasks. |
| **Task Management** | Create tasks with priority levels (low/medium/high/urgent), due dates, assignees, and detailed descriptions. |
| **Comments & Collaboration** | Threaded comments on every task. See who said what and when. |
| **Real-time Notifications** | Socket.IO powered. Task assigned? Status changed? You know instantly. |

### AI Features (The Real Game-Changer)
| Feature | What it does |
|---------|-------------|
| **One-Click Project Pack** | Type your project idea (e.g., "Hospital Management System in MERN") → AI generates a complete project with Kanban board, tasks, SRS draft, PPT outline, timeline, and research resources. One click. |
| **AI Project Planner** | Describe your project → get a structured plan with modules, tasks (15-30), tech stack recommendations, timeline with phases, milestones, and risk analysis. |
| **AI Research Assistant** | A context-aware chatbot that knows your project. Ask it about architecture patterns, testing strategies, security measures, database schema — it answers with project-specific context. Conversations persist. |
| **AI Document Generator** | Auto-generate college-ready documents: **SRS** (IEEE 830 standard), **Architecture Document**, **Use Case Document** (UML), **PPT Outline** (with speaker notes), **Demo Script** (with Q&A prep). Download as Markdown. |
| **Project Health Analysis** | AI scans your tasks, timelines, and workloads. Returns a health score (0–100), flags issues (overdue tasks, idle members, scope creep), and gives actionable recommendations. |
| **AI Task Breakdown** | Give it a high-level task like "Build authentication system" → it breaks it into 5-10 assignable subtasks with time estimates. |

### GitHub Integration
| Feature | What it does |
|---------|-------------|
| **OAuth Connect** | One-click GitHub login and account linking. |
| **Link Repos to Projects** | Associate GitHub repositories with your EnterprisePM projects. |
| **Create Issues from Tasks** | Push tasks directly to GitHub Issues. |
| **Create Feature Branches** | Generate Git branches named after tasks. |
| **PR Tracking** | See pull requests linked to tasks with merged/open/closed status. |
| **Sync Status** | Keep task status in sync with GitHub issue state. |

### Resource Hub
- Pin links, notes, code snippets, AI summaries, and file references to any project.
- Search and filter by type. Tag resources for organization.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, Tailwind CSS 4, dnd-kit (drag & drop) |
| Backend | Node.js, Express 5, Socket.IO (real-time) |
| Database | MongoDB with Mongoose ODM |
| AI Providers | Mistral AI, Google Gemini, Ollama (local) — auto-fallback chain |
| Auth | JWT + bcrypt + RBAC middleware |
| GitHub | OAuth 2.0, REST API integration |
| Deployment | Docker (single image) |

---

## Quick Start — Docker (Recommended)

> **One image. One command. Everything runs.**

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed on your machine
- A MongoDB database (free tier on [MongoDB Atlas](https://www.mongodb.com/atlas) works perfectly)
- At least one AI API key — either [Mistral](https://console.mistral.ai/) (free) or [Google Gemini](https://aistudio.google.dev/apikey) (free)

### Step 1 — Clone & Build

```bash
git clone https://github.com/erenyeager101/A-Realtime-Project-planning-and-collaboration-Software-.git
cd A-Realtime-Project-planning-and-collaboration-Software-/enterprise-pm
docker build -t enterprise-pm .
```

### Step 2 — Run

```bash
docker run -d -p 5000:5000 --name enterprise-pm enterprise-pm
```

### Step 3 — Configure via Setup Wizard

Open **http://localhost:5000/setup** in your browser.

The setup wizard walks you through 3 steps:

1. **Database** — Paste your MongoDB connection URI
2. **AI Provider** — Choose Mistral/Gemini/Ollama and enter your API key
3. **GitHub OAuth** *(optional)* — Enter your GitHub OAuth app credentials

### Step 4 — Create Your Admin Account

After setup completes, you'll be redirected to the registration page. The first account you create has **admin** access and can manage all settings later at `/settings`.

### Step 5 — Start Collaborating

Share the URL with your team. They register, you add them to your project, and everyone sees real-time updates on the Kanban board.

---

## Local Development Setup

For contributors or developers who want to run the app without Docker.

### Prerequisites

- **Node.js 18+** — [Download here](https://nodejs.org/)
- **MongoDB** — Either install locally or use [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier)
- **Git** — [Download here](https://git-scm.com/)

### Step 1 — Clone the Repository

```bash
git clone https://github.com/erenyeager101/A-Realtime-Project-planning-and-collaboration-Software-.git
cd A-Realtime-Project-planning-and-collaboration-Software-/enterprise-pm
```

### Step 2 — Setup Backend

```bash
cd backend
cp .env.example .env
```

Open `.env` and fill in your credentials:

```env
# Required
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>
JWT_SECRET=any-random-long-string-here

# Pick one AI provider and add its key
AI_PROVIDER=mistral
MISTRAL_API_KEY=your-key-from-console.mistral.ai

# Optional — for GitHub integration
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
GITHUB_CALLBACK_URL=http://localhost:5000/api/github/callback
```

Install dependencies and start the backend:

```bash
npm install
npm run dev
```

The API server starts on `http://localhost:5000`.

### Step 3 — Setup Frontend

Open a **new terminal**:

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on `http://localhost:5173` and automatically proxies API calls to the backend.

### Step 4 — Open the App

Go to **http://localhost:5173** → Register → Start building.

---

## Getting Free API Keys

### MongoDB Atlas (Database)
1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) → Create a free account
2. Create a free M0 cluster → Click "Connect" → "Connect your application"
3. Copy the connection string → Replace `<password>` with your actual password

### Mistral AI (Recommended AI Provider)
1. Go to [console.mistral.ai](https://console.mistral.ai/) → Sign up free
2. Go to API Keys → Create a new key → Copy it

### Google Gemini (Alternative AI Provider)
1. Go to [aistudio.google.dev/apikey](https://aistudio.google.dev/apikey) → Sign in with Google
2. Click "Create API Key" → Copy it

### GitHub OAuth (Optional — for GitHub integration)
1. Go to [github.com/settings/developers](https://github.com/settings/developers) → "New OAuth App"
2. Set Homepage URL to `http://localhost:5173`
3. Set Callback URL to `http://localhost:5000/api/github/callback`
4. Copy the Client ID and generate a Client Secret

---

## Environment Variables Reference

All variables are configured in `backend/.env`. See [`backend/.env.example`](enterprise-pm/backend/.env.example) for the template.

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGO_URI` | MongoDB connection string | **Yes** |
| `JWT_SECRET` | Secret for signing JWT tokens (any random string) | **Yes** |
| `AI_PROVIDER` | Active AI provider: `mistral`, `gemini`, or `ollama` | **Yes** |
| `MISTRAL_API_KEY` | Mistral API key | If using Mistral |
| `GEMINI_API_KEY` | Google Gemini API key | If using Gemini |
| `OLLAMA_BASE_URL` | Ollama server URL (default: `http://localhost:11434`) | If using Ollama |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | Optional |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret | Optional |
| `GITHUB_CALLBACK_URL` | GitHub OAuth callback URL | Optional |
| `PORT` | Server port (default: `5000`) | No |
| `CLIENT_URL` | Frontend URL (default: `http://localhost:5173`) | No |

---

## Project Structure

```
enterprise-pm/
├── Dockerfile              # Single-image Docker build
├── .dockerignore
├── README.md
│
├── backend/
│   ├── server.js           # Express + Socket.IO + static file serving
│   ├── .env.example        # Environment variable template
│   ├── package.json
│   ├── middleware/
│   │   └── auth.js         # JWT verification + RBAC (admin/manager/member)
│   ├── models/
│   │   ├── User.js         # User schema with password hashing
│   │   ├── Project.js      # Project with members, status, dates
│   │   ├── Task.js         # Task with priority, status, comments
│   │   ├── Notification.js # Real-time notification storage
│   │   ├── Activity.js     # Action audit log
│   │   ├── AIConversation.js  # Persistent AI chat history
│   │   ├── GeneratedDoc.js    # AI-generated documents
│   │   └── Resource.js        # Knowledge base resources
│   ├── routes/
│   │   ├── authRoutes.js       # Register, login, profile, onboarding
│   │   ├── projectRoutes.js    # CRUD projects, manage members
│   │   ├── taskRoutes.js       # CRUD tasks, comments, status updates
│   │   ├── aiRoutes.js         # AI planner, research, docs, health
│   │   ├── settingsRoutes.js   # Admin settings & first-time setup
│   │   ├── notificationRoutes.js
│   │   ├── resourceRoutes.js
│   │   └── githubRoutes.js     # OAuth, repos, issues, branches, PRs
│   └── services/
│       ├── aiService.js        # Multi-provider AI (Mistral/Gemini/Ollama)
│       └── githubService.js    # GitHub API wrapper
│
└── frontend/
    ├── vite.config.js          # Dev proxy to backend
    ├── package.json
    └── src/
        ├── App.jsx             # Route definitions
        ├── index.css           # Tailwind + custom styles
        ├── components/
        │   ├── Navbar.jsx          # Top nav with AI tools dropdown
        │   ├── NotificationBell.jsx # Real-time notification indicator
        │   └── PrivateRoute.jsx     # Auth guard wrapper
        ├── context/
        │   ├── AuthContext.jsx      # JWT auth state management
        │   └── SocketContext.jsx    # Socket.IO connection provider
        ├── pages/
        │   ├── Setup.jsx           # First-time setup wizard (no auth)
        │   ├── Login.jsx           # Split-screen login
        │   ├── Register.jsx        # Registration with social proof
        │   ├── Onboarding.jsx      # 3-step profile personalization
        │   ├── Dashboard.jsx       # Project hub + One-Click Project Pack
        │   ├── ProjectDetails.jsx  # Project overview + team management
        │   ├── KanbanBoard.jsx     # Drag-and-drop task board
        │   ├── TaskDetail.jsx      # Task view/edit + comments + GitHub
        │   ├── AIPlanner.jsx       # AI project plan generator
        │   ├── ResearchAssistant.jsx # Context-aware AI chatbot
        │   ├── DocGenerator.jsx    # SRS, PPT, Architecture doc generator
        │   ├── ProjectHealth.jsx   # AI health scoring dashboard
        │   ├── ResourceHub.jsx     # Knowledge base per project
        │   ├── Settings.jsx        # Admin configuration panel
        │   ├── GitHubDashboard.jsx # GitHub account & repo management
        │   └── ProjectGitHub.jsx   # Per-project GitHub integration
        └── services/               # Axios API clients for each module
```

---

## How It Helps Students

| Pain Point | How EnterprisePM Solves It |
|-----------|--------------------------|
| "We planned everything on WhatsApp and lost track" | Kanban board with real-time sync. Everyone sees the same board, always. |
| "I don't know what tasks to create for my project" | AI Planner generates 15-30 tasks from a one-line description. |
| "I have to write the SRS the night before submission" | AI Doc Generator creates IEEE 830 SRS, architecture docs, and use cases in 30 seconds. |
| "My guide asked for a PPT outline and demo script" | AI generates presentation outlines with speaker notes and timed demo scripts. |
| "I don't know if my project is on track" | Project Health gives a score out of 100 and flags overdue tasks, idle members, and risks. |
| "I want to connect my GitHub repo to my task board" | Link repos, create issues from tasks, track PRs, and create feature branches — all from the UI. |
| "I'm a beginner and don't know the best tech stack" | AI recommends tech stack, breaks down tasks by category, and estimates hours. |
| "I need research help for my project topic" | Research Assistant is a project-aware AI that answers questions with context. |
| "Our team has no visibility into who's doing what" | Task assignees, progress bars, activity logs, and real-time notifications. |

---

## Pages & Screenshots

| Page | Description |
|------|-------------|
| `/setup` | First-time configuration wizard (Database → AI → GitHub) |
| `/login` | Split-screen login with branded marketing panel |
| `/register` | Registration with social proof elements |
| `/onboarding` | 3-step profile setup (profession, experience, goals) |
| `/dashboard` | Project hub with One-Click Project Pack AI feature |
| `/project/:id` | Project overview, team, progress, AI quick actions |
| `/project/:id/board` | Kanban board with drag-and-drop and real-time sync |
| `/task/:id` | Task detail with comments, editing, and GitHub integration |
| `/ai/planner` | AI project plan generator |
| `/project/:id/research` | Context-aware AI research chatbot |
| `/project/:id/docs` | AI document generator (SRS, PPT, Architecture, etc.) |
| `/project/:id/health` | AI-powered project health dashboard |
| `/project/:id/resources` | Knowledge base and resource hub |
| `/settings` | Admin settings panel (API keys, database, providers) |
| `/github` | GitHub account management and repo linking |

---

## Contributing

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to your branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT — Use it, modify it, ship it. Just don't blame us if your project scores less than an A.

---

**Built with frustration from too many semester projects managed on WhatsApp.**