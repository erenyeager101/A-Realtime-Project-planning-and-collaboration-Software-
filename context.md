# EnterprisePM Project Context

## Product Perspective

EnterprisePM is a full-stack project planning and collaboration platform built to ease the software development cycle for student teams, academic project groups, and small development teams. The product sits between simple task boards and heavier enterprise tools: it gives users a practical workspace for turning a raw software idea into a managed project with tasks, sprints, documents, resources, GitHub workflows, and AI-assisted planning.

The system is designed around one central idea: software teams lose time when planning, tracking, documentation, research, and code collaboration are spread across unrelated tools. EnterprisePM brings those parts into one workflow. A user can create a project manually, or describe an idea and let AI generate a complete starter pack containing a project, Kanban tasks, SRS content, presentation outline, and research resources. From there, the team can assign work, track status, discuss tasks, manage sprints, link GitHub repositories, create issues and branches, generate academic documents, analyze project health, and even turn architecture diagrams into generated code branches.

## High-Level Architecture

The repository contains a MERN-style application:

- Frontend: React 19, Vite 7, Tailwind CSS 4, React Router, dnd-kit, axios, Socket.IO client.
- Backend: Node.js, Express 5, MongoDB with Mongoose, Socket.IO, JWT authentication, bcrypt password hashing.
- AI integrations: Ollama, Mistral, Gemini, and a coding-oriented Mistral/Codestral path for diagram-to-code generation.
- GitHub integration: OAuth account linking, repository linking, issue creation, branch creation, PR tracking, Actions status, webhooks, and code push workflows.
- Deployment: single Docker image that builds the frontend and serves the static build from the Express backend.

Runtime flow:

1. The frontend runs through Vite in development and proxies `/api` calls to the backend.
2. The backend exposes REST endpoints under `/api/*`.
3. Authenticated API calls carry a JWT in the `Authorization: Bearer <token>` header.
4. MongoDB stores users, projects, tasks, sprints, resources, notifications, generated documents, conversations, and activity logs.
5. Socket.IO rooms use `project-${projectId}` to deliver real-time project/task/GitHub updates.
6. In production or Docker, the backend serves `frontend/dist` and falls back to `index.html` for SPA routes.

## Main Directory Structure

```text
enterprise-pm/
  backend/
    server.js
    models/
    routes/
    middleware/
    services/
    test_*.js
    test_samples/
  frontend/
    src/
      App.jsx
      pages/
      components/
      context/
      services/
    vite.config.js
  Dockerfile
  README.md
```

## Backend Entry Point

`backend/server.js` creates the Express app, wraps it in an HTTP server, attaches Socket.IO, registers middleware, mounts all route modules, exposes `/api/health`, serves the frontend build when available, and then starts the server after attempting a MongoDB connection.

Important mounted routes:

- `/api/auth`
- `/api/projects`
- `/api/tasks`
- `/api/notifications`
- `/api/ai`
- `/api/resources`
- `/api/github`
- `/api/settings`
- `/api/sprints`
- `/api/diagrams`

The server can start in setup mode if `MONGO_URI` is missing or invalid. This supports the first-time setup wizard at `/setup`.

## Data Model

### User

`User` stores account identity, password hash, global role, GitHub connection metadata, and onboarding profile.

Key fields:

- `name`, `email`, `password`
- `role`: `admin`, `manager`, `member`
- `github.connected`, `github.accessToken`, `github.username`, `github.profileUrl`, `github.avatarUrl`, `github.githubId`
- `onboarded`
- `profile.profession`, `organization`, `specialization`, `experience`, `teamSize`, `interests`, `goal`

Passwords are hashed with bcrypt before save. JSON serialization removes the password.

### Project

`Project` is the top-level collaboration container.

Key fields:

- `name`, `description`, `owner`
- `members`: user references with project-local roles
- `startDate`, `endDate`, `status`
- `github`: linked repo data, default branch, webhook info, last sync time
- `generatedBranches`: history of AI-generated code branches and PRs

Project roles are separate from global user roles. The project owner is treated as project `admin`.

### Task

`Task` powers the Kanban board, sprint planning, dependencies, comments, and GitHub issue/branch linkage.

Key fields:

- `title`, `description`, `projectId`
- `sprintId`
- `assignee`
- `priority`: `low`, `medium`, `high`, `urgent`
- `status`: `todo`, `inprogress`, `review`, `done`
- `dueDate`
- `comments`
- `dependsOn`
- `order`
- `github.issueNumber`, `issueUrl`, `issueState`, `linkedPRs`, `branchName`

Indexes support project/status/order and project/sprint/status/order queries.

### Sprint

`Sprint` groups tasks into timeboxed delivery windows.

Key fields:

- `projectId`, `name`, `goal`
- `startDate`, `endDate`
- `status`: `planning`, `active`, `completed`, `cancelled`
- `createdBy`, `completedAt`

There is a unique project-level sprint name index, and the API prevents multiple active sprints in one project.

### Resource

`Resource` supports the project knowledge base.

Types:

- `link`
- `note`
- `snippet`
- `ai_summary`
- `file`

Resources can be tagged, pinned, searched by type/tag, and linked to the user who added them.

### Notification

`Notification` stores user-specific events such as task assignments, task updates, comments, project membership changes, and project creation.

### Activity

`Activity` stores audit-style events for task changes, comments, project creation, member additions, GitHub actions, pushes, branches, PRs, and issue creation.

### AIConversation

`AIConversation` stores project-scoped AI research chat history with user and assistant messages.

### GeneratedDoc

`GeneratedDoc` stores generated academic/project documents.

Supported types:

- `srs`
- `ppt_outline`
- `demo_script`
- `architecture`
- `use_cases`

Docs are versioned per project and type.

## Authentication And Authorization

Authentication uses JWT:

- Register: `POST /api/auth/register`
- Login: `POST /api/auth/login`
- Current user: `GET /api/auth/me`
- Onboarding profile: `PUT /api/auth/onboard`

The first registered user becomes a global `admin`; later users default to `member`.

Authorization layers:

- `auth` middleware validates JWT and loads `req.user`.
- `authorize(...roles)` checks global user roles.
- `requireProjectRoles(...)` checks project membership and project-local role.
- `requireTaskProjectRoles(...)` loads the task, derives its project, and checks project role.
- `requireSprintProjectRoles(...)` loads the sprint, derives its project, and checks project role.

Project-level permissions are the most important access boundary in the app. Members can view and collaborate; managers/admins can create and update most planning artifacts; project admins/owners control membership and deletion.

## Core Product Modules

### Dashboard And Project Creation

The dashboard lists projects visible to the current user. Users can create a project manually or use the One-Click Project Pack feature.

One-Click Project Pack flow:

1. User enters a project idea.
2. Frontend calls `POST /api/ai/project-pack`.
3. Backend sends the idea and user onboarding profile to the AI service.
4. AI returns a structured pack with project name, description, modules, tasks, timeline, tech stack, risks, SRS outline, PPT outline, research resources, demo checklist, first-week plan, and recommended roles.
5. Backend creates the project, tasks, generated docs, and resources.
6. Frontend navigates to the new project.

This is the strongest product differentiator because it turns an abstract software idea into an immediately usable project workspace.

### Project Management

Project routes support:

- Create project
- List current user's projects
- Fetch project details
- Update project metadata
- Add project members by user ID or email
- Delete project by owner

The system logs project creation and member changes in `Activity`, sends notifications for new members, and emits `project-updated` through Socket.IO.

### Kanban Board

The board has four fixed statuses:

- `todo`
- `inprogress`
- `review`
- `done`

Frontend uses `@dnd-kit` for drag-and-drop movement across columns. Status changes are optimistic in the UI and then persisted through `PATCH /api/tasks/:id/status`.

Task events emit through Socket.IO:

- `task-created`
- `task-updated`
- `task-deleted`
- `tasks-bulk-created`

Task dependency handling:

- `dependsOn` stores task dependencies.
- API validates that dependencies belong to the same project.
- API rejects self-dependency.
- API detects dependency cycles.
- API prevents moving a task to `done` while unresolved dependencies remain.
- API adds `dependencyState` to task responses so the frontend can show blocked tasks.

### Sprint Planning

Sprint APIs support:

- List sprints for a project
- Create sprint
- Get sprint details with status summary
- Update sprint metadata
- Change sprint status
- Assign/remove task IDs
- Delete sprint

When a sprint is completed or cancelled, incomplete tasks can be moved back to backlog. The Kanban page can show backlog tasks or tasks from a selected sprint.

### Task Detail And Collaboration

Task APIs support creation, viewing, updating, deleting, moving between sprints, editing dependencies, adding comments, and changing status. Comments are stored inline in the task document and populated with user names/emails.

Notifications are created when:

- A task is assigned.
- A task status changes.
- A comment is added to a task assigned to someone else.
- A member is added to a project.

### Resource Hub

Resource routes expose project-scoped CRUD:

- `GET /api/resources/:projectId`
- `POST /api/resources/:projectId`
- `PUT /api/resources/:projectId/:id`
- `PATCH /api/resources/:projectId/:id/pin`
- `DELETE /api/resources/:projectId/:id`

This module acts as the team knowledge base for research links, notes, code snippets, AI summaries, and file references.

### AI Planner

`POST /api/ai/plan` accepts a project description and returns a structured project plan. If a `projectId` is passed and the user is a project manager/admin, the backend also creates tasks from generated modules.

Generated plan structure includes:

- `projectName`
- `summary`
- `modules`
- `tasks`
- `milestones`
- `timeline`
- `risks`
- `techStack`

### AI Research Assistant

`POST /api/ai/research/:projectId` answers questions using project context:

- project name
- project description
- task list with statuses/priorities
- team size
- optional conversation history

Conversations persist in `AIConversation` and can be listed or fetched later.

### AI Document Generator

`POST /api/ai/generate-doc/:projectId` generates academic-quality markdown documents.

Supported outputs:

- Software Requirements Specification
- Presentation outline
- Demo script
- Architecture document
- Use case document

The backend saves every generated document with a version number.

### Project Health

`GET /api/ai/health/:projectId` builds a project data snapshot and asks AI to return JSON with:

- `overallHealth`
- `score`
- `issues`
- `insights`
- `recommendations`

The snapshot includes task counts, member roles, overdue calculation, assignee names, priorities, and days since update.

### AI Task Breakdown

`POST /api/ai/breakdown` converts a high-level task into smaller assignable subtasks with priority, estimated hours, category, dependencies, and total estimate.

### Diagram-To-Code Generator

The diagram module lets a user upload a UML, architecture, ER, component, or similar diagram image and ask the system to analyze it.

There are two workflows:

1. Preview only:
   - `POST /api/diagrams/analyze`
   - Upload image.
   - Analyze with Mistral multimodal API.
   - Generate a code plan.
   - Return analysis, plan, and generated file structure preview.

2. Full GitHub generation:
   - `POST /api/diagrams/projects/:projectId/generate-code`
   - Requires GitHub connection and linked repository.
   - Upload image.
   - Analyze diagram.
   - Generate code plan.
   - Generate actual code files using Codestral/Mistral.
   - Push files to a new GitHub branch.
   - Optionally create a pull request.
   - Store generation metadata in `Project.generatedBranches`.

Generated artifacts include backend models/controllers/services, frontend components/pages/services, package files, server setup, Vite config, README, and setup scripts.

## AI Provider Design

`backend/services/aiService.js` centralizes general AI behavior.

Supported providers:

- Ollama local chat API
- Mistral chat API
- Gemini chat API

Provider selection uses `AI_PROVIDER`, with fallback chains:

- `ollama`: Ollama, then Mistral, then Gemini
- `mistral`: Mistral, then Gemini, then Ollama
- `gemini`: Gemini, then Mistral, then Ollama

General AI functions:

- `generateProjectPlan`
- `researchAssistant`
- `generateDocument`
- `analyzeProjectHealth`
- `breakdownTask`
- `generateProjectPack`

The project-pack generator has JSON cleanup helpers and retries. If JSON parsing repeatedly fails, it returns a fallback starter pack so the feature can still produce a usable project.

Diagram/code generation uses a separate coding path:

- `diagramAnalysisService.js` analyzes images and creates code plans.
- `codeGenerationService.js` generates code files using the coding API key.
- `gitBranchService.js` pushes generated files to GitHub and opens PRs.

## GitHub Integration

GitHub routes support:

- OAuth connect/callback/disconnect/status
- List repositories
- Create repository
- Link/unlink a repository to a project
- Repository stats
- List issues
- Create issue from task
- Sync task status to GitHub issue state
- Bulk create issues
- List pull requests
- View PR details, reviews, and files
- List commits
- List branches
- Create feature branch from a task
- List GitHub Actions runs and workflows
- Search code
- Fetch README
- Receive GitHub webhooks
- Show GitHub activity feed

GitHub data is stored in both `User.github` and `Project.github`.

Important GitHub behavior:

- OAuth state encodes the EnterprisePM user ID.
- The access token is stored on the user document.
- Linked repo data is stored on the project.
- Webhook creation is attempted when linking a repo but treated as non-critical.
- Webhook events emit live updates for pushes, pull requests, issue state changes, and workflow runs.
- Merged PRs can update task `github.linkedPRs` when branch names match task branches.

## Frontend Architecture

`frontend/src/App.jsx` defines all routes through React Router.

Public routes:

- `/setup`
- `/login`
- `/register`

Authenticated routes:

- `/onboarding`
- `/dashboard`
- `/project/:id`
- `/project/:id/board`
- `/task/:id`
- `/ai/planner`
- `/project/:id/research`
- `/project/:id/docs`
- `/project/:id/health`
- `/project/:id/resources`
- `/ai/code-generator`
- `/project/:id/code-generator`
- `/github`
- `/project/:id/github`
- `/settings`

The frontend uses:

- `AuthContext` to load and store the current user.
- `SocketContext` to create a Socket.IO client after login.
- `services/api.js` as the shared axios instance with JWT request interceptor and 401 logout handling.

Frontend service files map UI actions to backend APIs:

- `authService.js`
- `projectService.js`
- `taskService.js`
- `sprintService.js`
- `aiService.js`
- `resourceService.js`
- `githubService.js`
- `diagramService.js`
- `notificationService.js`
- `settingsService.js`

Main frontend pages:

- `Dashboard`: project list, manual project creation, One-Click Project Pack.
- `ProjectDetails`: project overview and navigation into board, docs, health, resources, GitHub, and code generation.
- `KanbanBoard`: backlog/sprint task board with drag-and-drop.
- `TaskDetail`: detailed task view, comments, dependencies, GitHub task actions.
- `AIPlanner`: standalone project planning flow.
- `ResearchAssistant`: project-context AI chat.
- `DocGenerator`: generated document management.
- `ProjectHealth`: AI health analysis.
- `ResourceHub`: project knowledge base.
- `GitHubDashboard`: user-level GitHub connection/repo view.
- `ProjectGitHub`: project repo operations.
- `DiagramCodeGenerator`: diagram analysis and GitHub code generation flow.
- `Settings`: admin runtime configuration.
- `Setup`: first-time `.env` configuration.

## Configuration

Backend configuration is stored in `backend/.env`.

Core keys:

- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `CLIENT_URL`

AI keys:

- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `MISTRAL_API_KEY`
- `MISTRAL_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `AI_PROVIDER`
- `MISTRAL_API_KEY_CODING`
- `CODESTRAL_MODEL`

GitHub keys:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL`
- `GITHUB_WEBHOOK_SECRET`

Note: `.env.example` currently documents the general AI and GitHub variables, but the diagram-to-code path also expects `MISTRAL_API_KEY_CODING` and `CODESTRAL_MODEL`.

The Settings UI can read masked configuration values, update allowed `.env` keys, and perform first-time setup without authentication when no app config exists.

## Deployment

The Dockerfile builds a single production image:

1. Stage 1 installs frontend dependencies and runs `npm run build`.
2. Stage 2 installs backend production dependencies.
3. The built frontend is copied into `/app/frontend/dist`.
4. Express serves the frontend and API from port `5000`.
5. A health check calls `/api/health`.

Local development normally uses two terminals:

```bash
cd enterprise-pm/backend
npm install
npm run dev
```

```bash
cd enterprise-pm/frontend
npm install
npm run dev
```

## Real-Time Collaboration

Socket.IO is used for immediate collaboration feedback. Clients join a project room with:

```text
join-project(projectId)
```

The backend emits project and task events to:

```text
project-${projectId}
```

Notable events:

- `project-updated`
- `task-created`
- `task-updated`
- `task-deleted`
- `tasks-bulk-created`
- `github-push`
- `github-pr-opened`
- `github-pr-merged`
- `github-action`

## API Surface Summary

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/onboard`

Projects:

- `POST /api/projects`
- `GET /api/projects`
- `GET /api/projects/:id`
- `PUT /api/projects/:id`
- `POST /api/projects/:id/members`
- `DELETE /api/projects/:id`

Tasks:

- `POST /api/tasks`
- `GET /api/tasks/project/:projectId`
- `GET /api/tasks/:id`
- `PUT /api/tasks/:id`
- `PATCH /api/tasks/:id/status`
- `PATCH /api/tasks/:id/sprint`
- `PATCH /api/tasks/:id/dependencies`
- `POST /api/tasks/:id/comments`
- `DELETE /api/tasks/:id`

Sprints:

- `GET /api/sprints/project/:projectId`
- `POST /api/sprints/project/:projectId`
- `GET /api/sprints/:id`
- `PUT /api/sprints/:id`
- `PATCH /api/sprints/:id/status`
- `POST /api/sprints/:id/tasks`
- `DELETE /api/sprints/:id`

AI:

- `POST /api/ai/plan`
- `POST /api/ai/breakdown`
- `POST /api/ai/research/:projectId`
- `GET /api/ai/conversations/:projectId`
- `GET /api/ai/conversations/:projectId/:conversationId`
- `POST /api/ai/generate-doc/:projectId`
- `GET /api/ai/docs/:projectId`
- `GET /api/ai/docs/:projectId/:docId`
- `DELETE /api/ai/docs/:projectId/:docId`
- `GET /api/ai/health/:projectId`
- `POST /api/ai/project-pack`

Resources:

- `GET /api/resources/:projectId`
- `POST /api/resources/:projectId`
- `PUT /api/resources/:projectId/:id`
- `PATCH /api/resources/:projectId/:id/pin`
- `DELETE /api/resources/:projectId/:id`

Notifications:

- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`

Settings:

- `GET /api/settings`
- `GET /api/settings/status`
- `PUT /api/settings`
- `POST /api/settings/setup`

Diagrams:

- `POST /api/diagrams/analyze`
- `POST /api/diagrams/projects/:projectId/generate-code`
- `GET /api/diagrams/github/projects/:projectId/generate-status`

GitHub:

- `GET /api/github/connect`
- `GET /api/github/callback`
- `POST /api/github/disconnect`
- `GET /api/github/status`
- `GET /api/github/repos`
- `POST /api/github/repos`
- `GET /api/github/repos/:owner/:repo/stats`
- `POST /api/github/repos/link`
- `POST /api/github/repos/unlink`
- `GET /api/github/projects/:projectId/issues`
- `POST /api/github/tasks/:taskId/create-issue`
- `POST /api/github/tasks/:taskId/sync-issue`
- `POST /api/github/projects/:projectId/bulk-create-issues`
- `GET /api/github/projects/:projectId/pulls`
- `GET /api/github/projects/:projectId/pulls/:prNumber`
- `GET /api/github/projects/:projectId/commits`
- `GET /api/github/projects/:projectId/branches`
- `POST /api/github/tasks/:taskId/create-branch`
- `GET /api/github/projects/:projectId/actions/runs`
- `GET /api/github/projects/:projectId/actions/workflows`
- `GET /api/github/projects/:projectId/search`
- `GET /api/github/projects/:projectId/readme`
- `POST /api/github/webhooks`
- `GET /api/github/projects/:projectId/activity`

## Development And Quality Notes

Current implementation strengths:

- Clear backend modularity through models, routes, middleware, and services.
- Project-level authorization is handled consistently for most project-owned resources.
- Real-time updates are built into core project/task workflows.
- AI features are well aligned with the product goal of easing the software development lifecycle.
- GitHub integration covers planning-to-code workflows: tasks, issues, branches, PRs, commits, Actions, and webhooks.
- Docker deployment is straightforward and serves the full app from one process.

Current risks and technical debt:

- `backend/services/codeGenerationService.js` contains a stray backslash before `return files;`, which can cause a syntax/runtime failure when the module is loaded.
- `backend/routes/notificationRoutes.js` uses `earror.message` instead of `error.message` in the unread-count catch block.
- `SocketContext.jsx` hardcodes `http://localhost:5000` instead of deriving the socket URL from environment/config, which may break deployed frontend origins.
- GitHub access tokens are stored directly in MongoDB; production hardening should encrypt them or use a more secure token storage strategy.
- Settings writes secrets to `.env` at runtime; this is convenient for local/Docker setup but may not fit immutable production hosting.
- AI JSON parsing is handled defensively in the project-pack flow, but other JSON-returning AI functions still directly call `JSON.parse(result)` and can fail on fenced or malformed model output.
- The diagram code generation workflow depends on `MISTRAL_API_KEY_CODING`, but that key is not documented in `.env.example`.
- Webhook signature verification compares strings directly; a timing-safe comparison would be stronger.
- Test scripts are mostly ad hoc files and package scripts do not run a real automated test suite yet.

## Intended User Journey

1. Admin configures database, JWT, AI provider, and optional GitHub OAuth in setup.
2. First user registers and becomes admin.
3. User completes onboarding so AI features can tailor project packs.
4. User creates a project manually or launches a full AI Project Pack from an idea.
5. Team members are added to the project with project roles.
6. Tasks are refined, assigned, moved through Kanban, grouped into sprints, and discussed through comments.
7. Research resources and generated documents build the academic/project knowledge base.
8. GitHub is connected and a repository is linked.
9. Tasks become GitHub issues and feature branches.
10. Pull requests, commits, Actions, and issue state changes feed back into the project workspace.
11. AI health analysis helps the team spot overdue work, idle items, unassigned tasks, and delivery risks.
12. Diagram-to-code generation can turn architecture diagrams into a GitHub branch or PR for further development.

## One-Sentence Summary

EnterprisePM is an AI-assisted, real-time project management and development lifecycle platform that helps teams move from idea to plan, tasks, documentation, resources, GitHub execution, and delivery with less manual coordination overhead.
