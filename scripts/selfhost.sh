#!/usr/bin/env sh
# La Lista — self-hosted lifecycle helper.
#
#   ./scripts/selfhost.sh bootstrap    first-time setup, end to end
#   ./scripts/selfhost.sh deploy       push convex/ changes + rebuild the web app
#   ./scripts/selfhost.sh push-env     re-sync backend env vars from .env
#   ./scripts/selfhost.sh admin-key    print (and store) the Convex admin key
#   ./scripts/selfhost.sh dashboard    start the Convex admin dashboard
#   ./scripts/selfhost.sh logs [svc]   tail logs
#   ./scripts/selfhost.sh down         stop everything (volumes are kept)
#
# Only Docker is required on the host — Node runs inside the images.

set -eu

ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
ENV_FILE="$ROOT/.env"
EXAMPLE_FILE="$ROOT/.env.selfhost.example"

# Env vars pushed onto the Convex deployment (read by convex/ functions).
BACKEND_ENV_KEYS="CLERK_JWT_ISSUER_DOMAIN VAPID_PRIVATE_KEY VAPID_EMAIL NEXT_PUBLIC_VAPID_PUBLIC_KEY ADMIN_ALLOWLIST_EMAILS"

say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m warn\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31merror\033[0m %s\n' "$*" >&2; exit 1; }

need_docker() {
	command -v docker >/dev/null 2>&1 || die "docker is not installed"
	docker compose version >/dev/null 2>&1 || die "docker compose v2 is required"
	docker info >/dev/null 2>&1 || die "the docker daemon is not running"
}

rand_hex() {
	if command -v openssl >/dev/null 2>&1; then
		openssl rand -hex "$1"
	else
		head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'
	fi
}

# Read a key from .env (empty string when absent). Strips surrounding
# whitespace and ` # trailing comments`, matching how Compose reads the file —
# otherwise a commented-out placeholder reads as a real value.
get_env() {
	[ -f "$ENV_FILE" ] || { printf ''; return; }
	sed -n "s/^$1=//p" "$ENV_FILE" \
		| head -n 1 \
		| sed -e 's/[[:space:]][[:space:]]*#.*$//' \
		      -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

# Write a key into .env, replacing any existing line. ENVIRON avoids every
# quoting pitfall of sed with arbitrary secret values.
set_env() {
	_k=$1; _v=$2
	if [ -f "$ENV_FILE" ] && grep -q "^$_k=" "$ENV_FILE"; then
		_tmp=$(mktemp)
		SH_K="$_k" SH_V="$_v" awk '
			BEGIN { k = ENVIRON["SH_K"]; v = ENVIRON["SH_V"] }
			index($0, k "=") == 1 { print k "=" v; next }
			{ print }
		' "$ENV_FILE" > "$_tmp"
		mv "$_tmp" "$ENV_FILE"
	else
		printf '%s=%s\n' "$_k" "$_v" >> "$ENV_FILE"
	fi
}

require_env() {
	for _k in "$@"; do
		[ -n "$(get_env "$_k")" ] || die "$_k is empty in .env — fill it in, then re-run"
	done
}

ensure_env_file() {
	if [ ! -f "$ENV_FILE" ]; then
		[ -f "$EXAMPLE_FILE" ] || die "missing $EXAMPLE_FILE"
		cp "$EXAMPLE_FILE" "$ENV_FILE"
		say "Created .env from the template."
	fi
	[ -n "$(get_env POSTGRES_PASSWORD)" ] || {
		set_env POSTGRES_PASSWORD "$(rand_hex 24)"
		say "Generated POSTGRES_PASSWORD."
	}
	[ -n "$(get_env CONVEX_INSTANCE_SECRET)" ] || {
		set_env CONVEX_INSTANCE_SECRET "$(rand_hex 32)"
		say "Generated CONVEX_INSTANCE_SECRET."
	}
}

start_backend() {
	say "Starting Postgres and the Convex backend..."
	docker compose up -d --wait postgres convex-backend
}

cmd_admin_key() {
	need_docker
	key=$(docker compose exec -T convex-backend ./generate_admin_key.sh | tr -d '\r' | tail -n 1)
	[ -n "$key" ] || die "could not generate an admin key — check: docker compose logs convex-backend"
	set_env CONVEX_SELF_HOSTED_ADMIN_KEY "$key"
	say "Admin key stored in .env:"
	printf '  %s\n' "$key"
}

cmd_push_env() {
	need_docker
	require_env CONVEX_SELF_HOSTED_ADMIN_KEY
	say "Pushing environment variables onto the Convex deployment..."
	# shellcheck disable=SC2086
	docker compose --profile setup run --rm --build convex-deploy sh -eu -c '
		for k in '"$BACKEND_ENV_KEYS"'; do
			v=$(printenv "$k" 2>/dev/null || true)
			if [ -n "$v" ]; then
				pnpm exec convex env set "$k" "$v" >/dev/null
				echo "  set $k"
			else
				echo "  skip $k (empty)"
			fi
		done
	'
}

cmd_deploy_functions() {
	need_docker
	require_env CONVEX_SELF_HOSTED_ADMIN_KEY
	say "Deploying Convex functions (schema, indexes, crons, HTTP actions)..."
	docker compose --profile setup run --rm --build convex-deploy
}

cmd_web() {
	need_docker
	say "Building and starting the web app..."
	docker compose up -d --build web
}

cmd_bootstrap() {
	need_docker
	ensure_env_file
	require_env NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY CLERK_JWT_ISSUER_DOMAIN
	start_backend
	[ -n "$(get_env CONVEX_SELF_HOSTED_ADMIN_KEY)" ] || cmd_admin_key
	cmd_push_env
	cmd_deploy_functions
	cmd_web
	say "Done."
	printf '\n  App        %s\n' "$(get_env WEB_PORT | sed 's#^#http://localhost:#')"
	printf '  Convex     %s\n' "$(get_env CONVEX_CLOUD_ORIGIN)"
	printf '  HTTP API   %s\n' "$(get_env CONVEX_SITE_ORIGIN)"
	printf '  Dashboard  ./scripts/selfhost.sh dashboard\n\n'
}

cmd_deploy() {
	need_docker
	cmd_deploy_functions
	cmd_web
	say "Deployed."
}

case "${1:-bootstrap}" in
	bootstrap)  cmd_bootstrap ;;
	deploy)     cmd_deploy ;;
	push-env)   cmd_push_env ;;
	admin-key)  cmd_admin_key ;;
	dashboard)  need_docker; docker compose --profile dashboard up -d --wait convex-dashboard
	            say "Dashboard: http://localhost:$(get_env CONVEX_DASHBOARD_PORT)"
	            say "Sign in with the key from: ./scripts/selfhost.sh admin-key" ;;
	logs)       need_docker; shift 2>/dev/null || true; docker compose logs -f "$@" ;;
	down)       need_docker; docker compose --profile dashboard down ;;
	*)          sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
