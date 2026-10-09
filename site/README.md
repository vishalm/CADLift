# CADLift marketing site

One-page, visual-first marketing site for [CADLift](https://github.com/vishalm/CADLift): Next.js 15, React Three Fiber, Framer Motion, Tailwind CSS v4. Fully static.

## Run locally

```bash
cd site
npm install
npm run dev        # http://localhost:3100
npm run build      # production build (static)
```

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/vishalm/CADLift&root-directory=site&project-name=cadlift-site)

Or in the Vercel dashboard: **Add New Project**, import `vishalm/CADLift`, set **Root Directory** to `site`, keep the detected Next.js defaults, deploy. No environment variables are required. Optionally set `NEXT_PUBLIC_SITE_URL` to your production URL for canonical links, sitemap and social cards.

## Edit content

All copy, links and numbers live in [`content/site.ts`](content/site.ts). The demo office model is invented data in [`lib/plan.ts`](lib/plan.ts); no real client drawing is used.

## Real media (Real results and Showreel)

The before/after frames and the film in `public/media/` come from the FloorPlanTo3D project's sample
plans and app captures. Rebuild them with ffmpeg:

```bash
site/scripts/build-media.sh /path/to/FloorPlanTo3D
```

Each plan is scaled so its outer walls land exactly on its 3D render's walls (the wall boxes are
measured in the script), which is what makes the hover wipe line up. The film is a 27 s graded
showreel (MP4 + WebM + poster); its chapter times live in `content/site.ts` under `film.chapters`.

## How the 3D works

- One procedural model ([`components/three/OfficeModel.tsx`](components/three/OfficeModel.tsx)) drives every scene through a few controls: rise, explode, wall height and layer colours.
- [`Canvas3D`](components/three/Canvas3D.tsx) mounts a scene only near the viewport, pauses it off screen, and shows an SVG blueprint when WebGL is missing.
- Scenes are loaded with `next/dynamic` (`ssr: false`), so three.js is not in the first-load bundle.
- Surfaces use procedural canvas textures (`lib/textures.ts`: concrete, plaster, wood grain) and the sun casts soft shadows, so the model reads as real without downloading any assets.
- `prefers-reduced-motion` shows final states with no auto-rotation or scroll animation.
