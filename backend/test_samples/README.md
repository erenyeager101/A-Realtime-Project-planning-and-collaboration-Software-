# TaskManagementSystem

TaskManagementSystem was generated from UML architecture diagrams using AI-powered code generation.

## 📋 Generated From

**Diagram Analysis:**
- **Diagram Type**: uml-class
- **Target Languages**: JavaScript, TypeScript
- **Entities**: 3
- **Relationships**: 3
- **Architectural Patterns**: MVC, Repository, Service Layer

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Git

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd taskmanagementsystem
```

2. Install all dependencies:
```bash
npm run install:all
```

3. Set up environment variables:
```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI and other settings
```

4. Start development servers:
```bash
npm run dev
```

This will start:
- Backend: http://localhost:5000
- Frontend: http://localhost:5173

## 📁 Project Structure

```
├── backend/
│   ├── controllers/      # Express controllers
│   ├── models/           # Mongoose models
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   └── server.js         # Entry point
│
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API services
│   │   └── App.jsx       # App component
│   └── package.json
│
└── README.md
```

## 🏗️ Backend Models

- **User**: Generated model
- **Project**: Generated model
- **Task**: Generated model

## 🎨 Frontend Components

- **UserList**: Generated component
- **ProjectList**: Generated component
- **TaskList**: Generated component
- **UserForm**: Generated component
- **ProjectForm**: Generated component
- **TaskForm**: Generated component

## 🔧 Customization

The generated code provides a solid foundation. You'll likely want to:

1. **Add Authentication**: Implement JWT-based auth or OAuth
2. **Add Validation**: Enhance input validation using express-validator or Joi
3. **Add Tests**: Write unit and integration tests
4. **Customize UI**: Update Tailwind styles and layouts
5. **Add Features**: Implement business-specific logic

## 🧪 Running Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd ../frontend
npm test
```

## 📝 API Documentation

All API endpoints are prefixed with `/api`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /api/users | UserController get |
| POST | /api/users | UserController post |
| PUT | /api/users/:id | UserController put |
| DELETE | /api/users/:id | UserController delete |
| GET | /api/projects | ProjectController get |
| POST | /api/projects | ProjectController post |
| PUT | /api/projects/:id | ProjectController put |
| DELETE | /api/projects/:id | ProjectController delete |
| POST | /api/projects/:id/members | ProjectController post |
| GET | /api/tasks | TaskController get |
| POST | /api/tasks | TaskController post |
| PUT | /api/tasks/:id | TaskController put |
| DELETE | /api/tasks/:id | TaskController delete |
| POST | /api/tasks/:id/assign | TaskController post |
| POST | /api/tasks/:id/comments | TaskController post |

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is generated from architectural diagrams. Customize as needed for your use case.

---

*Generated with ❤️ by AI-powered code generation*
