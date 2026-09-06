.PHONY: all install dev dev-server dev-client service-logs build start test clean

# Default target
all: install build

# Install dependencies
install:
	npm install

# Kill stale processes on ports 3001 and 3002
kill-ports:
	@lsof -ti:3001,3002 | xargs kill -9 2>/dev/null || true

# Run full development environment (Express Server on 3001 + Vite on 3002)
dev:
	@lsof -ti:3001,3002 | xargs kill -9 2>/dev/null || true
	npm run dev:all

# Run backend API server in watch mode
dev-server:
	npm run server

# Run frontend Vite dev server
dev-client:
	npm run dev

# Run continuous high-throughput log stream generator (100 lines/sec, 1GB auto-truncation)
service-logs:
	npm run service:logs

# Build production assets
build:
	npm run build

# Start production server serving built assets on http://localhost:3001
start:
	NODE_ENV=production npm start

# Run unit and integration tests
test:
	npm test && npx tsx test/api.test.ts

# Clean artifacts and caches
clean:
	rm -rf dist .vite
