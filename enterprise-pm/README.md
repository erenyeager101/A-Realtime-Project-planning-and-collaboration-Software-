# EnterprisePM

See the main [README](../README.md) for full documentation, setup guides, and feature details.

## Quick Start

### Docker (Recommended)

```bash
docker build -t enterprise-pm .
docker run -d -p 5000:5000 --name enterprise-pm enterprise-pm
# Open http://localhost:5000/setup
```

### Local Development

```bash
# Backend
cd backend && cp .env.example .env && npm install && npm run dev

# Frontend (new terminal)
cd frontend && npm install && npm run dev

# Open http://localhost:5173
```

See [`backend/.env.example`](backend/.env.example) for all configuration options.
