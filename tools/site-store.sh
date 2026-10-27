#!/usr/bin/env bash
# The site-store branch holds everything GitHub Pages serves: the live site in main/ and each
# branch preview in preview/<slug>/. Every deploy assembles the site from it, so a deploy never
# drops a preview, and a preview never drops the live site.
#
#   tools/site-store.sh put <path> <dir>   replace <path> (main or preview/<slug>) with <dir>
#   tools/site-store.sh rm <path>          remove <path>
#   tools/site-store.sh assemble <out>     write the site to serve into <out>
#
# The branch keeps one commit (each change replaces it), so it doesn't grow with every push.
# Changes retry when another job pushed first.
set -euo pipefail

BRANCH=site-store
cmd=${1:?usage: site-store.sh put|rm|assemble ...}
gitdir=$(git rev-parse --absolute-git-dir)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

fetch() {
  rm -rf "$work/tree" && mkdir -p "$work/tree"
  if git fetch -q --depth=1 origin "+$BRANCH:refs/remotes/origin/$BRANCH" 2>/dev/null; then
    base=$(git rev-parse "refs/remotes/origin/$BRANCH")
    git archive "$base" | tar -x -C "$work/tree"
  else
    base=''
  fi
}

case "$cmd" in
  put | rm)
    path=${2:?a path: main or preview/<slug>}
    [[ "$path" =~ ^(main|preview/[a-z0-9][a-z0-9-]*)$ ]] || { echo "bad path: $path" >&2; exit 1; }
    if [ "$cmd" = put ]; then src=$(cd "${3:?a directory}" && pwd); fi
    for attempt in 1 2 3 4 5 6 7 8; do
      fetch
      rm -rf "${work:?}/tree/$path"
      if [ "$cmd" = put ]; then mkdir -p "$work/tree/$path" && cp -a "$src/." "$work/tree/$path/"; fi
      export GIT_INDEX_FILE="$work/index"
      rm -f "$GIT_INDEX_FILE"
      git --git-dir="$gitdir" --work-tree="$work/tree" -C "$work/tree" add -A .
      tree=$(git --git-dir="$gitdir" write-tree)
      unset GIT_INDEX_FILE
      commit=$(git -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
        commit-tree "$tree" -m "$cmd $path (${GITHUB_SHA:-local})")
      if git push -q --force-with-lease="refs/heads/$BRANCH:$base" origin "$commit:refs/heads/$BRANCH"; then
        echo "site-store: $cmd $path"
        exit 0
      fi
      echo "site-store: another job pushed first; retrying ($attempt)" >&2
      sleep $((attempt * 3))
    done
    echo "site-store: gave up after 8 attempts" >&2
    exit 1
    ;;
  assemble)
    out=${2:?an output directory}
    fetch
    if [ ! -f "$work/tree/main/index.html" ]; then
      echo "site-store: no live site in $BRANCH yet; nothing to deploy" >&2
      exit 1
    fi
    rm -rf "$out" && mkdir -p "$out"
    cp -a "$work/tree/main/." "$out/"
    if [ -d "$work/tree/preview" ]; then mkdir -p "$out/preview" && cp -a "$work/tree/preview/." "$out/preview/"; fi
    echo "site-store: assembled the live site and $(find "$out/preview" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l) preview(s)"
    ;;
  *)
    echo "unknown command: $cmd" >&2
    exit 1
    ;;
esac
