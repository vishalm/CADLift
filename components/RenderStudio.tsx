/**
 * RenderStudio - side panel that turns the current 3D view into a photoreal image, an orbit
 * video, or a construction timelapse (empty site to finished building). A finished render's
 * photo can then become an explorable 3D world, a 3D object model, or an ambient sound loop.
 *
 * The user frames the shot in the viewer; "Render current view" captures it and posts it to the
 * backend, which runs the providers in the background. Results arrive through job polling
 * (params.renders).
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  apiErrorDetail,
  DerivedKind,
  fileUrl,
  jobService,
  RenderEntry,
  RenderKind,
  RenderStyle,
} from '../services/jobService';
import Viewer3DModal from './Viewer3DModal';
import WorldViewer from './WorldViewer';

const CAPTURE_WIDTH = 1280;
const CAPTURE_HEIGHT = 720;
const MAX_RUNNING = 2; // mirrors MAX_ACTIVE_RENDERS in the jobs API
const KINDS: RenderKind[] = ['image', 'video', 'construction'];
const DERIVED: DerivedKind[] = ['world', 'object', 'sound'];
const STYLES: RenderStyle[] = ['daylight', 'golden_hour', 'night', 'interior', 'overcast'];

interface RenderStudioProps {
  jobId: string;
  /** Job params from the API (renders). */
  params: Record<string, unknown>;
  /** Captures the viewer's current view as a PNG data URL; null until the model has loaded. */
  capture: React.MutableRefObject<((width: number, height: number) => string) | null>;
}

const svg = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const KIND_ICONS: Record<RenderKind | DerivedKind, React.ReactNode> = {
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>,
  video: <><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m22 8-6 4 6 4V8z" /></>,
  construction: <path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6M12 2v3" />,
  world: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></>,
  object: <><path d="m21 16-9 5-9-5V8l9-5 9 5z" /><path d="m3 8 9 5 9-5M12 13v8" /></>,
  sound: <><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></>,
};

const KindIcon = ({ kind }: { kind: RenderKind | DerivedKind }) => <svg {...svg}>{KIND_ICONS[kind]}</svg>;

const TrashIcon = () => (
  <svg {...svg} width={14} height={14}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>
);

const DownloadIcon = () => (
  <svg {...svg} width={14} height={14}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
);

const chip = 'flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40';
const primaryChip = 'flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold';

const isSourceKind = (kind: RenderEntry['kind']): kind is RenderKind => (KINDS as string[]).includes(kind);

interface RenderCardProps {
  render: RenderEntry;
  /** Image to show when the render has none of its own (derived renders show their source photo). */
  fallbackPreview?: string;
  canStart: boolean;
  onDerive: (render: RenderEntry, kind: DerivedKind, prompt: string) => Promise<void>;
  onExplore: (render: RenderEntry) => void;
  onViewModel: (render: RenderEntry) => void;
  onDelete: (render: RenderEntry) => void;
}

const DeriveActions: React.FC<Pick<RenderCardProps, 'render' | 'canStart' | 'onDerive'>> = ({ render, canStart, onDerive }) => {
  const { t } = useTranslation();
  const [objectName, setObjectName] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const derive = async (kind: DerivedKind, prompt = '') => {
    setSending(true);
    try {
      await onDerive(render, kind, prompt);
      setObjectName(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pt-2 mt-1 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
      <p className="font-semibold">{t('render.deriveTitle')}</p>
      <div className="flex flex-wrap gap-1.5">
        {DERIVED.map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={!canStart || sending}
            onClick={() => (kind === 'object' ? setObjectName((name) => (name === null ? '' : null)) : void derive(kind))}
            aria-expanded={kind === 'object' ? objectName !== null : undefined}
            title={t(`render.deriveHint_${kind}`)}
            className={chip}
          >
            <KindIcon kind={kind} />
            {t(`render.kind_${kind}`)}
          </button>
        ))}
      </div>
      {objectName !== null && (
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (objectName.trim()) void derive('object', objectName.trim());
          }}
        >
          <label htmlFor={`object-${render.id}`} className="sr-only">{t('render.objectName')}</label>
          <input
            id={`object-${render.id}`}
            value={objectName}
            onChange={(e) => setObjectName(e.target.value)}
            maxLength={120}
            placeholder={t('render.objectPlaceholder')}
            autoFocus
            className="flex-1 min-w-0 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700"
          />
          <button type="submit" disabled={!canStart || sending || !objectName.trim()} className={`${primaryChip} disabled:opacity-40`}>
            {t('render.objectCreate')}
          </button>
        </form>
      )}
    </div>
  );
};

const RenderCard: React.FC<RenderCardProps> = ({ render, fallbackPreview, canStart, onDerive, onExplore, onViewModel, onDelete }) => {
  const { t } = useTranslation();
  const preview = render.image_file_id ?? render.world_pano_file_id ?? render.snapshot_file_id ?? fallbackPreview;
  const done = render.status === 'completed';
  const downloads: [string, string | undefined, string][] = [
    [t(render.kind === 'object' ? 'render.downloadReference' : 'render.downloadImage'), render.image_file_id, 'png'],
    [t('render.downloadSite'), render.start_image_file_id, 'png'],
    [t('render.downloadVideo'), render.video_file_id, 'mp4'],
    [t('render.downloadWorld'), render.world_spz_file_id, 'spz'],
    [t('render.downloadCollider'), render.world_collider_file_id, 'glb'],
    [t('render.downloadPano'), render.world_pano_file_id, 'png'],
    [t('render.downloadModel'), render.model_file_id, 'glb'],
    [t('render.downloadSound'), render.audio_file_id, 'mp3'],
  ];

  return (
    <li className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="relative bg-slate-100 dark:bg-slate-800 aspect-video">
        {render.video_file_id ? (
          <video
            src={fileUrl(render.video_file_id)}
            poster={preview ? fileUrl(preview) : undefined}
            controls
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : preview ? (
          <img
            src={fileUrl(preview)}
            alt={t(`render.kind_${render.kind}`)}
            className={`w-full h-full object-cover ${!done && !render.image_file_id ? 'opacity-50 grayscale' : ''}`}
          />
        ) : null}
        {render.status === 'processing' && (
          <span className="absolute left-2 bottom-2 px-2 py-1 rounded-md bg-black/70 text-white text-xs animate-pulse">
            {t(`render.stage_${render.stage ?? 'photo'}`)}
          </span>
        )}
      </div>
      <div className="px-3 py-2 space-y-1 text-xs">
        <div className="flex items-center gap-2 font-semibold">
          <KindIcon kind={render.kind} />
          <span>{t(`render.kind_${render.kind}`)}</span>
          <span className="text-slate-400 font-normal">· {t(`render.style_${render.style}`)}</span>
          {render.status !== 'processing' && (
            <button
              type="button"
              onClick={() => onDelete(render)}
              aria-label={t('render.delete')}
              title={t('render.delete')}
              className="ml-auto p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <TrashIcon />
            </button>
          )}
        </div>
        {render.prompt && <p className="text-slate-500 dark:text-slate-400 truncate" title={render.prompt}>{render.prompt}</p>}
        {render.status === 'failed' && (
          <p role="alert" className="text-red-600 dark:text-red-400">{t('render.failed', { error: render.error ?? '' })}</p>
        )}
        {done && render.audio_file_id && (
          <audio src={fileUrl(render.audio_file_id)} controls loop className="w-full h-8" aria-label={t('render.kind_sound')} />
        )}
        {done && (
          <div className="flex flex-wrap gap-2 pt-1">
            {render.world_spz_file_id && (
              <button type="button" onClick={() => onExplore(render)} className={primaryChip}>
                <KindIcon kind="world" />
                {t('render.exploreWorld')}
              </button>
            )}
            {render.model_file_id && (
              <button type="button" onClick={() => onViewModel(render)} className={primaryChip}>
                <KindIcon kind="object" />
                {t('render.viewModel')}
              </button>
            )}
            {downloads.filter(([, id]) => id).map(([label, id, ext]) => (
              <a key={label} href={fileUrl(id as string)} download={`render-${render.id}.${ext}`} className={chip}>
                <DownloadIcon />
                {label}
              </a>
            ))}
          </div>
        )}
        {done && isSourceKind(render.kind) && render.image_file_id && (
          <DeriveActions render={render} canStart={canStart} onDerive={onDerive} />
        )}
      </div>
    </li>
  );
};

const RenderStudio: React.FC<RenderStudioProps> = ({ jobId, params, capture }) => {
  const { t } = useTranslation();
  const history = (params.renders ?? []) as RenderEntry[];
  const renders = [...history].reverse();
  const byId = new Map(history.map((r) => [r.id, r]));
  const running = renders.filter((r) => r.status === 'processing').length;
  const canStart = running < MAX_RUNNING;

  const [kind, setKind] = useState<RenderKind>('image');
  const [style, setStyle] = useState<RenderStyle>('daylight');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [world, setWorld] = useState<RenderEntry | null>(null);
  const [model, setModel] = useState<RenderEntry | null>(null);

  const start = async () => {
    if (busy) return;
    const grab = capture.current;
    if (!grab) {
      setError(t('render.notReady'));
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const snapshot = await (await fetch(grab(CAPTURE_WIDTH, CAPTURE_HEIGHT))).blob();
      await jobService.createRender(jobId, snapshot, { kind, style, prompt: prompt.trim() });
      setNotice(t(kind === 'image' ? 'render.startedImage' : 'render.startedVideo'));
    } catch (err) {
      setError(apiErrorDetail(err));
    } finally {
      setBusy(false);
    }
  };

  const derive = async (source: RenderEntry, derivedKind: DerivedKind, derivedPrompt: string) => {
    setError(null);
    setNotice(null);
    try {
      await jobService.deriveRender(jobId, source.id, derivedKind, derivedPrompt);
      setNotice(t(`render.started_${derivedKind}`));
    } catch (err) {
      setError(apiErrorDetail(err));
    }
  };

  const remove = async (render: RenderEntry) => {
    if (!window.confirm(t('render.confirmDelete', { kind: t(`render.kind_${render.kind}`) }))) return;
    setError(null);
    setNotice(null);
    try {
      await jobService.deleteRender(jobId, render.id);
    } catch (err) {
      setError(apiErrorDetail(err));
    }
  };

  // The world plays the newest finished sound made from the same photo, if any.
  const worldSound = world
    ? renders.find((r) => r.kind === 'sound' && r.status === 'completed' && r.audio_file_id
      && r.source_render_id === world.source_render_id)?.audio_file_id
    : undefined;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-bold">{t('render.title')}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('render.hint')}</p>
      </div>

      <div className="px-4 py-3 space-y-3 border-b border-slate-200 dark:border-slate-700">
        <fieldset>
          <legend className="text-xs font-semibold mb-1.5">{t('render.output')}</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                  kind === k
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                    : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <KindIcon kind={k} />
                {t(`render.kind_${k}`)}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{t(`render.kindHint_${kind}`)}</p>
        </fieldset>

        <div>
          <label htmlFor="render-style" className="block text-xs font-semibold mb-1">{t('render.style')}</label>
          <select
            id="render-style"
            value={style}
            onChange={(e) => setStyle(e.target.value as RenderStyle)}
            className="w-full px-2 py-1.5 text-sm rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700"
          >
            {STYLES.map((s) => <option key={s} value={s}>{t(`render.style_${s}`)}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="render-prompt" className="block text-xs font-semibold mb-1">{t('render.details')}</label>
          <textarea
            id="render-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={t('render.detailsPlaceholder')}
            className="w-full resize-none px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          />
        </div>

        <button
          type="button"
          onClick={start}
          disabled={busy || !canStart}
          className="w-full py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-semibold disabled:opacity-40"
        >
          {busy ? t('render.sending') : t('render.renderView')}
        </button>
        <div aria-live="polite" className="text-xs space-y-1">
          {!canStart && <p className="text-amber-700 dark:text-amber-400">{t('render.busyLimit')}</p>}
          {notice && running > 0 && <p className="text-emerald-700 dark:text-emerald-400">{notice}</p>}
          {error && <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {renders.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('render.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {renders.map((r) => (
              <RenderCard
                key={r.id}
                render={r}
                fallbackPreview={r.source_render_id ? byId.get(r.source_render_id)?.image_file_id : undefined}
                canStart={canStart}
                onDerive={derive}
                onExplore={setWorld}
                onViewModel={setModel}
                onDelete={(r) => void remove(r)}
              />
            ))}
          </ul>
        )}
      </div>

      {world?.world_spz_file_id && (
        <WorldViewer
          spzUrl={fileUrl(world.world_spz_file_id)}
          colliderUrl={world.world_collider_file_id ? fileUrl(world.world_collider_file_id) : undefined}
          meta={world.world_meta}
          audioUrl={worldSound ? fileUrl(worldSound) : undefined}
          onClose={() => setWorld(null)}
        />
      )}
      {model?.model_file_id && (
        <Viewer3DModal
          isOpen
          onClose={() => setModel(null)}
          modelUrl={fileUrl(model.model_file_id)}
          fileName="object.glb"
          title={model.prompt || t('render.kind_object')}
          downloadUrl={fileUrl(model.model_file_id)}
        />
      )}
    </div>
  );
};

export default RenderStudio;
