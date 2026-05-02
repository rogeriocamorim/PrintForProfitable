#!/bin/bash

# PrintForProfitable Production Deployment Script
# Deploys to Orange Pi / Docker host at 192.168.2.13
# Smart deployment: only deploys changed components

set -e  # Exit on error

# ── Timing ─────────────────────────────────────────────────────────────────
DEPLOY_START_TIME=$(date +%s)
STEP_START_TIME=$DEPLOY_START_TIME
declare -a STEP_NAMES=()
declare -a STEP_DURATIONS=()

format_duration() {
    local seconds=$1
    if [ $seconds -lt 60 ]; then
        echo "${seconds}s"
    else
        local minutes=$((seconds / 60))
        local secs=$((seconds % 60))
        echo "${minutes}m ${secs}s"
    fi
}

start_timer() { STEP_START_TIME=$(date +%s); }

show_step_time() {
    local step_name="${1:-Step}"
    local step_end=$(date +%s)
    local duration=$((step_end - STEP_START_TIME))
    STEP_NAMES+=("$step_name")
    STEP_DURATIONS+=($duration)
    echo "   [timer] $step_name completed in $(format_duration $duration)"
}

show_total_time() {
    local total_end=$(date +%s)
    local duration=$((total_end - DEPLOY_START_TIME))
    echo ""
    echo "================================================="
    echo "              DEPLOYMENT SUMMARY"
    echo "================================================="
    for i in "${!STEP_NAMES[@]}"; do
        printf "   %-32s %8s\n" "${STEP_NAMES[$i]}" "$(format_duration ${STEP_DURATIONS[$i]})"
    done
    echo "   -------------------------------------------------"
    printf "   %-32s %8s\n" "TOTAL TIME" "$(format_duration $duration)"
    echo ""
    echo "================================================="
}

# ── Configuration ──────────────────────────────────────────────────────────
if [ -f ".env.deploy" ]; then
    echo "[config] Loading configuration from .env.deploy"
    export $(grep -v '^#' .env.deploy | xargs)
else
    echo "[warn] .env.deploy not found. Using defaults / environment values."
fi

REMOTE_HOST="${REMOTE_HOST:-192.168.2.13}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_PASSWORD="${REMOTE_PASSWORD:-}"
REMOTE_DIR="${REMOTE_DIR:-/opt/printforprofitable}"
APP_NAME="printforprofitable"

# ── SSH key discovery ──────────────────────────────────────────────────────
find_ssh_key() {
    local keys=(
        "$HOME/.ssh/id_rsa_printforprofitable"
        "$HOME/.ssh/id_rsa_orangepi"
        "$HOME/.ssh/id_ed25519_personal"
        "$HOME/.ssh/id_ed25519"
        "$HOME/.ssh/id_rsa"
    )
    for key in "${keys[@]}"; do
        if [ -f "$key" ]; then echo "$key"; return 0; fi
    done
    return 1
}

SSH_KEY=$(find_ssh_key) || SSH_KEY=""

if [ -z "$REMOTE_PASSWORD" ] && [ -z "$SSH_KEY" ]; then
    echo "[error] No SSH authentication configured!"
    echo "   Either:"
    echo "   1. Set REMOTE_PASSWORD in .env.deploy"
    echo "   2. Create an SSH key and copy it to the server:"
    echo "      ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519"
    echo "      ssh-copy-id -i ~/.ssh/id_ed25519 $REMOTE_USER@$REMOTE_HOST"
    exit 1
fi

[ -n "$SSH_KEY" ] && echo "[auth] Using SSH key: $SSH_KEY"

# ── Change detection ───────────────────────────────────────────────────────
detect_changes() {
    local LAST_DEPLOY_FILE=".last-deploy"
    local CHANGED_FILES=""

    if [ -f "$LAST_DEPLOY_FILE" ]; then
        LAST_COMMIT=$(cat "$LAST_DEPLOY_FILE")
        if git rev-parse "$LAST_COMMIT" > /dev/null 2>&1; then
            CHANGED_FILES=$(git diff --name-only "$LAST_COMMIT" HEAD 2>/dev/null || echo "")
        fi
    fi

    if [ -z "$CHANGED_FILES" ]; then
        CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null || echo "")
        CHANGED_FILES="$CHANGED_FILES"$'\n'$(git diff --name-only --cached 2>/dev/null || echo "")
        CHANGED_FILES="$CHANGED_FILES"$'\n'$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")
    fi

    UNCOMMITTED=$(git status --porcelain 2>/dev/null | awk '{print $2}' || echo "")
    CHANGED_FILES="$CHANGED_FILES"$'\n'"$UNCOMMITTED"
    echo "$CHANGED_FILES"
}

# ── Determine what to deploy ───────────────────────────────────────────────
DEPLOY_BACKEND=false
DEPLOY_FRONTEND=false

echo ""
echo "================================================="
echo " PrintForProfitable Smart Deployment"
echo "================================================="
echo ""

case "${1:-}" in
    --all|-a)
        echo "[mode] Force deploying ALL services"
        DEPLOY_BACKEND=true; DEPLOY_FRONTEND=true ;;
    --backend|-b)
        echo "[mode] Force deploying BACKEND only"
        DEPLOY_BACKEND=true ;;
    --frontend|-f)
        echo "[mode] Force deploying FRONTEND only"
        DEPLOY_FRONTEND=true ;;
    --status|-s)
        echo "[status] Checking deployment status..."
        SSH_OPT="-o StrictHostKeyChecking=no"
        [ -n "$SSH_KEY" ] && SSH_OPT="-i $SSH_KEY $SSH_OPT"
        ssh $SSH_OPT "$REMOTE_USER@$REMOTE_HOST" "
            cd $REMOTE_DIR 2>/dev/null || { echo '[error] Not deployed yet'; exit 1; }
            DC=\$(docker compose version > /dev/null 2>&1 && echo 'docker compose' || echo 'docker-compose')
            echo ''
            echo 'Container status:'
            \$DC ps
            echo ''
            echo 'Recent logs (last 20 lines):'
            \$DC logs --tail=20
        "
        exit 0 ;;
    --logs|-l)
        echo "[logs] Streaming live logs..."
        SSH_OPT="-o StrictHostKeyChecking=no"
        [ -n "$SSH_KEY" ] && SSH_OPT="-i $SSH_KEY $SSH_OPT"
        ssh $SSH_OPT "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && (docker compose version > /dev/null 2>&1 && docker compose logs -f || docker-compose logs -f)"
        exit 0 ;;
    --stop)
        echo "[stop] Stopping containers..."
        SSH_OPT="-o StrictHostKeyChecking=no"
        [ -n "$SSH_KEY" ] && SSH_OPT="-i $SSH_KEY $SSH_OPT"
        ssh $SSH_OPT "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && (docker compose version > /dev/null 2>&1 && docker compose down || docker-compose down)"
        echo "[ok] Containers stopped"
        exit 0 ;;
    --restart)
        echo "[restart] Restarting containers..."
        SSH_OPT="-o StrictHostKeyChecking=no"
        [ -n "$SSH_KEY" ] && SSH_OPT="-i $SSH_KEY $SSH_OPT"
        ssh $SSH_OPT "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && (docker compose version > /dev/null 2>&1 && docker compose restart || docker-compose restart)"
        echo "[ok] Containers restarted"
        exit 0 ;;
    --help|-h)
        echo "PrintForProfitable Deployment Script"
        echo ""
        echo "Usage: ./deploy.sh [option]"
        echo ""
        echo "Options:"
        echo "  (no option)     Auto-detect changes and deploy"
        echo "  --all, -a       Deploy everything (backend + frontend)"
        echo "  --backend, -b   Deploy backend only"
        echo "  --frontend, -f  Deploy frontend only"
        echo "  --status, -s    Show container status and recent logs"
        echo "  --logs, -l      Stream live logs"
        echo "  --stop          Stop all containers"
        echo "  --restart       Restart all containers"
        echo "  --help, -h      Show this help"
        exit 0 ;;
    "")
        echo "[detect] Detecting changes..."
        CHANGED=$(detect_changes)

        if echo "$CHANGED" | grep -q "^backend/"; then
            DEPLOY_BACKEND=true
            echo "   [changed] Backend changes detected"
        fi
        if echo "$CHANGED" | grep -q "^frontend/"; then
            DEPLOY_FRONTEND=true
            echo "   [changed] Frontend changes detected"
        fi
        if echo "$CHANGED" | grep -q "docker-compose"; then
            DEPLOY_BACKEND=true; DEPLOY_FRONTEND=true
            echo "   [changed] docker-compose changed — deploying both"
        fi ;;
    *)
        echo "[error] Unknown option: $1  (use --help for usage)"
        exit 1 ;;
esac

# If nothing detected, prompt
if [ "$DEPLOY_BACKEND" = false ] && [ "$DEPLOY_FRONTEND" = false ]; then
    echo ""
    echo "[warn] No changes detected. What would you like to deploy?"
    echo "   1) Frontend only"
    echo "   2) Backend only"
    echo "   3) Both"
    echo "   4) Cancel"
    read -p "Select option [1-4]: " choice
    case $choice in
        1) DEPLOY_FRONTEND=true ;;
        2) DEPLOY_BACKEND=true ;;
        3) DEPLOY_BACKEND=true; DEPLOY_FRONTEND=true ;;
        4) echo "Deployment cancelled."; exit 0 ;;
        *) echo "[error] Invalid option. Cancelled."; exit 1 ;;
    esac
fi

echo ""
echo "Deployment plan:"
[ "$DEPLOY_BACKEND"  = true ] && echo "   + Backend"
[ "$DEPLOY_FRONTEND" = true ] && echo "   + Frontend"
echo ""
echo "Remote host : $REMOTE_HOST"
echo "Remote dir  : $REMOTE_DIR"
echo ""

# ── SSH / SCP commands ─────────────────────────────────────────────────────
if [ -n "$SSH_KEY" ]; then
    echo "[auth] SSH key: $SSH_KEY"
    SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no"
    SCP_CMD="scp -i $SSH_KEY -o StrictHostKeyChecking=no"
elif command -v sshpass &> /dev/null && [ -n "$REMOTE_PASSWORD" ]; then
    echo "[auth] sshpass password authentication"
    SSH_CMD="sshpass -p '$REMOTE_PASSWORD' ssh -o StrictHostKeyChecking=no"
    SCP_CMD="sshpass -p '$REMOTE_PASSWORD' scp -o StrictHostKeyChecking=no"
else
    echo "[warn] No SSH key and no sshpass — you will be prompted for password."
    SSH_CMD="ssh -o StrictHostKeyChecking=no"
    SCP_CMD="scp -o StrictHostKeyChecking=no"
fi

# ── Step 1: Build local package ────────────────────────────────────────────
echo ""
echo "Step 1: Creating deployment package..."
start_timer

DEPLOY_DIR="deploy-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEPLOY_DIR"

cp docker-compose.yml "$DEPLOY_DIR/docker-compose.yml"

if [ -f ".env.deploy" ]; then
    cp .env.deploy "$DEPLOY_DIR/.env"
    echo "   [ok] Environment configuration included"
fi

if [ "$DEPLOY_BACKEND" = true ]; then
    mkdir -p "$DEPLOY_DIR/backend"
    tar -cf - -C backend \
        --exclude='node_modules' \
        --exclude='dist' \
        --exclude='src/generated' \
        . | tar -xf - -C "$DEPLOY_DIR/backend"
    echo "   [ok] Backend files added (node_modules, dist, generated excluded)"
fi

if [ "$DEPLOY_FRONTEND" = true ]; then
    mkdir -p "$DEPLOY_DIR/frontend"
    tar -cf - -C frontend \
        --exclude='node_modules' \
        --exclude='dist' \
        . | tar -xf - -C "$DEPLOY_DIR/frontend"
    echo "   [ok] Frontend files added (node_modules, dist excluded)"
fi

echo "$DEPLOY_BACKEND"  > "$DEPLOY_DIR/.deploy-backend"
echo "$DEPLOY_FRONTEND" > "$DEPLOY_DIR/.deploy-frontend"

# Cross-platform tar
if [[ "$OSTYPE" == "darwin"* ]]; then
    COPYFILE_DISABLE=1 tar -czf printforprofitable-deploy.tar.gz -C "$DEPLOY_DIR" .
else
    tar -czf printforprofitable-deploy.tar.gz -C "$DEPLOY_DIR" .
fi
rm -rf "$DEPLOY_DIR"

echo "[ok] Package created: printforprofitable-deploy.tar.gz"
show_step_time "Package creation"

# ── Step 2: Upload ─────────────────────────────────────────────────────────
echo ""
echo "Step 2: Uploading to $REMOTE_HOST..."
start_timer
eval "$SCP_CMD printforprofitable-deploy.tar.gz $REMOTE_USER@$REMOTE_HOST:/tmp/"
echo "[ok] Upload complete"
show_step_time "Upload"

# ── Step 3: Remote deployment ──────────────────────────────────────────────
echo ""
echo "Step 3: Deploying on remote server..."
start_timer

eval "$SSH_CMD $REMOTE_USER@$REMOTE_HOST" << 'ENDSSH'
    set -e

    format_time() {
        local s=$1
        [ $s -lt 60 ] && echo "${s}s" && return
        echo "$((s/60))m $((s%60))s"
    }

    REMOTE_START=$(date +%s)

    # ── Prepare directories ──
    mkdir -p /opt/printforprofitable
    cd /opt/printforprofitable

    TEMP="/tmp/pfp-deploy-temp"
    rm -rf "$TEMP"
    mkdir -p "$TEMP"
    tar -xzf /tmp/printforprofitable-deploy.tar.gz -C "$TEMP"
    rm /tmp/printforprofitable-deploy.tar.gz

    DEPLOY_BACKEND=$(cat "$TEMP/.deploy-backend")
    DEPLOY_FRONTEND=$(cat "$TEMP/.deploy-frontend")

    echo ""
    echo "[plan] Remote deployment:"
    [ "$DEPLOY_BACKEND"  = "true" ] && echo "   + Backend"
    [ "$DEPLOY_FRONTEND" = "true" ] && echo "   + Frontend"
    echo ""

    # Always update docker-compose
    cp "$TEMP/docker-compose.yml" /opt/printforprofitable/docker-compose.yml

    if [ -f "$TEMP/.env" ]; then
        cp "$TEMP/.env" /opt/printforprofitable/.env
        echo "   [ok] .env updated"
    fi

    # ── Backend ──
    if [ "$DEPLOY_BACKEND" = "true" ]; then
        echo "[deploy] Backend..."
        if [ -d "backend" ]; then
            BKDIR="backup-backend-$(date +%Y%m%d-%H%M%S)"
            mkdir -p "$BKDIR" && mv backend "$BKDIR/"
            echo "   [ok] Old backend backed up -> $BKDIR"
        fi
        mv "$TEMP/backend" /opt/printforprofitable/
        echo "   [ok] New backend in place"
    fi

    # ── Frontend ──
    if [ "$DEPLOY_FRONTEND" = "true" ]; then
        echo "[deploy] Frontend..."
        if [ -d "frontend" ]; then
            FKDIR="backup-frontend-$(date +%Y%m%d-%H%M%S)"
            mkdir -p "$FKDIR" && mv frontend "$FKDIR/"
            echo "   [ok] Old frontend backed up -> $FKDIR"
        fi
        mv "$TEMP/frontend" /opt/printforprofitable/
        echo "   [ok] New frontend in place"
    fi

    rm -rf "$TEMP"

    # ── Docker build & start ──
    # Note: prisma generate + migrate deploy run inside the Docker build/CMD

    # Support both docker compose (v2 plugin) and docker-compose (v1 standalone)
    if docker compose version > /dev/null 2>&1; then
        DC="docker compose"
    else
        DC="docker-compose"
    fi
    echo "[docker] Using: $DC"

    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1

    BUILD_START=$(date +%s)

    if [ "$DEPLOY_BACKEND" = "true" ] && [ "$DEPLOY_FRONTEND" = "true" ]; then
        echo ""
        echo "[docker] Stopping all containers..."
        $DC down || true
        echo "[docker] Building all images..."
        $DC build
        echo "   [ok] Build done in $(format_time $(($(date +%s) - BUILD_START)))"
        echo "[docker] Starting containers..."
        $DC up -d

    elif [ "$DEPLOY_BACKEND" = "true" ]; then
        $DC stop backend || true
        $DC rm -f backend || true
        echo "[docker] Building backend image..."
        $DC build backend
        echo "   [ok] Build done in $(format_time $(($(date +%s) - BUILD_START)))"
        $DC up -d backend

    elif [ "$DEPLOY_FRONTEND" = "true" ]; then
        $DC stop frontend || true
        $DC rm -f frontend || true
        echo "[docker] Building frontend image..."
        $DC build frontend
        echo "   [ok] Build done in $(format_time $(($(date +%s) - BUILD_START)))"
        $DC up -d frontend
    fi

    # ── Cleanup old backups (keep last 3) ──
    echo ""
    echo "[cleanup] Removing old backups..."
    ls -dt backup-backend-*  2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
    ls -dt backup-frontend-* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true

    echo ""
    echo "[ok] Deployment complete! Took $(format_time $(($(date +%s) - REMOTE_START)))"
    echo ""
    echo "Container status:"
    $DC ps

    echo ""
    echo "Recent logs (last 20 lines):"
    $DC logs --tail=20
ENDSSH

show_step_time "Remote deployment"

# Save deploy marker
git rev-parse HEAD > .last-deploy 2>/dev/null || true

# Cleanup local package
rm -f printforprofitable-deploy.tar.gz

echo ""
echo "[done] Deployment finished!"
show_total_time
echo ""
echo "Application URLs:"
echo "   Frontend : http://$REMOTE_HOST"
echo "   Backend  : http://$REMOTE_HOST:3001/api"
echo "   DB port  : $REMOTE_HOST:5432  (postgres / pfp)"
echo ""
echo "Usage:"
echo "   ./deploy.sh              # auto-detect changes"
echo "   ./deploy.sh --all        # full re-deploy"
echo "   ./deploy.sh --frontend   # frontend only"
echo "   ./deploy.sh --backend    # backend only"
echo "   ./deploy.sh --status     # container status"
echo "   ./deploy.sh --logs       # live logs"
echo "   ./deploy.sh --stop       # stop containers"
echo "   ./deploy.sh --restart    # restart containers"
echo ""
echo "Done!"
