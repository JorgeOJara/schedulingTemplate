# Scheduling Template SaaS Application

A full-stack scheduling application built with React, TypeScript, Node.js, and MySQL.

## Features

- **Multi-tenant Architecture**: Organization-based isolation
- **Staff Scheduling**: Weekly shift scheduling with calendar view
- **Time-Off Management**: Request and approval workflows
- **Shift Swaps**: Employee-to-employee shift exchanging
- **Overtime Tracking**: Automated overtime calculation with configurable thresholds
- **Real-time Notifications**: Email and in-app notifications
- **Role-Based Access**: Admin, Manager, and Employee roles

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for development and bundling
- Tailwind CSS for styling
- React Query for data fetching
- Zustand for state management
- Lucide React for icons

### Backend
- Node.js with TypeScript
- Express.js for REST API
- Prisma ORM for database operations
- MySQL for data storage
- JWT for authentication
- Docker for containerization

## Project Structure

```
schedulingTemplate/
├── apps/
│   ├── api/              # Backend API service
│   │   ├── prisma/       # Prisma schema and migrations
│   │   ├── src/          # Source code
│   │   │   ├── config/   # Configuration
│   │   │   ├── middleware/ # Auth and error handling
│   │   │   ├── routes/   # API routes
│   │   │   ├── services/ # Business logic
│   │   │   └── utils/    # Utilities
│   │   └── Dockerfile
│   └── web/              # Frontend application
│       ├── src/          # Source code
│       │   ├── components/ # React components
│       │   ├── pages/      # Page components
│       │   ├── services/   # API services
│       │   ├── store/      # State management
│       │   └── utils/      # Utilities
│       ├── tailwind.config.js
│       └── Dockerfile
├── infra/
│   ├── docker/           # Docker configurations
│   │   ├── docker-compose.yml
│   │   ├── api/Dockerfile
│   │   ├── web/Dockerfile
│   │   └── db/init/       # Database initialization
│   └── kubernetes/       # Kubernetes manifests
└── packages/
    ├── shared/           # Shared code and types
```

## Getting Started

### Prerequisites

- Node.js 18+
- Bun 1.1+
- Docker 20+
- Docker Compose 2+

### Installation

```bash
# Clone the repository
git clone https://github.com/codenovallc/schedulingTemplate.git
cd schedulingTemplate

# Install dependencies
cd apps/web
bun install

# Copy environment files
cp apps/api/.env.example apps/api/.env
cp infra/docker/.env.example infra/docker/.env

# Update .env with your values
vim apps/api/.env
vim infra/docker/.env

# Start services
cd infra/docker
docker-compose up -d
```

### Development

```bash
# Start the frontend
cd apps/web
bun dev

# Start the backend
cd apps/api
bun run dev
```

### Database Migrations

```bash
cd apps/api
bun prisma migrate dev
bun prisma generate
bun prisma studio
```

## API Endpoints

See `/apps/api/src/routes/v1/` for all API routes.

## Environment Variables

See `/apps/api/.env.example` and `/infra/docker/.env.example` for environment variable examples.

## License

MIT
