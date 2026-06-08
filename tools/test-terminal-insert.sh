#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNNER="${ROOT_DIR}/build/history-window/insert-runner.js"
TEST_PIDS=()
TEST_WINDOWS=()

cleanup() {
    local window_id
    local pid
    for window_id in "${TEST_WINDOWS[@]}"; do
        xdotool windowclose "${window_id}" >/dev/null 2>&1 || true
    done
    for pid in "${TEST_PIDS[@]}"; do
        kill "${pid}" >/dev/null 2>&1 || true
    done
    sleep 0.5
}
trap cleanup EXIT

fail() {
    printf '[ERROR] %s\n' "$*" >&2
    exit 1
}

[[ "${XDG_SESSION_TYPE:-}" == "x11" ]] || fail "This smoke test requires an X11 session."
[[ -n "${DISPLAY:-}" ]] || fail "DISPLAY is not set."
command -v gjs >/dev/null || fail "gjs is required."
command -v wmctrl >/dev/null || fail "wmctrl is required."
command -v xdotool >/dev/null || fail "xdotool is required."
[[ -f "${RUNNER}" ]] || fail "Build output missing. Run ./build.sh first."

run_case() {
    local terminal="$1"
    local title="ClipFlow ${terminal} Test $$"
    local result_file
    local window_id_hex=""
    local window_id_dec=""
    local payload='ClipFlow paste test: spaces [] {} $PATH Hebrew שלום'
    local pid
    local received

    result_file="$(mktemp "/tmp/clipflow-${terminal}-result.XXXXXX")"
    rm -f "${result_file}"

    case "${terminal}" in
        kitty)
            kitty --title "${title}" sh -c \
                'IFS= read -r value </dev/tty; printf "%s" "$value" > "$1"; sleep 1' \
                sh "${result_file}" >/dev/null 2>&1 &
            ;;
        gnome-terminal)
            gnome-terminal --wait --title="${title}" -- bash -c \
                'IFS= read -r value </dev/tty; printf "%s" "$value" > "$1"; sleep 1' \
                bash "${result_file}" >/dev/null 2>&1 &
            ;;
        *)
            fail "Unknown terminal test: ${terminal}"
            ;;
    esac
    pid=$!
    TEST_PIDS+=("${pid}")

    for _ in {1..50}; do
        window_id_hex="$(wmctrl -lx | awk -v title="${title}" 'index($0, title) { print $1; exit }')"
        [[ -n "${window_id_hex}" ]] && break
        sleep 0.1
    done
    [[ -n "${window_id_hex}" ]] || fail "${terminal}: test window did not appear."

    window_id_dec="$((window_id_hex))"
    TEST_WINDOWS+=("${window_id_dec}")
    xdotool windowactivate --sync "${window_id_dec}"
    sleep 0.4

    CLIPFLOW_INSERT_B64="$(printf '%s' "${payload}" | base64 -w0)" \
    CLIPFLOW_INSERT_TARGET_WID="${window_id_dec}" \
    CLIPFLOW_INSERT_SUBMIT=1 \
        gjs "${RUNNER}"

    for _ in {1..50}; do
        [[ -f "${result_file}" ]] && break
        sleep 0.1
    done
    [[ -f "${result_file}" ]] || fail "${terminal}: no submitted text received."

    received="$(cat "${result_file}")"
    if [[ "${received}" != "${payload}" ]]; then
        printf '[DEBUG] expected: %q\n' "${payload}" >&2
        printf '[DEBUG] received: %q\n' "${received}" >&2
        printf '[DEBUG] expected bytes: ' >&2
        printf '%s' "${payload}" | od -An -tx1 >&2
        printf '[DEBUG] received bytes: ' >&2
        printf '%s' "${received}" | od -An -tx1 >&2
        fail "${terminal}: pasted text mismatch."
    fi
    printf '[OK] %s terminal insertion\n' "${terminal}"
    rm -f "${result_file}"
}

tested=0
for terminal in kitty gnome-terminal; do
    if command -v "${terminal}" >/dev/null; then
        run_case "${terminal}"
        tested=$((tested + 1))
    fi
done

(( tested > 0 )) || fail "Neither kitty nor gnome-terminal is installed."
printf '[OK] %d terminal integration test(s) passed\n' "${tested}"
