#!/bin/bash
set -e

echo "=== Starting PrintForProfitable Dev Environment ==="

# Start postgres
echo "Starting PostgreSQL..."
docker compose up -d postgres
sleep 3

# Run migrations and generate client
echo "Running Prisma generate + migrations..."
cd backend
npx prisma generate
npx prisma migrate dev 2>/dev/null || npx prisma migrate deploy
cd ..

# Start backend and frontend in parallel
echo "Starting backend (port 3001) and frontend (port 5173)..."
cd backend && npm run dev &
BACKEND_PID=$!
cd frontend && npm run dev &
FRONTEND_PID=$!

# Cleanup on exit
trap "echo 'Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

echo ""
echo "  Backend:  http://localhost:3001"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services."

wait
