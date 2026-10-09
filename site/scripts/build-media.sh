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

# Matched plan / 3D frames for the before/after slider. The render is scaled uniformly so its outer
# walls fill FILL of the frame; the plan gets its own x and y scale so its outer walls land on exactly
# the same box (the app's Scale X / Z sliders stretch captures, so the two never share an aspect).
FILL=0.8
calc() { awk "BEGIN{printf \"%.4f\", $1}"; }

pair() { # name src plan_crop plan_walls model_crop model_walls [extra filters after crop]
  local name=$1 src=$2 pc=$3 pw=$4 mc=$5 mw=$6 extra=${7:-}
  local px0 py0 px1 py1 mx0 my0 mx1 my1
  IFS=, read -r px0 py0 px1 py1 <<<"$pw"
  IFS=, read -r mx0 my0 mx1 my1 <<<"$mw"
  local s sx sy mox moy pox poy
  s=$(calc "($FILL*$W/($mx1-$mx0) < $FILL*$H/($my1-$my0)) ? $FILL*$W/($mx1-$mx0) : $FILL*$H/($my1-$my0)")
  mox=$(calc "$W/2 - $s*($mx0+$mx1)/2"); moy=$(calc "$H/2 - $s*($my0+$my1)/2")
  sx=$(calc "$s*($mx1-$mx0)/($px1-$px0)"); sy=$(calc "$s*($my1-$my0)/($py1-$py0)")
  pox=$(calc "$W/2 - $sx*($px0+$px1)/2"); poy=$(calc "$H/2 - $sy*($py0+$py1)/2")

  ff -i "$src" -filter_complex "color=c=$PAPER:s=${W}x${H}[bg];\
[0]crop=$pc${extra:+,$extra},scale=iw*$sx:ih*$sy:flags=lanczos[p];[bg][p]overlay=$pox:$poy" -frames:v 1 -q:v 3 "$OUT/$name-plan.jpg"

  ff -i "$src" -filter_complex "[0]crop=$mc${extra:+,$extra},split[a][b];\
[a]scale=$W:$H:force_original_aspect_ratio=increase,crop=$W:$H,gblur=sigma=30,eq=brightness=-0.12:saturation=0.9[bg];\
[b]scale=iw*$s:ih*$s:flags=lanczos,unsharp=5:5:0.6[fg];[bg][fg]overlay=$mox:$moy" -frames:v 1 -q:v 3 "$OUT/$name-model.jpg"
}

# 3D render on its own (film shots): fit inside the frame over a blurred, darkened fill of itself.
model_frame() { # src crop out
  ff -i "$1" -filter_complex "[0]crop=$2,split[a][b];\
[a]scale=$W:$H:force_original_aspect_ratio=increase,crop=$W:$H,gblur=sigma=30,eq=brightness=-0.12:saturation=0.9[bg];\
[b]scale=$((W*92/100)):$((H*88/100)):force_original_aspect_ratio=decrease:flags=lanczos,unsharp=5:5:0.6[fg];\
[bg][fg]overlay=(W-w)/2:(H-h)/2" -q:v 3 "$3"
}

# Crops (w:h:x:y) on the FloorPlanTo3D sample images; wall boxes (x0,y0,x1,y1) are the outer walls
# inside each crop, measured by hand. The sketch was scanned upside down: plan and model turn together.
pair villa     "$SRC/images/example1.png"  873:607:77:44   31,69,833,459   816:408:986:131   186,41,752,388
pair apartment "$SRC/images/example2.png"  894:463:51:155  121,13,837,437  722:440:1071:205  72,21,686,385
pair sketch    "$SRC/images/handDrawn.png" 947:475:340:63  11,9,936,467    1321:580:175:656  141,47,1217,525  hflip,vflip

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
