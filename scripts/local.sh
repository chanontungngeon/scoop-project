#!/usr/bin/env bash
# Scoop on this Mac: one command each to set up, start and stop the bot, the AI model and the public link.
# Normally run through the Makefile (`make start`), but `./scripts/local.sh start` works the same.
set -uo pipefail
cd "$(dirname "$0")/.."

RUN=.run
LOGS=logs
mkdir -p "$RUN" "$LOGS"

bold=$'\033[1m'; green=$'\033[32m'; yellow=$'\033[33m'; red=$'\033[31m'; dim=$'\033[2m'; off=$'\033[0m'
say()  { printf '%s\n' "$*"; }
ok()   { printf '%s✔%s %s\n' "$green" "$off" "$*"; }
warn() { printf '%s!%s %s\n' "$yellow" "$off" "$*"; }
fail() { printf '%s✘ %s%s\n' "$red" "$*" "$off"; exit 1; }
step() { printf '\n%s%s%s\n' "$bold" "$*" "$off"; }

# Reads KEY=value from .env without running it as shell code (tokens can contain + / =).
env_get() {
  [ -f .env ] || return 0
  grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -e 's/[[:space:]]\{1,\}#.*$//' -e 's/^["'\'']//' -e 's/["'\'']$//'
}
env_set() {
  local key=$1 value=$2
  if grep -qE "^$key=" .env; then
    local tmp; tmp=$(mktemp)
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k {print k "=" v; next} {print}' .env > "$tmp" && mv "$tmp" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

PORT=${SCOOP_PORT:-$(env_get PORT)}; PORT=${PORT:-3000}
export PORT
MODEL=$(env_get OLLAMA_MODEL); MODEL=${MODEL:-qwen3:14b}
OLLAMA=${OLLAMA_URL:-$(env_get OLLAMA_URL)}; OLLAMA=${OLLAMA:-http://localhost:11434}

alive()   { [ -f "$RUN/$1.pid" ] && kill -0 "$(cat "$RUN/$1.pid")" 2>/dev/null; }
port_pid() { lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1; }
ollama_up() { curl -s -m 3 "$OLLAMA/api/tags" >/dev/null 2>&1; }
has_model() { curl -s -m 5 "$OLLAMA/api/tags" | grep -q "\"name\":\"$MODEL\""; }
line_keys_set() { [ -n "$(env_get LINE_CHANNEL_SECRET)" ] && [ -n "$(env_get LINE_CHANNEL_ACCESS_TOKEN)" ]; }

start_ollama() {
  if ollama_up; then ok "AI model service (Ollama) is running"; return 0; fi
  command -v ollama >/dev/null || fail "Ollama is not installed. Run: make setup"
  say "Starting Ollama…"
  if [ -d /Applications/Ollama.app ]; then
    open -ga Ollama
  else
    nohup ollama serve > "$LOGS/ollama.log" 2>&1 &
    echo $! > "$RUN/ollama.pid"
  fi
  for _ in $(seq 1 30); do ollama_up && { ok "Ollama started"; return 0; }; sleep 1; done
  fail "Ollama did not start. See $LOGS/ollama.log"
}

ensure_model() {
  if has_model; then ok "AI model $MODEL is downloaded"; return 0; fi
  warn "Downloading the AI model $MODEL (about 9 GB, one time only — this can take a while)…"
  ollama pull "$MODEL" || fail "Could not download $MODEL. Check the internet connection and try again."
}

cmd_help() {
  cat <<EOF
${bold}Scoop — commands${off}

  ${bold}make setup${off}    First time only: installs what's needed and asks for the LINE keys
  ${bold}make start${off}    Starts Scoop: AI model + bot + public link, and connects it to LINE
  ${bold}make stop${off}     Stops everything
  ${bold}make status${off}   Shows what is running and the current webhook link
  ${bold}make restart${off}  Stop, then start
  ${bold}make logs${off}     Watch what the bot is doing (Ctrl+C to leave)
  ${bold}make chat${off}     Chat with Scoop in this window, without LINE
  ${bold}make test${off}     Run the automatic checks
  ${bold}make menu${off}     Upload the bottom menu to LINE (once, or after changing it)
  ${bold}make reset${off}    Delete all users and bookings (asks first)
EOF
}

cmd_setup() {
  step "1/5  Checking tools"
  if ! command -v brew >/dev/null; then
    fail "Homebrew is missing. Open https://brew.sh, copy the install command into Terminal, run it, then run: make setup"
  fi
  ok "Homebrew"
  for tool in node ollama cloudflared; do
    if command -v "$tool" >/dev/null; then ok "$tool"; else say "Installing $tool…"; brew install "$tool" || fail "Could not install $tool"; fi
  done
  local v; v=$(node -p 'process.versions.node')
  node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=18)?0:1)' \
    || fail "Node $v is too old (needs 22.18 or newer). Run: brew upgrade node"

  step "2/5  Installing the bot's packages"
  npm install --no-audit --no-fund --loglevel=error || fail "npm install failed"
  ok "Packages installed"

  step "3/5  LINE keys"
  [ -f .env ] || { cp .env.example .env; ok "Created .env"; }
  if line_keys_set; then
    ok "LINE keys are already in .env"
  else
    say "Open ${bold}https://developers.line.biz/console/${off} → your provider → your Messaging API channel."
    say "  • Channel secret: ${bold}Basic settings${off} tab"
    say "  • Channel access token: ${bold}Messaging API${off} tab, bottom of the page (press Issue if it's empty)"
    local secret token
    read -r -p "Paste the Channel secret and press Enter: " secret
    read -r -p "Paste the Channel access token and press Enter: " token
    [ -n "$secret" ] && [ -n "$token" ] || fail "Both keys are needed. Run make setup again when you have them."
    env_set LINE_CHANNEL_SECRET "$secret"
    env_set LINE_CHANNEL_ACCESS_TOKEN "$token"
    ok "Saved to .env (this file stays on this Mac)"
  fi

  step "4/5  AI model"
  start_ollama
  ensure_model

  step "5/5  Automatic checks"
  npm test --silent >/dev/null 2>&1 && ok "All checks passed" || warn "Some checks failed — run: make test"

  say ""
  ok "${bold}Setup done.${off} Next: ${bold}make start${off}"
}

set_line_webhook() {
  local url=$1 token; token=$(env_get LINE_CHANNEL_ACCESS_TOKEN)
  if [ "${SCOOP_SKIP_LINE:-}" = 1 ]; then warn "Skipped updating LINE (SCOOP_SKIP_LINE=1)"; return 1; fi
  local res
  # LINE answers 400 "Invalid webhook endpoint URL" until the new tunnel's hostname resolves for it (~10 s), so retry.
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    res=$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X PUT https://api.line.me/v2/bot/channel/webhook/endpoint \
      -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "{\"endpoint\":\"$url\"}")
    [ "$res" = 400 ] || break
    sleep 4
  done
  [ "$res" = 200 ] || { warn "LINE did not accept the new link (HTTP $res). Check the access token in .env."; return 1; }
  ok "LINE now sends messages to the new link"
  # A brand-new tunnel can take a few seconds to be reachable; ask LINE to test it until it answers.
  for _ in 1 2 3 4 5 6 7 8; do
    if curl -s -m 20 -X POST https://api.line.me/v2/bot/channel/webhook/test -H "Authorization: Bearer $token" \
      -H 'Content-Type: application/json' -d "{\"endpoint\":\"$url\"}" | grep -q '"success":true'; then
      ok "LINE test message reached the bot"; return 0
    fi
    sleep 4
  done
  warn "LINE could not reach the bot yet. Wait a minute, then run: make status"
  return 1
}

cmd_start() {
  line_keys_set || fail "LINE keys are missing. Run: make setup"
  [ -d node_modules ] || fail "Packages are not installed. Run: make setup"

  if alive server && alive tunnel; then
    ok "Scoop is already running."; cmd_status; return 0
  fi
  local other; other=$(port_pid)
  if [ -n "$other" ] && ! alive server; then
    fail "Port $PORT is already used by another program (PID $other) — probably Scoop started by hand. Close it first with: make stop"
  fi

  step "Starting Scoop"
  start_ollama
  ensure_model
  # Load the model into memory now so the first chat reply isn't slow. num_ctx must match src/agent.ts, or the first reply reloads it.
  curl -s -m 5 "$OLLAMA/api/generate" -d "{\"model\":\"$MODEL\",\"keep_alive\":\"60m\",\"options\":{\"num_ctx\":8192}}" >/dev/null 2>&1 &

  if ! alive server; then
    nohup node src/server.ts > "$LOGS/server.log" 2>&1 &
    echo $! > "$RUN/server.pid"
    for _ in $(seq 1 20); do grep -q "listening" "$LOGS/server.log" 2>/dev/null && break; alive server || break; sleep 1; done
    alive server && grep -q "listening" "$LOGS/server.log" || { tail -20 "$LOGS/server.log"; fail "The bot did not start (details above, full log in $LOGS/server.log)"; }
  fi
  ok "Bot is running on this Mac (port $PORT)"

  rm -f "$RUN/url"
  nohup cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT" > "$LOGS/tunnel.log" 2>&1 &
  echo $! > "$RUN/tunnel.pid"
  local url=""
  for _ in $(seq 1 45); do
    url=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOGS/tunnel.log" | head -1)
    [ -n "$url" ] && break
    alive tunnel || break
    sleep 1
  done
  [ -n "$url" ] || { tail -20 "$LOGS/tunnel.log"; cmd_stop >/dev/null; fail "Could not create the public link (details above). Check the internet connection and run make start again."; }
  echo "$url" > "$RUN/url"
  ok "Public link: $url"

  # Stop the Mac from sleeping while the bot runs (closing the lid still sleeps it).
  nohup caffeinate -dims -w "$(cat "$RUN/server.pid")" >/dev/null 2>&1 &
  echo $! > "$RUN/caffeinate.pid"
  ok "This Mac will stay awake while Scoop runs"

  local webhook="$url/webhook"
  printf '%s' "$webhook" | pbcopy 2>/dev/null
  set_line_webhook "$webhook"
  local connected=$?

  say ""
  say "${green}${bold}Scoop is running.${off}"
  if [ $connected -eq 0 ]; then
    say "Open LINE on your phone and send Scoop a message."
  else
    say "Last step by hand: LINE Developers console → Messaging API tab → Webhook URL → Edit,"
    say "paste ${bold}$webhook${off} (already copied), press Update, then Verify."
  fi
  say "${dim}Keep this Mac plugged in with the lid open. To stop: make stop${off}"
}

stop_pid() {
  local name=$1
  if alive "$name"; then kill "$(cat "$RUN/$name.pid")" 2>/dev/null && ok "Stopped $2"; fi
  rm -f "$RUN/$name.pid"
}

cmd_stop() {
  step "Stopping Scoop"
  stop_pid caffeinate "keep-awake"
  stop_pid tunnel "public link"
  stop_pid server "bot"
  stop_pid ollama "Ollama"
  # Also catch a bot or tunnel for this port that was started by hand in another window.
  local p
  for p in $(pgrep -f "node src/server.ts" 2>/dev/null); do
    lsof -nP -a -p "$p" -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 && kill "$p" 2>/dev/null && ok "Stopped a bot that was started by hand (PID $p)"
  done
  for p in $(pgrep -f "cloudflared tunnel.*localhost:$PORT" 2>/dev/null); do
    kill "$p" 2>/dev/null && ok "Stopped a public link that was started by hand (PID $p)"
  done
  rm -f "$RUN/url"
  ok "Everything is stopped. LINE messages will get no reply until you run make start."
}

cmd_status() {
  step "Scoop status"
  if alive server || [ -n "$(port_pid)" ]; then ok "Bot: running on port $PORT"; else warn "Bot: not running"; fi
  if ollama_up; then ok "AI model service: running ($MODEL)"; else warn "AI model service: not running"; fi
  if alive tunnel && [ -f "$RUN/url" ]; then
    ok "Public link: $(cat "$RUN/url")/webhook"
    local token current; token=$(env_get LINE_CHANNEL_ACCESS_TOKEN)
    current=$(curl -s -m 10 https://api.line.me/v2/bot/channel/webhook/endpoint -H "Authorization: Bearer $token" | grep -oE '"endpoint":"[^"]*"' | cut -d'"' -f4)
    if [ "$current" = "$(cat "$RUN/url")/webhook" ]; then ok "LINE is pointed at this link"
    elif [ -n "$current" ]; then warn "LINE is pointed at a different link: $current  (run make restart)"
    fi
  else
    warn "Public link: none"
  fi
}

cmd_logs() { touch "$LOGS/server.log"; say "${dim}Showing the bot's log. Press Ctrl+C to leave (the bot keeps running).${off}"; tail -n 40 -f "$LOGS/server.log"; }
cmd_chat() { start_ollama; ensure_model; node src/server.ts --try; }
cmd_test() { npm test; }
cmd_menu() { line_keys_set || fail "LINE keys are missing. Run: make setup"; node scripts/richmenu.ts && ok "Bottom menu uploaded to LINE"; }
cmd_reset() {
  alive server && fail "Stop Scoop first: make stop"
  [ -f data/state.json ] || { ok "Nothing to delete — there are no saved users or bookings."; return 0; }
  read -r -p "Delete ALL users and bookings? Type yes to confirm: " answer
  [ "$answer" = yes ] || { say "Cancelled."; return 0; }
  mv data/state.json "data/state.backup-$(date +%Y%m%d-%H%M%S).json" && ok "Cleared (a backup was kept in data/)"
}

case "${1:-help}" in
  setup) cmd_setup ;;
  start) cmd_start ;;
  stop) cmd_stop ;;
  restart) cmd_stop; cmd_start ;;
  status) cmd_status ;;
  logs) cmd_logs ;;
  chat) cmd_chat ;;
  test) cmd_test ;;
  menu) cmd_menu ;;
  reset) cmd_reset ;;
  *) cmd_help ;;
esac
