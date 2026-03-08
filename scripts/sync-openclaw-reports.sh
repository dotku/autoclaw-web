#!/bin/bash
# Sync OpenClaw cron job data + latest session summaries to a JSON file
# Run this periodically (e.g., every 15 minutes) or before viewing reports

SYNC_FILE="/tmp/openclaw-reports-sync.json"
CONTAINER="openclaw-gateway"

# Check if container is running
if ! docker inspect "$CONTAINER" &>/dev/null; then
  echo "Container $CONTAINER not found"
  exit 1
fi

# Extract cron jobs with state
JOBS=$(docker exec "$CONTAINER" cat /home/node/.openclaw/cron/jobs.json 2>/dev/null)
if [ -z "$JOBS" ]; then
  echo "Failed to read cron jobs"
  exit 1
fi

# Extract latest session summary for each cron job
SUMMARIES=$(docker exec "$CONTAINER" node -e "
const fs = require('fs');
const path = require('path');

const sessionsDir = '/home/node/.openclaw/agents/main/sessions';
const sessionsIndex = path.join(sessionsDir, 'sessions.json');

try {
  const index = JSON.parse(fs.readFileSync(sessionsIndex, 'utf8'));

  // Group sessions by cron job, keep latest
  const latest = {};
  for (const [key, val] of Object.entries(index)) {
    const label = val.label || '';
    if (!label.startsWith('Cron:')) continue;
    const jobName = label.replace('Cron: ', '').trim();
    const updated = val.updatedAt || 0;
    if (!latest[jobName] || updated > latest[jobName].updated) {
      latest[jobName] = { updated, sid: val.sessionId };
    }
  }

  // Read last assistant message from each session
  const summaries = {};
  for (const [jobName, info] of Object.entries(latest)) {
    try {
      const logFile = path.join(sessionsDir, info.sid + '.jsonl');
      const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');

      // Find last assistant message
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const evt = JSON.parse(lines[i]);
          const msg = evt.message || evt;
          if (msg.role === 'assistant') {
            let text = '';
            if (Array.isArray(msg.content)) {
              for (const c of msg.content) {
                if (c.type === 'text') text += c.text;
              }
            } else if (typeof msg.content === 'string') {
              text = msg.content;
            }
            if (text) {
              summaries[jobName] = text.substring(0, 1000);
              break;
            }
          }
        } catch {}
      }
    } catch {}
  }

  console.log(JSON.stringify(summaries));
} catch (e) {
  console.log('{}');
}
" 2>/dev/null)

# Combine into sync file
python3 -c "
import json, sys

jobs_raw = '''$JOBS'''
summaries_raw = '''$SUMMARIES'''

try:
    jobs_data = json.loads(jobs_raw)
    jobs = jobs_data.get('jobs', [])
except:
    jobs = []

try:
    summaries = json.loads(summaries_raw)
except:
    summaries = {}

output = {
    'jobs': jobs,
    'summaries': summaries,
    'synced_at': $(date +%s)
}

with open('$SYNC_FILE', 'w') as f:
    json.dump(output, f)

print(f'Synced {len(jobs)} jobs, {len(summaries)} summaries to $SYNC_FILE')
"
