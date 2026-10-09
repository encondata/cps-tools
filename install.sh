#!/usr/bin/env bash
#
# CPS2 Tools installer
#
# Builds the CPS2 Tools Docker image from this project and runs it as a
# container. Re-run it to update: the app is rebuilt and the Library database
# (in <install dir>/data) is kept.
#
#   ./install.sh                      interactive (asks for folder and port)
#   ./install.sh -y                   use the defaults, no questions
#   ./install.sh -d /srv/cps2 -p 9000 -y
#   ./install.sh --repo https://github.com/<you>/cps2-tools.git
#                                     download the code instead of using this folder
#   ./install.sh --uninstall          remove the container and image (asks about data)
#
# Layout of the install folder:
#   <dir>/app    the code the image is built from
#   <dir>/data   library.db (the Library); mounted into the container at /data

set -euo pipefail

APP_NAME="CPS2 Tools"
CONTAINER="cps2-tools"
IMAGE="cps2-tools:latest"
DEFAULT_DIR="/mnt/user/cps2xml"
DEFAULT_PORT="8734"
CONTAINER_PORT="8080"
APP_UID=1000            # the "node" user the container runs as
BRANCH="main"

INSTALL_DIR=""
PORT=""
REPO=""
ASSUME_YES=0
UNINSTALL=0

# ------------------------------------------------------------------ helpers --

if [[ -t 1 ]]; then
  BOLD=$'\e[1m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RED=$'\e[31m'; RESET=$'\e[0m'
else
  BOLD=""; GREEN=""; YELLOW=""; RED=""; RESET=""
fi
info() { printf '%s==>%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '%sWarning:%s %s\n' "$YELLOW" "$RESET" "$*" >&2; }
die()  { printf '%sError:%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  cat <<EOF
Options:
  -d, --dir DIR      install folder (default: $DEFAULT_DIR)
  -p, --port PORT    port to open the web page on (default: $DEFAULT_PORT)
  -r, --repo URL     git repository to download the code from
  -b, --branch NAME  branch to download with --repo (default: $BRANCH)
  -y, --yes          don't ask questions; use defaults / given options
      --uninstall    remove the container and image
  -h, --help         show this help
EOF
}

# Ask a question with a default; returns the default when not interactive.
ask() {
  local prompt=$1 default=$2 reply
  if (( ASSUME_YES )) || [[ ! -t 0 ]]; then
    printf '%s\n' "$default"
    return
  fi
  read -r -p "$prompt [$default]: " reply
  printf '%s\n' "${reply:-$default}"
}

confirm() {
  local prompt=$1 reply
  if (( ASSUME_YES )) || [[ ! -t 0 ]]; then return 0; fi
  read -r -p "$prompt [Y/n]: " reply
  [[ -z $reply || $reply =~ ^[Yy] ]]
}

port_in_use() {
  # Bash's /dev/tcp needs no extra tools (works on Unraid's minimal userland).
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

host_ip() {
  local ip=""
  ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit }}') || true
  [[ -z $ip ]] && ip=$(hostname -I 2>/dev/null | awk '{print $1}') || true
  printf '%s\n' "${ip:-localhost}"
}

http_ok() {
  local url=$1
  if command -v curl >/dev/null 2>&1; then curl -fsS -m 3 "$url" >/dev/null 2>&1
  elif command -v wget >/dev/null 2>&1; then wget -q -T 3 -O /dev/null "$url"
  else return 1
  fi
}

# ------------------------------------------------------------------ options --

while (( $# )); do
  case $1 in
    -d|--dir)    INSTALL_DIR=${2:?--dir needs a value}; shift 2 ;;
    -p|--port)   PORT=${2:?--port needs a value}; shift 2 ;;
    -r|--repo)   REPO=${2:?--repo needs a value}; shift 2 ;;
    -b|--branch) BRANCH=${2:?--branch needs a value}; shift 2 ;;
    -y|--yes)    ASSUME_YES=1; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    -h|--help)   usage; exit 0 ;;
    *)           usage >&2; die "Unknown option: $1" ;;
  esac
done

command -v docker >/dev/null 2>&1 || die "Docker is not installed (on Unraid, enable it under Settings > Docker)."
docker info >/dev/null 2>&1 || die "Can't talk to Docker. Is it running, and are you root (or in the docker group)?"

# ---------------------------------------------------------------- uninstall --

if (( UNINSTALL )); then
  INSTALL_DIR=${INSTALL_DIR:-$(ask "Install folder" "$DEFAULT_DIR")}
  info "Removing container $CONTAINER and image $IMAGE"
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker rmi "$IMAGE" >/dev/null 2>&1 || true
  if [[ -d $INSTALL_DIR ]]; then
    if (( ! ASSUME_YES )) && [[ -t 0 ]]; then
      read -r -p "Also delete $INSTALL_DIR, including the Library database? [y/N]: " reply
      if [[ $reply =~ ^[Yy] ]]; then rm -rf -- "$INSTALL_DIR"; info "Deleted $INSTALL_DIR"; fi
    else
      info "Kept $INSTALL_DIR (Library data in $INSTALL_DIR/data)"
    fi
  fi
  info "$APP_NAME uninstalled."
  exit 0
fi

# ------------------------------------------------------------------ install --

printf '\n%s%s installer%s\n\n' "$BOLD" "$APP_NAME" "$RESET"

INSTALL_DIR=${INSTALL_DIR:-$(ask "Install folder" "$DEFAULT_DIR")}
PORT=${PORT:-$(ask "Web port" "$DEFAULT_PORT")}

[[ $INSTALL_DIR == /* ]] || die "Install folder must be an absolute path: $INSTALL_DIR"
INSTALL_DIR=${INSTALL_DIR%/}
[[ $PORT =~ ^[0-9]+$ ]] && (( PORT >= 1 && PORT <= 65535 )) || die "Port must be a number from 1 to 65535: $PORT"

APP_DIR="$INSTALL_DIR/app"
DATA_DIR="$INSTALL_DIR/data"
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

printf '  Install folder: %s\n  Web port:       %s\n  Library data:   %s\n\n' "$INSTALL_DIR" "$PORT" "$DATA_DIR"
confirm "Continue?" || die "Cancelled."

mkdir -p "$INSTALL_DIR" "$DATA_DIR"

# 1. Get the code into <dir>/app -------------------------------------------
STAGE="$INSTALL_DIR/.app.new"
rm -rf -- "$STAGE"

if [[ -n $REPO ]]; then
  info "Downloading $REPO ($BRANCH)"
  if command -v git >/dev/null 2>&1; then
    git clone --quiet --depth 1 --branch "$BRANCH" "$REPO" "$STAGE" || die "git clone failed."
    rm -rf -- "$STAGE/.git"
  else
    # No git (e.g. stock Unraid): fetch a GitHub tarball instead.
    command -v curl >/dev/null 2>&1 || die "Need git or curl to download the code."
    url=${REPO%.git}
    [[ $url == https://github.com/* ]] || die "Without git, --repo must be a https://github.com/... URL."
    mkdir -p "$STAGE"
    curl -fsSL "$url/archive/refs/heads/$BRANCH.tar.gz" | tar -xz -C "$STAGE" --strip-components=1 \
      || die "Download failed (a private repository needs git with credentials)."
  fi
elif [[ -f $SCRIPT_DIR/Dockerfile && -d $SCRIPT_DIR/server && -d $SCRIPT_DIR/public ]]; then
  if [[ $(cd "$SCRIPT_DIR" && pwd -P) == $(mkdir -p "$APP_DIR" && cd "$APP_DIR" && pwd -P) ]]; then
    info "Using the code already in $APP_DIR"
    STAGE=""
  else
    info "Copying the code from $SCRIPT_DIR"
    mkdir -p "$STAGE"
    for item in Dockerfile .dockerignore docker-compose.yml README.md install.sh server public; do
      [[ -e $SCRIPT_DIR/$item ]] && cp -R -- "$SCRIPT_DIR/$item" "$STAGE/"
    done
  fi
else
  die "Run this script from the project folder, or pass --repo <git url>."
fi

if [[ -n $STAGE ]]; then
  [[ -f $STAGE/Dockerfile && -f $STAGE/server/server.js ]] || die "The downloaded code doesn't look like $APP_NAME."
  rm -rf -- "$APP_DIR"
  mv -- "$STAGE" "$APP_DIR"
fi

# 2. Data folder must be writable by the container's "node" user -------------
if (( EUID == 0 )); then
  chown -R "$APP_UID:$APP_UID" "$DATA_DIR"
else
  chmod 777 "$DATA_DIR" 2>/dev/null || warn "Couldn't make $DATA_DIR writable; the Library may fail to save."
fi

# 3. Build the image ----------------------------------------------------------
info "Building the Docker image (this takes a minute the first time)"
docker build --pull -t "$IMAGE" "$APP_DIR" || die "docker build failed."

# 4. Replace the container ----------------------------------------------------
if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
  info "Replacing the existing $CONTAINER container (Library data is kept)"
  docker rm -f "$CONTAINER" >/dev/null
fi
# Older installs used this name.
docker rm -f cps2-zone-editor >/dev/null 2>&1 || true

if port_in_use "$PORT"; then
  die "Port $PORT is already in use. Re-run with --port <another port>."
fi

info "Starting $CONTAINER on port $PORT"
docker run -d \
  --name "$CONTAINER" \
  --restart unless-stopped \
  -p "$PORT:$CONTAINER_PORT" \
  -v "$DATA_DIR:/data" \
  --label "net.unraid.docker.webui=http://[IP]:[PORT:$PORT]/" \
  "$IMAGE" >/dev/null || die "docker run failed."

# 5. Wait until it answers ----------------------------------------------------
printf 'Waiting for %s to start' "$APP_NAME"
ok=0
for _ in $(seq 1 30); do
  if http_ok "http://127.0.0.1:$PORT/api/health"; then ok=1; break; fi
  printf '.'
  sleep 1
done
echo

if (( ! ok )); then
  warn "$APP_NAME didn't answer on port $PORT yet. Recent container logs:"
  docker logs --tail 30 "$CONTAINER" >&2 || true
  exit 1
fi

# Remove the previous build's image layers now that the new one is running.
docker image prune -f >/dev/null 2>&1 || true

cat <<EOF

${GREEN}${BOLD}$APP_NAME is running.${RESET}

  Open:          http://$(host_ip):$PORT/
  Library data:  $DATA_DIR/library.db   (back this file up)
  Update:        re-run $APP_DIR/install.sh (or with --repo to pull new code)
  Logs:          docker logs -f $CONTAINER
  Uninstall:     $APP_DIR/install.sh --uninstall

EOF
