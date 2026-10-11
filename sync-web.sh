#!/bin/sh
# Copies the current web build of the game into the app bundle folder.
set -e
SRC="${1:-$HOME/Desktop/LaunchAnything}"
DST="$(dirname "$0")/App/Web"
rm -rf "$DST"; mkdir -p "$DST/prism" "$DST/games"
cp "$SRC/prism/index.html" "$DST/prism/"
cp "$SRC/games/arcade.js" "$DST/games/"
echo "web build copied to $DST"
