#!/bin/bash

echo "Starting Ressourcenmanagement..."
echo ""

echo "Starting backend on http://localhost:8003..."
uv run python -m backend.main &
BACKEND_PID=$!

sleep 2

echo "Starting frontend on http://localhost:5174..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Ressourcenmanagement is running!"
echo "  Backend:  http://localhost:8003"
echo "  Frontend: http://localhost:5174"
echo ""
echo "Press Ctrl+C to stop both servers"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
