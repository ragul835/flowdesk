#!/bin/bash

set -euo pipefail

# Error trap
trap 'echo -e "\033[0;31m[ERROR] An error occurred on line $LINENO. Exiting...\033[0m" >&2 && exit 1' ERR

# Colors for better readability
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'
NC=$'\033[0m' # No Color

# Logging functions
log_info() { echo -e "${CYAN}[INFO] $1${NC}"; }
log_warn() { echo -e "${YELLOW}[WARN] $1${NC}"; }
log_error() { echo -e "${RED}[ERROR] $1${NC}" >&2; }
log_success() { echo -e "${GREEN}[SUCCESS] $1${NC}"; }

# ---------------------------------------------------------------------------
# Paths & config
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR"
APP_NAME="flowdesk"
DB_NAME="${DB_NAME:-flowdesk}"

# Database credentials (must match DATABASE_URL in .env)
# Uses the existing 'postgres' superuser over TCP — no sudo required.
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

WEB_PORT="${WEB_PORT:-3000}"   # Next.js
WS_PORT="${WS_PORT:-4000}"     # Socket.io realtime server

WEB_LOG="$APP_DIR/web.log"
WS_LOG="$APP_DIR/realtime.log"
LOG_LINES="${LOG_LINES:-200}"

if ! [[ "$LOG_LINES" =~ ^[1-9][0-9]*$ ]]; then
    log_warn "Invalid LOG_LINES value '$LOG_LINES'; using 200."
    LOG_LINES=200
fi

# SSH / Remote server config (override via env)
SSH_USER="${SSH_USER:-ubuntu}"
SSH_HOST="${SSH_HOST:-your.server.ip}"
SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/id_rsa}"

# ---------------------------------------------------------------------------
# Dependency checks
# ---------------------------------------------------------------------------
check_dependencies() {
    local missing=0
    for cmd in node npm npx; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "$cmd could not be found. Please install it."
            missing=1
        fi
    done
    if [ $missing -eq 1 ]; then
        log_warn "Some dependencies are missing. Exiting."
        exit 1
    fi
}

ensure_env() {
    if [ ! -f "$APP_DIR/.env" ] && [ -f "$APP_DIR/.env.example" ]; then
        log_warn "No .env found. Creating one from .env.example..."
        cp "$APP_DIR/.env.example" "$APP_DIR/.env"
        log_success ".env created. Review it before deploying to production."
    fi
}

# Helper to pause
pause() {
    echo ""
    read -p "Press Enter to continue..."
}

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
install_deps() {
    log_info "Installing dependencies..."
    cd "$APP_DIR" || exit 1
    npm install
    log_success "Dependencies installed."
}

build_app() {
    ensure_env
    log_info "Building FlowDesk (next build)..."
    cd "$APP_DIR" || exit 1
    npm run build
    log_success "Build complete."
}

# ---------------------------------------------------------------------------
# Database (system PostgreSQL)
# ---------------------------------------------------------------------------
start_db() {
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
        log_success "PostgreSQL is already running on $DB_HOST:$DB_PORT."
        return 0
    fi
    log_info "Starting PostgreSQL (system service)..."
    if command -v systemctl &> /dev/null; then
        sudo systemctl start postgresql && log_success "PostgreSQL started." && return 0
    fi
    log_error "Could not start PostgreSQL automatically. Start it manually, then retry."
    return 1
}

stop_db() {
    log_info "Stopping PostgreSQL (system service)..."
    command -v systemctl &> /dev/null && sudo systemctl stop postgresql || true
}

# Create the application database (idempotent). Connects as the 'postgres'
# superuser over TCP using DB_PASS — no sudo required.
configure_db() {
    log_info "Ensuring database '$DB_NAME' exists (as '$DB_USER' on $DB_HOST:$DB_PORT)..."
    local url="postgresql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/postgres"

    if PGPASSWORD="$DB_PASS" psql "$url" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null | grep -q 1; then
        log_info "Database '$DB_NAME' already exists."
    else
        PGPASSWORD="$DB_PASS" createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" \
            && log_success "Created database '$DB_NAME'." \
            || { log_error "Could not create '$DB_NAME'. Check that the '$DB_USER' password is '$DB_PASS'."; return 1; }
    fi
}

setup_db() {
    ensure_env
    log_info "Pushing Prisma schema to the database ($DB_NAME)..."
    cd "$APP_DIR" || exit 1
    npm run db:push
    log_success "Schema applied."
}

seed_db() {
    ensure_env
    log_info "Seeding database ($DB_NAME) with sample data..."
    cd "$APP_DIR" || exit 1
    npm run db:seed
    log_success "Seed complete."
}

reset_db() {
    log_warn "This will DROP and recreate all tables, then re-seed."
    read -p "Type 'yes' to continue: " confirm
    [ "$confirm" = "yes" ] || { log_info "Cancelled."; return 0; }
    cd "$APP_DIR" || exit 1
    npm run db:reset
    log_success "Database reset and re-seeded."
}

studio_db() {
    log_info "Opening Prisma Studio..."
    cd "$APP_DIR" || exit 1
    npm run db:studio
}

# ---------------------------------------------------------------------------
# Port helpers
# ---------------------------------------------------------------------------
free_port() {
    local port="$1"
    if fuser "$port/tcp" >/dev/null 2>&1; then
        log_warn "Port $port is occupied; stopping its process..."
        fuser -k "$port/tcp" >/dev/null 2>&1 || true
        sleep 1
    fi
}

verify_ports_free() {
    local occupied=0
    for port in "$WEB_PORT" "$WS_PORT"; do
        if fuser "$port/tcp" >/dev/null 2>&1; then
            log_error "Port $port is already in use."
            lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
            occupied=1
        fi
    done
    [ "$occupied" -eq 0 ]
}

wait_for_port() {
    local name="$1" pid="$2" port="$3" attempts=20 attempt
    for ((attempt = 1; attempt <= attempts; attempt++)); do
        if ! kill -0 "$pid" 2>/dev/null; then
            log_error "$name exited before opening port $port."
            return 1
        fi
        if fuser "$port/tcp" >/dev/null 2>&1; then
            log_success "$name is listening on port $port."
            return 0
        fi
        sleep 1
    done
    log_error "$name did not open port $port in ${attempts}s."
    return 1
}

# ---------------------------------------------------------------------------
# Run (nohup)
# ---------------------------------------------------------------------------
start_dev() {
    ensure_env
    log_info "Starting FlowDesk in DEV mode (web :$WEB_PORT + realtime :$WS_PORT)..."
    cd "$APP_DIR" || exit 1
    npm run dev
}

start_prod_nohup() {
    ensure_env
    if [ ! -d "$APP_DIR/.next" ]; then
        log_warn "No build found (.next missing). Building now..."
        build_app
    fi
    log_info "Checking ports before startup..."
    stop_prod_nohup
    verify_ports_free || { log_error "Free the ports first (option 7)."; return 1; }

    log_info "Starting realtime server (nohup) on :$WS_PORT..."
    cd "$APP_DIR" || exit 1
    printf '\n===== Realtime start: %s =====\n' "$(date --iso-8601=seconds)" >> "$WS_LOG"
    nohup env WS_PORT="$WS_PORT" npm run dev:ws >> "$WS_LOG" 2>&1 &
    local ws_pid=$!

    log_info "Starting Next.js (nohup) on :$WEB_PORT..."
    printf '\n===== Web start: %s =====\n' "$(date --iso-8601=seconds)" >> "$WEB_LOG"
    nohup env PORT="$WEB_PORT" npm run start:web >> "$WEB_LOG" 2>&1 &
    local web_pid=$!

    if ! wait_for_port "Realtime" "$ws_pid" "$WS_PORT"; then
        tail -n 50 "$WS_LOG" >&2; stop_prod_nohup; return 1
    fi
    if ! wait_for_port "Web" "$web_pid" "$WEB_PORT"; then
        tail -n 50 "$WEB_LOG" >&2; stop_prod_nohup; return 1
    fi
    log_success "FlowDesk is running (web PID $web_pid, realtime PID $ws_pid)."
    log_info "Open http://localhost:$WEB_PORT"
}

stop_prod_nohup() {
    log_info "Stopping FlowDesk services on ports $WEB_PORT and $WS_PORT..."
    free_port "$WEB_PORT"
    free_port "$WS_PORT"
    log_success "Services stopped."
}

status_nohup() {
    echo "Service status (ports $WEB_PORT and $WS_PORT):"
    lsof -i :"$WEB_PORT" 2>/dev/null || echo "  web: not running"
    lsof -i :"$WS_PORT" 2>/dev/null || echo "  realtime: not running"
}

# ---------------------------------------------------------------------------
# Run (PM2 — survives SSH disconnect)
# ---------------------------------------------------------------------------
start_prod_pm2() {
    command -v pm2 &> /dev/null || { log_error "pm2 not installed. Run: npm i -g pm2"; return 1; }
    ensure_env
    if [ ! -d "$APP_DIR/.next" ]; then build_app; fi
    stop_prod_pm2
    stop_prod_nohup

    cd "$APP_DIR" || exit 1
    log_info "Starting realtime (PM2)..."
    WS_PORT="$WS_PORT" pm2 start npm --name "${APP_NAME}-realtime" --update-env -- run dev:ws
    log_info "Starting web (PM2)..."
    PORT="$WEB_PORT" pm2 start npm --name "${APP_NAME}-web" --update-env -- run start:web
    sleep 2
    pm2 save
    pm2 status
    log_success "PM2 services online and saved."
}

stop_prod_pm2() {
    command -v pm2 &> /dev/null || return 0
    log_info "Stopping PM2 services..."
    pm2 delete "${APP_NAME}-web" 2>/dev/null || true
    pm2 delete "${APP_NAME}-realtime" 2>/dev/null || true
}

status_pm2() { command -v pm2 &> /dev/null && pm2 status || log_warn "pm2 not installed."; }

# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------
tail_logs() {
    local -a files=()
    for f in "$WS_LOG" "$WEB_LOG"; do
        [ -f "$f" ] && files+=("$f") || log_warn "Log not found yet: $f"
    done
    if [ "${#files[@]}" -eq 0 ]; then
        log_error "No logs found. Start the services first (option 6)."
        return 0
    fi
    log_info "Showing last $LOG_LINES lines, then following. Ctrl+C to return."
    tail -n "$LOG_LINES" -F "${files[@]}" || true
}

# ---------------------------------------------------------------------------
# SSH
# ---------------------------------------------------------------------------
ssh_connect() {
    local key="$SSH_KEY"
    if [ ! -f "$key" ]; then
        log_warn "SSH key not found at: $key"
        read -p "Enter path to your SSH private key: " key
        key="${key/#\~/$HOME}"
        [ -f "$key" ] || { log_error "Key file not found: $key"; return 1; }
    fi
    chmod 600 "$key" 2>/dev/null || true
    log_info "Connecting to ${SSH_USER}@${SSH_HOST}..."
    ssh -i "$key" -o StrictHostKeyChecking=accept-new "${SSH_USER}@${SSH_HOST}"
}

# ---------------------------------------------------------------------------
# Menu
# ---------------------------------------------------------------------------
show_menu() {
    clear
    echo -e "${CYAN}======================================================================${NC}"
    echo -e "${GREEN}                    FlowDesk — Management Menu                         ${NC}"
    echo -e "${CYAN}======================================================================${NC}"

    echo -e "${YELLOW}Sec A: Setup & Build:${NC}"
    echo "  1. Install dependencies (npm install)"
    echo "  2. Build app (next build)"
    echo "  3. First-time setup (install → db start → configure → push → seed)"
    echo ""

    echo -e "${YELLOW}Sec B: Database (system PostgreSQL):${NC}"
    echo " 10. Start PostgreSQL (system service)"
    echo " 11. Stop PostgreSQL (system service)"
    echo " 12. Configure DB (create database '$DB_NAME' — no sudo)"
    echo " 13. Setup Database (prisma db push)"
    echo " 14. Seed Database (sample data)"
    echo " 15. Reset Database (drop + push + seed)"
    echo " 16. Open Prisma Studio"
    echo ""

    echo -e "${YELLOW}Sec C: Run Services:${NC}"
    echo "  5. Start DEV (web + realtime, live reload)"
    echo "  6. Start PROD — nohup (web :$WEB_PORT + realtime :$WS_PORT)"
    echo "  6a. Quick: Build → Start (nohup)"
    echo "  7. Stop Services (nohup)"
    echo "  8. Service Status (nohup)"
    echo "  9. Start PROD — PM2 (persistent)"
    echo " 9a. Quick PM2: Build → Start"
    echo " 10b. Stop Services (PM2)"
    echo " 11b. Service Status (PM2)"
    echo ""

    echo -e "${YELLOW}Sec D: Monitoring & Logs:${NC}"
    echo "100. Disk Space Usage"
    echo "101. RAM Usage (top processes)"
    echo "103. Tail Service Logs (nohup)"
    echo ""

    echo -e "${YELLOW}Sec S: SSH:${NC}"
    echo "200. SSH into Remote Server (${SSH_USER}@${SSH_HOST})"
    echo ""

    echo -e "${RED}  0. Exit${NC}"
    echo -e "${CYAN}======================================================================${NC}"
}

check_dependencies

while true; do
    show_menu
    read -p "Enter your choice: " choice
    echo ""
    case $choice in
        1)   install_deps; pause ;;
        2)   build_app; pause ;;
        3)
            install_deps
            start_db
            configure_db
            setup_db
            seed_db
            log_success "First-time setup complete. Start with option 5 (dev) or 6 (prod)."
            pause
            ;;
        10)  start_db; pause ;;
        11)  stop_db; pause ;;
        12)  configure_db; pause ;;
        13)  setup_db; pause ;;
        14)  seed_db; pause ;;
        15)  reset_db; pause ;;
        16)  studio_db; pause ;;
        5)   start_dev ;;
        6)   start_prod_nohup; pause ;;
        6a)  build_app; start_prod_nohup; pause ;;
        7)   stop_prod_nohup; pause ;;
        8)   status_nohup; pause ;;
        9)   start_prod_pm2; pause ;;
        9a)  build_app; start_prod_pm2; pause ;;
        10b) stop_prod_pm2; pause ;;
        11b) status_pm2; pause ;;
        100) echo "Disk Space Usage:"; df -h; pause ;;
        101) echo "RAM Usage:"; free -h; echo ""; ps aux --sort=-%mem | head -n 10; pause ;;
        103) tail_logs; pause ;;
        200) ssh_connect; pause ;;
        0)   echo "Exiting..."; exit 0 ;;
        *)   log_error "Invalid choice. Please select a valid option."; pause ;;
    esac
done
