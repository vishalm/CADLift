# Build prompt: CADLift marketing website

Copy everything below the line into your AI site builder (Claude, v0, Lovable, Cursor, Bolt) or hand it to a developer.

---

## Role and goal

You are a senior creative developer. Build a one-page marketing website for **CADLift**, an open-source tool that turns 2D floor plans and CAD drawings into 3D models you can walk through and restyle by chatting with AI.

The site must feel like a premium product launch: **visual first, very little text**. Every section should *show* the capability with 3D, motion or a graphic, and use one short line of copy at most. Target: a visitor understands what CADLift does within 5 seconds, without reading.

Deploy target: **Vercel**, zero configuration.

## Product facts (use only these, do not invent features)

| Capability | What it does | Status |
|---|---|---|
| PDF plan to 3D | Upload a vector PDF floor plan; walls, furniture and columns are extruded into a 3D model in about 5 seconds | Shipping |
| Drawing colours kept | Every shape keeps its colour from the drawing and is grouped into named layers | Shipping |
| AI chat editing | "Make all furniture warm oak", "floor dark grey concrete", "hide the red solids": the model rebuilds in about 10 seconds; every change is a version with undo | Shipping (Azure OpenAI) |
| Walk-through viewer | Full-screen browser viewer: orbit, plus W A S D fly mode | Shipping |
| DXF / DWG to 3D | CAD files extruded to 3D | Shipping |
| Image and text prompt to 3D | Photo, sketch or prompt to a 3D model | Shipping (AI / GPU) |
| Export | GLB, STEP, DXF, STL for Blender, Unity, Unreal, SolidWorks, Fusion 360, AutoCAD, 3D printing | Shipping |
| Open source | MIT licence, self-hostable, FastAPI + React | Shipping |

Numbers you may use: "about 5 seconds" to convert a plan, "about 10 seconds" per chat edit, "4 export formats", "MIT licensed". Do not claim customer counts, accuracy percentages, or awards.

Links: GitHub `https://github.com/vishalm/CADLift`. Creator: Vishal Mishra (`https://github.com/vishalm`).

## Tech stack (required)

- **Next.js 15 (App Router) + TypeScript**, deployable to Vercel with no config. Use static rendering for every page.
- **Tailwind CSS v4** for styling.
- **React Three Fiber + @react-three/drei** for all 3D. Lazy-load the 3D canvas with `next/dynamic` (`ssr: false`) so the page paints before WebGL loads.
- **Framer Motion** for scroll and entrance animation. Optionally use **Lenis** for smooth scrolling.
- Fonts with `next/font` (self-hosted, no external requests): a geometric display face (e.g. *Space Grotesk* or *Sora*) and *Inter* for body.
- No UI kit, no icon library. **All icons are hand-written inline SVG** (24px grid, 1.75px stroke, `currentColor`).

## Hard rules

1. **No emoji anywhere** (copy, buttons, alt text, metadata).
2. **No em-dashes or en-dashes.** Use a hyphen, colon, comma or middle dot `·`.
3. **Copy budget:** each section has at most one headline (max 6 words) and one supporting line (max 14 words). No paragraphs anywhere on the page.
4. **All copy lives in one file**, `content/site.ts`, so it can be edited or translated without touching components.
5. **Accessibility:** WCAG AA contrast, keyboard reachable controls, visible focus rings, `alt` on every image, and `prefers-reduced-motion` turns off auto-rotation, parallax and scroll animation.
6. **Performance:** Lighthouse 90+ on mobile. Total JS on first load under 250 KB before the 3D chunk. Use Draco-compressed GLB, cap the canvas at `dpr={[1, 2]}`, pause rendering when the canvas is off screen (`frameloop="demand"` plus an intersection observer).
7. **Fallbacks:** if WebGL is unavailable, show a pre-rendered poster image (WebP) for every 3D scene.

## Visual direction

- **Mood:** architectural, calm, precise. Think Apple product page meets architecture studio.
- **Palette:** near-black background `#0B0D10`, off-white text `#F2F1EE`, blueprint cyan accent `#3DD6F5`, warm oak secondary `#C79A6D`, soft grey surfaces `#16191E`. Light sections may invert to off-white backgrounds.
- **Signature motif:** thin cyan blueprint lines that *draw themselves* (SVG `stroke-dashoffset`) and then extrude into 3D. Reuse this motif as the visual thread across sections.
- **Texture:** subtle blueprint grid in the background (CSS gradient, 1px lines at 4% opacity). Soft film grain overlay at 3% opacity.
- **3D look:** soft studio lighting (`<Environment preset="city" />`), contact shadows, slight ambient occlusion, matte materials. Camera moves are slow and eased, never jerky.

## Page structure (scroll story)

### 1. Hero: "From plan to place."
- Full-viewport React Three Fiber scene. A flat cyan **2D floor plan** lies on a dark plane; on load, the walls **rise out of the drawing** over about 2 seconds (animate each mesh's `scale.y` from 0 to 1 with a stagger), furniture pops up, colours fade in.
- Camera starts top-down, then eases into a 3/4 perspective. Gentle idle auto-orbit; drag to rotate.
- Overlay: headline, one supporting line ("Turn any 2D floor plan into a 3D space you can walk through."), two buttons: **Try it** (primary, cyan) and **Star on GitHub** (ghost, with GitHub SVG mark).
- Small scroll cue at the bottom (animated SVG chevron).

### 2. The transformation: "Flat to 3D in 5 seconds."
- **Scroll-scrubbed** sequence pinned to the viewport (Framer Motion `useScroll`): a PDF page icon morphs into blueprint lines, the lines extrude into walls, colours apply, and a timer counter ticks from 0.0 s to 5.0 s.
- Three tiny labels appear along the way: *Upload*, *Extrude*, *Explore*.

### 3. Chat to restyle: "Just say it."
- Split screen. Left: a minimal chat UI that **types out** three prompts one after another:
  1. "Make all furniture warm oak"
  2. "Floor dark grey concrete"
  3. "Walls off-white, 2.8m tall"
- Right: the same 3D model **re-colours and re-shapes live** in sync with each message (tween material colours and wall heights). After the third message, show an **Undo** pill that rewinds the model.
- Loop automatically; pause on hover.

### 4. Walk through it: "Step inside."
- A cinematic first-person camera fly-through of the office model (pre-scripted camera path with `CatmullRomCurve3`), shown in a wide letterboxed frame.
- Floating keyboard graphic with the **W A S D** keys lighting up in sync with the camera movement.

### 5. Every input: "Any drawing. Any idea."
- Bento grid of 4 animated tiles, each a mini visual, no paragraphs:
  - **PDF plan:** blueprint lines drawing themselves.
  - **DXF / DWG:** CAD layers sliding apart in isometric view.
  - **Image:** a sketch photo morphing into a low-poly mesh.
  - **Text prompt:** a typed prompt "a coffee mug, 90mm" turning into a rotating 3D mug.
- Tiles tilt slightly toward the cursor (3D card tilt, max 6 degrees).

### 6. Layers and colour: "Every layer, yours."
- Exploded isometric view of the model: floor, walls, furniture and solids separate vertically on scroll, each with a colour swatch label (for example "Furniture · oak", "Walls · off-white"). Re-stack on scroll back.

### 7. Export anywhere: "Take it everywhere."
- A central 3D model with 4 orbiting format chips (**GLB, STEP, DXF, STL**). Each chip connects with an animated curved line to a destination logo-style SVG badge: Blender, Unity, Unreal, SolidWorks, Fusion 360, AutoCAD, 3D printer. Use neutral monochrome SVG marks, not trademark logos.

### 8. Under the hood (data viz): "Built to be fast."
- Three animated graphics (count up when in view, with SVG charts, no chart library needed):
  - **Radial gauge:** "about 5 s" plan to 3D.
  - **Horizontal bar race:** pipeline stages (Parse, Crop, Extrude, Colour, Export) with relative durations.
  - **Sankey-style flow:** inputs (PDF, DXF, DWG, Image, Prompt) flowing into outputs (GLB, STEP, DXF, STL).
- Small caption: "Measured on a 104 m office floor plate."

### 9. Open source: "Free. Open. Yours."
- Large animated GitHub star button, MIT licence badge, a terminal card that types out the quick start:
  ```
  git clone https://github.com/vishalm/CADLift
  cd CADLift/backend && pip install -e .
  uvicorn app.main:app --reload
  ```
  with a copy button (SVG icon, shows a "Copied" toast).

### 10. Final CTA and footer
- Full-bleed hero callback: the model from section 1 slowly rotating at dusk lighting. Headline "Lift your plans." and the two buttons again.
- Minimal footer: GitHub, Docs, "Created by Vishal Mishra", MIT licence. No newsletter form.

## 3D assets

- Create `/public/models/office.glb`: a stylised office floor (about 20 x 12 m) with walls, desks, meeting rooms, plants and a reception. Low poly, under 1.5 MB with Draco compression. If no asset is supplied, build it procedurally in code from a simple JSON floor plan (rooms as rectangles, desks as boxes) so the site works with zero external files.
- Do **not** use any real client drawing. Use invented demo plans only.
- Poster fallbacks: `/public/posters/*.webp` rendered from the same scenes.

## Motion principles

- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` for entrances, springs (`stiffness 120, damping 20`) for interactive elements.
- Durations: 400-700 ms for UI, 1.5-2.5 s for 3D reveals.
- One idea per section; never animate more than two things at once in the same view.
- Respect `prefers-reduced-motion`: show the end state immediately.

## SEO and sharing

- `metadata` in `app/layout.tsx`: title "CADLift · 2D plans to walkable 3D", description under 155 characters, Open Graph image generated with `next/og` showing the hero render and the headline.
- `sitemap.ts`, `robots.ts`, JSON-LD `SoftwareApplication` schema with `applicationCategory: "DesignApplication"`, `offers.price: 0`, licence MIT.
- Favicon and app icon: a minimal SVG mark, a square plan outline with one wall extruded.

## Project structure

```
app/
  layout.tsx, page.tsx, opengraph-image.tsx, sitemap.ts, robots.ts
components/
  sections/   Hero, Transform, ChatDemo, WalkThrough, Inputs, Layers, Export, Metrics, OpenSource, FinalCta
  three/      OfficeModel, RisingWalls, ChatScene, FlyThrough, ExplodedLayers, ExportOrbit, Canvas3D (lazy + fallback)
  ui/         Button, Icon (inline SVG set), Toast, Terminal, KeyCaps
content/site.ts      all copy, links and numbers
lib/plan.ts          procedural office floor plan data
public/models, public/posters
```

## Vercel deployment

- `npm run build` must pass with zero errors and zero TypeScript errors.
- No server secrets needed; the site is fully static.
- Include a `README.md` with: `npm install`, `npm run dev`, and "Deploy to Vercel" button markdown:
  `[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/vishalm/CADLift&root-directory=site)`
- Add `vercel.json` only if needed for headers: long cache (`immutable`) on `/models/*` and `/posters/*`.

## Definition of done

- Every section is visual first and within the copy budget.
- 3D loads lazily, has a poster fallback, and pauses off screen.
- Lighthouse mobile: Performance 90+, Accessibility 100, Best Practices 100, SEO 100.
- Works at 375 px (3D scenes simplify: fewer meshes, no auto-orbit) and at 1440 px+.
- No emoji, no em-dashes, no icon libraries, no invented claims.
- Deploys to Vercel from a fresh clone with no configuration.
