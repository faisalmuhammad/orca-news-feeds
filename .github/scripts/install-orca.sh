#!/usr/bin/env bash
set -euo pipefail

# Official Orca 1.4.255 archives and their GitHub SHA-256 digests.
# Keep the version, filenames and digests together when updating the CLI.
case "$(uname -m)" in
  arm64)
    orca_asset=Orca-1.4.255-arm64-mac.zip
    orca_sha=c92b90b92bbe5ce1130765757f24309be6ee61a3246b2785bfb8a6aedea04214
    ;;
  x86_64)
    orca_asset=Orca-1.4.255-mac.zip
    orca_sha=1888f0e6419ed987028fcd5580f55d69494420c7c6ada1993043c2bc878c0892
    ;;
  *)
    echo 'The pinned Orca CLI installer requires a macOS arm64 or x86_64 runner.' >&2
    exit 1
    ;;
esac

orca_dir="${RUNNER_TEMP:?}/feeds-orca-cli"
mkdir -p "$orca_dir"
orca_archive="$orca_dir/$orca_asset"
curl --fail --location --retry 3 \
  --output "$orca_archive" \
  "https://github.com/stablyai/orca/releases/download/v1.4.255/$orca_asset"
printf '%s  %s\n' "$orca_sha" "$orca_archive" | shasum -a 256 --check
ditto -x -k "$orca_archive" "$orca_dir"
orca_bin="$orca_dir/Orca.app/Contents/Resources/bin"
test -x "$orca_bin/orca"
printf '%s\n' "$orca_bin" >> "${GITHUB_PATH:?}"
