#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../apps/api"
uv run python -c "
from kahucik_api.main import app
import json
print(json.dumps(app.openapi(), indent=2))
" > ../../apps/web/openapi.json
echo "Wrote apps/web/openapi.json"
