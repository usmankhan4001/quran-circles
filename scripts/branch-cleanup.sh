#!/usr/bin/env bash
# Inventory of branches against origin/main, and a guarded cleanup of the merged ones.
#
#   scripts/branch-cleanup.sh             list only (default, changes nothing)
#   scripts/branch-cleanup.sh --delete    print the merged branches and delete them one confirmed
#                                         batch at a time (local branches, then remote branches)
#
# Categories:
#   merged     tip is already contained in origin/main: safe to delete
#   unmerged   has commits that are not in origin/main: never deleted by this script
#   protected  main, integration/*, the branch you are on, anything checked out in a live worktree,
#              and the active lanes listed in ACTIVE_REGEX below
#
# Squash-merged branches look "unmerged" here because their commits differ from the squash commit.
# Check those by hand (git diff origin/main...<branch> --stat) before deleting them yourself.
set -euo pipefail

BASE="${BASE:-origin/main}"
PROTECTED_REGEX='^(main|master|integration/.*|release-now)$'
# Lanes that are being worked on right now. Update this list (or pass ACTIVE_REGEX) as lanes change.
ACTIVE_REGEX="${ACTIVE_REGEX:-^(lane/ui/design-fidelity|lane/auth/email-otp|lane/repo/.*)$}"
delete=false
[[ "${1:-}" == "--delete" ]] && delete=true

git fetch origin --prune --quiet || echo "warning: could not fetch; using the refs you already have" >&2
git rev-parse --verify --quiet "$BASE" >/dev/null || { echo "$BASE not found" >&2; exit 1; }

current="$(git rev-parse --abbrev-ref HEAD)"
# Branches checked out in a worktree that still exists (stale, prunable worktrees do not count).
worktree_branches="$(git worktree list --porcelain | awk -v RS= -F'\n' '
  !/\nprunable/ { for (i = 1; i <= NF; i++) if ($i ~ /^branch refs\/heads\//) { sub("^branch refs/heads/", "", $i); print $i } }')"

classify() { # $1 = short name, $2 = full ref name
  local short="$1" ref="$2"
  if [[ "$short" =~ $PROTECTED_REGEX || "$short" =~ $ACTIVE_REGEX ]]; then
    echo protected
  elif [[ "$ref" == refs/heads/* ]] && { [[ "$short" == "$current" ]] || grep -qx "$short" <<<"$worktree_branches"; }; then
    echo protected
  elif git merge-base --is-ancestor "$ref" "$BASE" || ! git cherry "$BASE" "$ref" | grep -q '^+'; then
    # Contained in main, or every commit has an equivalent patch in main (rebased or cherry-picked).
    echo merged
  else
    echo unmerged
  fi
}

printf '%-10s %-11s %-6s %s\n' STATUS LAST-COMMIT AHEAD BRANCH
local_merged=(); remote_merged=()
while read -r ref; do
  short="${ref#refs/heads/}"
  status="$(classify "$short" "$ref")"
  ahead="$(git rev-list --count "$BASE..$ref")"
  printf '%-10s %-11s %-6s %s\n' "$status" "$(git log -1 --format=%cs "$ref")" "$ahead" "local:$short"
  [[ "$status" == merged ]] && local_merged+=("$short")
done < <(git for-each-ref --format='%(refname)' refs/heads)

while read -r ref; do
  short="${ref#refs/remotes/origin/}"
  [[ "$short" == "HEAD" ]] && continue
  status="$(classify "$short" "$ref")"
  [[ "$short" == "${BASE#origin/}" ]] && status=protected
  ahead="$(git rev-list --count "$BASE..$ref")"
  printf '%-10s %-11s %-6s %s\n' "$status" "$(git log -1 --format=%cs "$ref")" "$ahead" "origin:$short"
  [[ "$status" == merged ]] && remote_merged+=("$short")
done < <(git for-each-ref --format='%(refname)' refs/remotes/origin)

echo
echo "merged local branches:  ${#local_merged[@]}"
echo "merged remote branches: ${#remote_merged[@]}"
$delete || { echo "List only. Re-run with --delete to remove the merged branches after confirming."; exit 0; }

confirm() {
  read -r -p "$1 [type 'yes' to continue] " answer
  [[ "$answer" == yes ]]
}

if ((${#local_merged[@]})) && confirm "Delete ${#local_merged[@]} merged LOCAL branches?"; then
  for b in "${local_merged[@]}"; do git branch -d "$b"; done
fi
if ((${#remote_merged[@]})) && confirm "Delete ${#remote_merged[@]} merged REMOTE branches on origin? This cannot be undone from here."; then
  for b in "${remote_merged[@]}"; do git push origin --delete "$b"; done
fi
