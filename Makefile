.PHONY: help up down reset-db seed test lint typecheck

help:
	@echo "Available commands:"
	@echo "  make up              - Start all services (docker-compose up)"
	@echo "  make down            - Stop all services (docker-compose down)"
	@echo "  make reset-db        - Reset database (drop, create, migrate)"
	@echo "  make seed            - Seed database with sample data"
	@echo "  make test            - Run tests"
	@echo "  make lint            - Run linter"
	@echo "  make typecheck       - Run type checks"
	@echo "  make format          - Format code"

up:
	@echo "Starting Docker services..."
	docker-compose -f infra/docker/docker-compose.yml up -d

down:
	@echo "Stopping Docker services..."
	docker-compose -f infra/docker/docker-compose.yml down

reset-db:
	@echo "Resetting database..."
	docker-compose -f infra/docker/docker-compose.yml exec mysql mysql -u root -p$$MYSQL_ROOT_PASSWORD -e "DROP DATABASE IF EXISTS scheduling; CREATE DATABASE scheduling;"
	bun --cwd apps/api prisma migrate reset --force

seed:
	@echo "Seeding database..."
	bun --cwd apps/api prisma db seed

test:
	@echo "Running tests..."
	bun --cwd apps/api test
	bun --cwd apps/web test

lint:
	@echo "Running linter..."
	bun --cwd apps/api lint
	bun --cwd apps/web lint

typecheck:
	@echo "Running type checks..."
	bun --cwd apps/api typecheck
	bun --cwd apps/web typecheck

format:
	@echo "Formatting code..."
	bun --cwd apps/api format
	bun --cwd apps/web format
