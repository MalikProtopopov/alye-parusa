#!/usr/bin/env bash
# Prepares web media assets from materials/seedance-output.
# Idempotent: safe to re-run. Requires ffmpeg on PATH.
#
#   morph C1..C5 ─concat→ morph-full.mp4 ─┬─ frames/ (scroll-scrub image sequence)
#                                         ├─ poster.jpg (first frame)
#                                         └─ morph-hero.mp4 (compressed reduced-motion fallback)
#   flythroughs F1..F3 ─copy→ f1..f3.mp4 + f1..f3.jpg posters
#   renders *.png ─convert→ optimized .jpg
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"          # web/
SRC="$(cd "$ROOT/.." && pwd)/materials"                          # ../materials
OUT="$ROOT/public/media"
MORPH="$SRC/seedance-output/morph-construction"
FLY="$SRC/seedance-output/flythroughs"
RENDERS="$SRC/renders"

FPS="${HERO_FPS:-6}"          # 6 fps over ~25s morph ≈ 150 frames
FRAME_W="${HERO_WIDTH:-1280}" # scrub frame width
FRAME_Q="${HERO_Q:-6}"        # jpeg quality (2=best/heavy … 31=worst); 6 ≈ good/web-weight
CACHE="$ROOT/.media-cache"    # intermediates that must NOT ship in /public
MORPH_FULL="$CACHE/morph-full.mp4"

log() { printf '\033[36m▸ %s\033[0m\n' "$*"; }

mkdir -p "$OUT/hero/frames" "$OUT/flythroughs" "$OUT/renders" "$CACHE"

# ── 1. Concatenate morph C1..C5 (same codec/res → stream copy) ────────────────
log "Concatenating morph C1..C5"
CONCAT_LIST="$(mktemp)"
for c in C1-empty-to-foundations C2-foundations-to-frames C3-frames-to-finished-day C4-day-to-sunset C5-sunset-to-night; do
  printf "file '%s/%s.mp4'\n" "$MORPH" "$c" >> "$CONCAT_LIST"
done
ffmpeg -y -f concat -safe 0 -i "$CONCAT_LIST" -an -c copy "$MORPH_FULL"
rm -f "$CONCAT_LIST"

# ── 2. Scrub frame sequence ───────────────────────────────────────────────────
log "Extracting scrub frames (fps=$FPS, width=$FRAME_W, q=$FRAME_Q)"
rm -f "$OUT/hero/frames/"*.jpg
ffmpeg -y -i "$MORPH_FULL" \
  -vf "fps=$FPS,scale=$FRAME_W:-2:flags=lanczos" -q:v "$FRAME_Q" \
  "$OUT/hero/frames/frame-%03d.jpg"

FRAME_COUNT=$(find "$OUT/hero/frames" -name 'frame-*.jpg' | wc -l | tr -d ' ')
read -r W H < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$OUT/hero/frames/frame-001.jpg" | tr ',' ' ')
cat > "$OUT/hero/frames/manifest.json" <<JSON
{ "count": $FRAME_COUNT, "pattern": "/media/hero/frames/frame-%03d.jpg", "width": $W, "height": $H, "pad": 3 }
JSON
log "Frames: $FRAME_COUNT @ ${W}x${H}"

# ── 3. Poster (first frame) + reduced-motion fallback video ───────────────────
log "Poster + fallback video"
ffmpeg -y -i "$MORPH_FULL" -vframes 1 -q:v 2 "$OUT/hero/poster.jpg"
ffmpeg -y -i "$MORPH_FULL" \
  -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart -an \
  "$OUT/hero/morph-hero.mp4"

# ── 4. Flythroughs (copy + poster) ────────────────────────────────────────────
log "Flythroughs"
declare -a FLYS=(
  "F1-aerial-to-waterfront-1080p:f1-aerial-to-waterfront"
  "F2-commercial-to-aerial-beachfront-720p:f2-commercial-to-beachfront"
  "F3-waterfront-to-aerial-beachfront-1080p:f3-waterfront-to-beachfront"
)
for pair in "${FLYS[@]}"; do
  in="${pair%%:*}"; out="${pair##*:}"
  cp -f "$FLY/$in.mp4" "$OUT/flythroughs/$out.mp4"
  ffmpeg -y -i "$FLY/$in.mp4" -vframes 1 -q:v 3 "$OUT/flythroughs/$out.jpg"
done

# ── 5. Renders (PNG → optimized JPG, max 1920w) ───────────────────────────────
log "Renders → optimized jpg"
for f in "$RENDERS"/render-0*-day-*.png; do
  [ -e "$f" ] || continue
  base="$(basename "${f%.png}")"
  # render-07-day-aerial-panorama → aerial-panorama
  slug="$(echo "$base" | sed -E 's/^render-[0-9]+-day-//')"
  ffmpeg -y -i "$f" -vf "scale='min(1920,iw)':-2:flags=lanczos" -q:v 3 "$OUT/renders/$slug.jpg"
done

# ── 6. Scroll-story background (a fly-through scrubbed by scroll) ─────────────
STORY_SRC="$FLY/F1-aerial-to-waterfront-1080p.mp4"
if [ -f "$STORY_SRC" ]; then
  log "Scroll-story → frames + poster"
  mkdir -p "$OUT/story/frames"
  rm -f "$OUT/story/frames/"*.jpg
  ffmpeg -y -i "$STORY_SRC" \
    -vf "fps=24,scale=$FRAME_W:-2:flags=lanczos" -q:v "$FRAME_Q" \
    "$OUT/story/frames/frame-%03d.jpg"
  STORY_COUNT=$(find "$OUT/story/frames" -name 'frame-*.jpg' | wc -l | tr -d ' ')
  read -r SW SH < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$OUT/story/frames/frame-001.jpg" | tr ',' ' ')
  cat > "$OUT/story/frames/manifest.json" <<JSON
{ "count": $STORY_COUNT, "pattern": "/media/story/frames/frame-%03d.jpg", "width": $SW, "height": $SH, "pad": 3 }
JSON
  ffmpeg -y -i "$STORY_SRC" -vframes 1 -q:v 2 "$OUT/story/poster.jpg"
  log "Scroll-story: $STORY_COUNT frames @ ${SW}x${SH}"
fi

log "DONE. Media prepared in $OUT"
find "$OUT" -type f | sort
