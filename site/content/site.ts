/**
 * All copy, links and numbers for the site. Edit or translate here only.
 * Rules: headlines max 6 words, supporting lines max 14 words, no paragraphs.
 */

export const links = {
  github: 'https://github.com/vishalm/CADLift',
  docs: 'https://github.com/vishalm/CADLift#readme',
  creator: 'https://github.com/vishalm',
  license: 'https://github.com/vishalm/CADLift/blob/main/LICENSE',
} as const;

export const site = {
  name: 'CADLift',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cadlift.vercel.app',
  title: 'CADLift · 2D plans to walkable 3D',
  description: 'Turn 2D floor plans into 3D spaces you can walk through and restyle by chatting with AI. Open source.',
  creator: 'Vishal Mishra',

  nav: { github: 'GitHub', tryIt: 'Try it' },

  hero: {
    headlineTop: 'From plan',
    headlineBottom: 'to place.',
    headline: 'From plan to place.',
    eyebrow: 'Open source · 2D to 3D',
    // Annotation chips on the hero model (demo plan values)
    specs: [
      { label: 'Plan', value: '20 x 12 m' },
      { label: 'Walls', value: '3.0 m' },
      { label: 'Layers', value: '5' },
      { label: 'Build', value: 'about 5 s' },
    ],
    line: 'Turn any 2D floor plan into a 3D space you can walk through.',
    primary: 'Try it',
    secondary: 'Star on GitHub',
    scroll: 'Scroll to explore',
  },

  marquee: {
    capabilities: ['PDF to 3D', 'AI chat edits', 'Walk-through', 'Colour layers', 'Undo anything', 'Open source'],
    formats: ['GLB', 'STEP', 'DXF', 'STL', 'GLB', 'STEP', 'DXF', 'STL'],
  },

  sections: {
    transform: { index: '01', eyebrow: 'Convert' },
    chat: { index: '02', eyebrow: 'Restyle' },
    walk: { index: '03', eyebrow: 'Explore' },
    inputs: { index: '04', eyebrow: 'Inputs' },
    layers: { index: '05', eyebrow: 'Layers' },
    export: { index: '06', eyebrow: 'Export' },
    metrics: { index: '07', eyebrow: 'Speed' },
    openSource: { index: '08', eyebrow: 'Open source' },
  },

  transform: {
    headline: 'Flat to 3D in 5 seconds.',
    steps: ['Upload', 'Extrude', 'Explore'],
    unit: 's',
  },

  chat: {
    headline: 'Just say it.',
    line: 'Restyle the whole model in plain words. Every change can be undone.',
    prompts: ['Make all furniture warm oak', 'Floor dark grey concrete', 'Walls off-white, 2.8m tall'],
    replies: ['Furniture is now warm oak.', 'Floor set to dark grey concrete.', 'Walls off-white at 2.8 m.'],
    undo: 'Undo',
    you: 'You',
    ai: 'CADLift AI',
  },

  walk: {
    headline: 'Step inside.',
    line: 'Fly through your plan in the browser with W A S D.',
    hud: { mode: 'Fly mode', eye: 'Eye 1.6 m', live: 'Live' },
  },

  inputs: {
    headline: 'Any drawing. Any idea.',
    tiles: [
      { key: 'pdf', label: 'PDF plan' },
      { key: 'cad', label: 'DXF / DWG' },
      { key: 'image', label: 'Image' },
      { key: 'prompt', label: 'Text prompt', sample: 'a coffee mug, 90mm' },
    ],
  },

  layers: {
    headline: 'Every layer, yours.',
    labels: ['Furniture · oak', 'Plants · leaf green', 'Walls · off-white', 'Floor · concrete'],
  },

  export: {
    headline: 'Take it everywhere.',
    formats: ['GLB', 'STEP', 'DXF', 'STL'],
    targets: ['Blender', 'Unity', 'Unreal', 'SolidWorks', 'Fusion 360', 'AutoCAD', '3D print'],
  },

  metrics: {
    headline: 'Built to be fast.',
    gaugeLabel: 'plan to 3D',
    gaugeValue: 5,
    stagesLabel: 'Pipeline, seconds',
    // Approximate stage timings for the 104 m sample plan (total about 5 s).
    stages: [
      { name: 'Parse', seconds: 1.4 },
      { name: 'Crop', seconds: 0.1 },
      { name: 'Extrude', seconds: 2.6 },
      { name: 'Colour', seconds: 0.2 },
      { name: 'Export', seconds: 0.6 },
    ],
    flowLabel: 'Inputs to outputs',
    flowInputs: ['PDF', 'DXF', 'DWG', 'Image', 'Prompt'],
    flowOutputs: ['GLB', 'STEP', 'DXF', 'STL'],
    // Which outputs each input produces today (PDF plans export GLB).
    flows: {
      PDF: ['GLB'],
      DXF: ['GLB', 'STEP', 'DXF', 'STL'],
      DWG: ['GLB', 'STEP', 'DXF', 'STL'],
      Image: ['GLB', 'STEP', 'DXF'],
      Prompt: ['GLB', 'STEP', 'DXF'],
    } as Record<string, readonly string[]>,
    caption: 'Measured on a 104 m office floor plate.',
  },

  openSource: {
    headline: 'Free. Open. Yours.',
    star: 'Star on GitHub',
    license: 'MIT licensed',
    commands: [
      'git clone https://github.com/vishalm/CADLift',
      'cd CADLift/backend && pip install -e .',
      'uvicorn app.main:app --reload',
    ],
    copy: 'Copy',
    copied: 'Copied',
  },

  finalCta: {
    headline: 'Lift your plans.',
  },

  footer: {
    github: 'GitHub',
    docs: 'Docs',
    createdBy: 'Created by',
    license: 'MIT licence',
  },

  a11y: {
    modelAlt: 'Isometric 3D office floor plan rising from a blueprint',
    sceneFallback: 'Blueprint drawing of an office floor plan',
  },
} as const;
