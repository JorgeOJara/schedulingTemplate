# Docker Deployment

This directory contains Docker configurations for the scheduling application.

## Services

- **api**: Backend API service
- **web**: Frontend React application
- **mysql**: Database server
- **adminer**: Database management UI

## Usage

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Restart a specific service
docker-compose restart api

# Run database migrations
docker-compose exec api bun prisma migrate deploy
```

## Environment Variables

Create a `.env` file in this directory based on `.env.example`.

## Volumes

- `mysql_data`: Persistent MySQL data storage
- `api/src`: Hot-reload source code
- `web/src`: Hot-reload frontend code
