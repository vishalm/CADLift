#!/usr/bin/env bash
# Builds the site's real-project media from a FloorPlanTo3D checkout:
#   public/media/<pair>-plan.jpg / <pair>-model.jpg   matched 1600x900 frames for the before/after slider
#   public/media/film.mp4 / film.webm / film-poster.jpg   a ~22 s graded showreel of real app captures
#
# Usage: site/scripts/build-media.sh /path/to/FloorPlanTo3D
# Needs ffmpeg with libx264 and libvpx-vp9. Re-run whenever the source images change.
set -euo pipefail

SRC="${1:?usage: build-media.sh /path/to/FloorPlanTo3D}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/media"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

W=1600; H=900          # still frame
VW=1280; VH=720; FPS=30 # film
PAPER='0xF2F1EE'

ff() { ffmpeg -hide_banner -loglevel error -y "$@"; }

# Plan on paper: fit inside the frame with margin.
plan_frame() { # src crop out [extra filters after the crop, e.g. hflip,vflip]
  ff -i "$1" -vf "crop=$2${4:+,$4},scale=$((W*88/100)):$((H*84/100)):force_original_aspect_ratio=decrease:flags=lanczos,pad=$W:$H:(ow-iw)/2:(oh-ih)/2:color=$PAPER" -q:v 3 "$3"
}

# 3D render: fit inside the frame over a blurred, darkened fill of itself (no letterbox bars).
model_frame() { # src crop out [extra filters after the crop]
  ff -i "$1" -filter_complex "[0]crop=$2${4:+,$4},split[a][b];\
[a]scale=$W:$H:force_original_aspect_ratio=increase,crop=$W:$H,gblur=sigma=30,eq=brightness=-0.12:saturation=0.9[bg];\
[b]scale=$((W*92/100)):$((H*88/100)):force_original_aspect_ratio=decrease:flags=lanczos,unsharp=5:5:0.6[fg];\
[bg][fg]overlay=(W-w)/2:(H-h)/2" -q:v 3 "$3"
}

# Crop rectangles (w:h:x:y) measured on the FloorPlanTo3D sample images.
plan_frame  "$SRC/images/example1.png"  873:607:77:44     "$OUT/villa-plan.jpg"
model_frame "$SRC/images/example1.png"  816:408:986:131   "$OUT/villa-model.jpg"
plan_frame  "$SRC/images/example2.png"  894:463:51:155    "$OUT/apartment-plan.jpg"
model_frame "$SRC/images/example2.png"  722:440:1071:205  "$OUT/apartment-model.jpg"
# The sketch was scanned upside down: turn plan and model together so the labels read.
plan_frame  "$SRC/images/handDrawn.png" 947:475:340:63    "$OUT/sketch-plan.jpg"  hflip,vflip
model_frame "$SRC/images/handDrawn.png" 1321:580:175:656  "$OUT/sketch-model.jpg" hflip,vflip

# ---- Film -------------------------------------------------------------------------------
SHOT=3.6   # seconds per shot
FADE=0.7   # crossfade
FRAMES=$(awk "BEGIN{print int($SHOT*$FPS)}")

# One shot: a 16:9 still with a slow camera move (in / out / left), or "down": a top-to-bottom
# pan over a tall still (zoompan keeps the input aspect, so the pan crops a moving 16:9 window).
shot() { # still out move
  local z x y
  if [ "$3" = down ]; then
    ff -loop 1 -t "$SHOT" -i "$1" -vf "fps=$FPS,crop=w=iw:h=iw*9/16:x=0:y='(ih-oh)*t/$SHOT',scale=${VW}:${VH}:flags=lanczos,setsar=1" \
      -frames:v "$FRAMES" -pix_fmt yuv420p -c:v libx264 -crf 14 "$2"
    return
  fi
  case "$3" in
    in)   z="min(1+0.0011*on,1.14)"; x="iw/2-(iw/zoom/2)"; y="ih/2-(ih/zoom/2)" ;;
    out)  z="max(1.14-0.0011*on,1)"; x="iw/2-(iw/zoom/2)"; y="ih/2-(ih/zoom/2)" ;;
    left) z="1.12"; x="(iw-iw/zoom)*(1-on/$FRAMES)"; y="ih/2-(ih/zoom/2)" ;;
  esac
  ff -i "$1" -vf "scale=3840:-2:flags=lanczos,zoompan=z='$z':x='$x':y='$y':d=$FRAMES:s=${VW}x${VH}:fps=$FPS,setsar=1" \
    -frames:v "$FRAMES" -pix_fmt yuv420p -c:v libx264 -crf 14 "$2"
}

# Interior close-ups (crops avoid the app's buttons and sliders) on the blurred-fill frame.
model_frame "$SRC/images/furniture.png" 440:248:250:10  "$TMP/bedroom.jpg"
model_frame "$SRC/images/wall1.png"     600:338:50:0    "$TMP/hall.jpg"
model_frame "$SRC/images/wall2.png"     540:304:160:30  "$TMP/paint.jpg"
# Tall furnished render: keep full width; the "down" move pans top to bottom.
ff -i "$SRC/unnamed (3).png" -vf "crop=1000:1700:44:120,scale=1920:-2:flags=lanczos" -q:v 3 "$TMP/furnished.jpg"

shot "$OUT/sketch-plan.jpg"     "$TMP/s1.mp4" in
shot "$OUT/sketch-model.jpg"    "$TMP/s2.mp4" out
shot "$OUT/villa-plan.jpg"      "$TMP/s3.mp4" in
shot "$OUT/villa-model.jpg"     "$TMP/s4.mp4" left
shot "$TMP/bedroom.jpg"         "$TMP/s5.mp4" in
shot "$TMP/hall.jpg"            "$TMP/s6.mp4" left
shot "$TMP/paint.jpg"           "$TMP/s7.mp4" in
shot "$TMP/furnished.jpg"       "$TMP/s8.mp4" down
shot "$OUT/apartment-model.jpg" "$TMP/s9.mp4" out

# Crossfade chain, then a filmic grade: gentle S-curve, warm mids, vignette, fine grain.
inputs=(); for i in 1 2 3 4 5 6 7 8 9; do inputs+=(-i "$TMP/s$i.mp4"); done
chain=""; prev="[0]"; offset=0
for i in 1 2 3 4 5 6 7 8; do
  offset=$(awk "BEGIN{print $offset+$SHOT-$FADE}")
  chain+="$prev[$i]xfade=transition=fade:duration=$FADE:offset=$offset[x$i];"
  prev="[x$i]"
done
grade="curves=preset=medium_contrast,colorbalance=rm=0.04:bm=-0.03,eq=saturation=1.06,vignette=angle=PI/5,noise=alls=4:allf=t"
ff "${inputs[@]}" -filter_complex "${chain}${prev}${grade},format=yuv420p[v]" -map "[v]" -c:v libx264 -crf 14 "$TMP/graded.mp4"

ff -i "$TMP/graded.mp4" -c:v libx264 -preset slow -crf 26 -profile:v high -movflags +faststart -an "$OUT/film.mp4"
ff -i "$TMP/graded.mp4" -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 -an "$OUT/film.webm"
ff -ss 9 -i "$TMP/graded.mp4" -frames:v 1 -q:v 3 "$OUT/film-poster.jpg"

ls -la "$OUT"
