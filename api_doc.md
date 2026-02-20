# API Documentation (v1)

Base URL: `/api`
Auth: JWT Bearer Token in `Authorization: Bearer <token>`

---

## 1. AUTHENTICATION

### Register

POST `/auth/register`
Body:

```
{ name, email, password }
```

Response:

```
{ token, user }
```

### Login

POST `/auth/login`
Body:

```
{ email, password }
```

Response:

```
{ token, user }
```

### Get Current User

GET `/auth/me`
Headers: Auth required

---

## 2. USERS & ROLES

Roles: `admin | manager | member`

### Get User Profile

GET `/users/:id`

### Update Role (Admin)

PUT `/users/:id/role`
Body:

```
{ role }
```

---

## 3. PROJECTS

### Create Project

POST `/projects`
Body:

```
{ name, description, deadline }
```

### Get My Projects

GET `/projects`

### Get Project Details

GET `/projects/:projectId`

### Add Member

POST `/projects/:projectId/members`
Body:

```
{ userId }
```

### Delete Project

DELETE `/projects/:projectId`

---

## 4. TASKS (KANBAN ENGINE)

Status: `todo | inprogress | review | done`
Priority: `low | medium | high`

### Create Task

POST `/tasks`
Body:

```
{ projectId, title, description, priority, assigneeId, dueDate }
```

### Get Tasks by Project

GET `/tasks/project/:projectId`

### Update Task Status (Drag & Drop)

PUT `/tasks/:taskId/status`
Body:

```
{ status }
```

### Update Task Details

PUT `/tasks/:taskId`

### Delete Task

DELETE `/tasks/:taskId`

---

## 5. TASK COMMENTS (COLLABORATION)

### Add Comment

POST `/tasks/:taskId/comments`
Body:

```
{ message }
```

### Get Task Comments

GET `/tasks/:taskId/comments`

---

## 6. NOTIFICATIONS

### Get Notifications

GET `/notifications`

### Mark as Read

PUT `/notifications/:id/read`

Triggers:

* Task assigned
* Task status changed
* New comment added

---

## 7. AI FEATURES

### Generate Project Plan

POST `/ai/plan`
Body:

```
{ idea, teamSize, deadline }
```

Response:

```
{ milestones[], tasks[] }
```

### Generate SRS / Docs

POST `/ai/generate-doc`
Body:

```
{ projectId, type: "SRS | PPT | README" }
```

### Research Assistant Chat

POST `/ai/chat`
Body:

```
{ projectId, message }
```

---

## 8. GITHUB INTEGRATION

### Create Repo from Template

POST `/github/create-repo`
Body:

```
{ projectId, repoName }
```

### Create Issues from Tasks

POST `/github/sync-tasks/:projectId`

---

## 9. OFFLINE SYNC ENGINE

### Sync Offline Actions

POST `/sync/offline-actions`
Body:

```
{ actions[] }
```

---

## STANDARD RESPONSES

Success:

```
{ success: true, data }
```

Error:

```
{ success: false, message }
```
