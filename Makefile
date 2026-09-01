.PHONY: all install dev dev-server dev-client build start test clean

# Default target
all: install build

# Install dependencies
install:
	npm install

# Run full development environment (Express Server on 3001 + Vite on 3000)
dev:
	npm run dev:all

# Run backend API server in watch mode
dev-server:
	npm run server

# Run frontend Vite dev server
dev-client:
	npm run dev

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
