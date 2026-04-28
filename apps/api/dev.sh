#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
source .venv/bin/activate
uv sync

VERBOSE_FLAG=0
if [[ "${1:-}" == "--verbose" || "${1:-}" == "-v" ]]; then
  VERBOSE_FLAG=1
fi

if [[ "$VERBOSE_FLAG" -eq 1 ]]; then
  echo "[dev] Starting API in verbose mode (VERBOSE=1)"
  exec env VERBOSE=1 uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
fi

exec env VERBOSE=0 uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
