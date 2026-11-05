#!/bin/sh
# Copies the current web build of the game into the app bundle folder.
set -e
SRC="${1:-$HOME/Desktop/Oyunlar/LaunchAnything}"
DST="$(dirname "$0")/App/Web"
rm -rf "$DST"; mkdir -p "$DST/prism" "$DST/games"
cp "$SRC/prism/index.html" "$SRC/prism/three.min.js" "$SRC/prism/mini.js" "$SRC/prism/story.js" "$DST/prism/"   # mini.js: the side games; story.js: boss comics, the chest
mkdir -p "$DST/prism/anim"; cp "$SRC"/prism/anim/*.webp "$SRC"/prism/anim/*.js "$DST/prism/anim/"   # Pogo's hand-keyed animation sheets
cp "$SRC/games/arcade.js" "$DST/games/"
echo "web build copied to $DST"
