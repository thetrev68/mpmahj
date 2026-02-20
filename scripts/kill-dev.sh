#!/usr/bin/env bash
# Kill all local dev servers (Rust backend + Vite frontend).
# Targets: port 3000 (Axum), ports 5173-5177 (Vite)
# Usage: bash scripts/kill-dev.sh  OR  npm run kill

PORTS=(3000 5173 5174 5175 5176 5177)
KILLED=0

for PORT in "${PORTS[@]}"; do
  # netstat output on Windows includes lines like:
  #   TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    1234
  PIDS=$(netstat -aon 2>/dev/null \
    | grep -E "[:.]${PORT}[[:space:]]" \
    | grep -i "LISTENING" \
    | awk '{print $NF}' \
    | sort -u)

  for PID in $PIDS; do
    if [[ "$PID" =~ ^[0-9]+$ ]] && [ "$PID" -gt 0 ]; then
      echo "Killing PID $PID on port $PORT"
      taskkill //F //PID "$PID" > /dev/null 2>&1 && KILLED=$((KILLED + 1))
    fi
  done
done

if [ "$KILLED" -eq 0 ]; then
  echo "No dev servers found running."
else
  echo "Done. Killed $KILLED process(es)."
fi
