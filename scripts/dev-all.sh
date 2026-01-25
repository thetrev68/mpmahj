#!/usr/bin/env bash
# Start backend server and frontend dev client concurrently for user testing.
# Usage:
#   bash scripts/dev-all.sh
# Optional env vars:
#   ALLOWED_ORIGINS (default: "http://localhost:5173,http://localhost:1420")

set -euo pipefail

ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-"http://localhost:5173,http://localhost:1420"}
export ALLOWED_ORIGINS

echo "== American Mahjong Dev Servers =="
echo "CORS ALLOWED_ORIGINS: $ALLOWED_ORIGINS"

# Start Rust server (Axum WebSocket)
pushd crates/mahjong_server > /dev/null
cargo run &
SERVER_PID=$!
popd > /dev/null

wait_for_port() {
	local host=$1
	local port=$2
	local attempts=${3:-30}

	for _ in $(seq 1 "$attempts"); do
		if (echo >/dev/tcp/${host}/${port}) >/dev/null 2>&1; then
			return 0
		fi
		sleep 0.5
	done

	return 1
}

echo "Waiting for server on localhost:3000..."
if ! wait_for_port localhost 3000 40; then
	echo "Server did not become ready on port 3000 in time."
	kill "$SERVER_PID" 2>/dev/null || true
	exit 1
fi

# Start Vite client (React)
pushd apps/client > /dev/null
npm run dev &
CLIENT_PID=$!
popd > /dev/null

trap "echo; echo 'Shutting down dev servers...'; kill $SERVER_PID $CLIENT_PID 2>/dev/null || true" EXIT

echo "Server:   ws://localhost:3000/ws"
echo "Frontend: http://localhost:5173"

# Wait for both processes to exit
wait
