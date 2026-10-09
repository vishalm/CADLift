/**
 * RenderStudio - side panel that turns the current 3D view into a photoreal image, an orbit
 * video, or a construction timelapse (empty site to finished building).
 *
 * The user frames the shot in the viewer; "Render current view" captures it and posts it to the
 * backend, which runs FAL in the background. Results arrive through job polling (params.renders).
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorDetail, fileUrl, jobService, RenderEntry, RenderKind, RenderStyle } from '../services/jobService';

const CAPTURE_WIDTH = 1280;
const CAPTURE_HEIGHT = 720;
const KINDS: RenderKind[] = ['image', 'video', 'construction'];
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

const KindIcon = ({ kind }: { kind: RenderKind }) => {
  if (kind === 'image') {
    return (
      <svg {...svg}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
    );
  }
  if (kind === 'video') {
    return (
      <svg {...svg}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m22 8-6 4 6 4V8z" /></svg>
    );
  }
  return (
    <svg {...svg}><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6M12 2v3" /></svg>
  );
};

const DownloadIcon = () => (
  <svg {...svg} width={14} height={14}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
);

const RenderCard: React.FC<{ render: RenderEntry }> = ({ render }) => {
  const { t } = useTranslation();
  const preview = render.image_file_id ?? render.snapshot_file_id;
  const downloads: [string, string | undefined, string][] = [
    [t('render.downloadImage'), render.image_file_id, 'png'],
    [t('render.downloadSite'), render.start_image_file_id, 'png'],
    [t('render.downloadVideo'), render.video_file_id, 'mp4'],
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
            className={`w-full h-full object-cover ${render.status === 'processing' && !render.image_file_id ? 'opacity-50 grayscale' : ''}`}
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
        </div>
        {render.prompt && <p className="text-slate-500 dark:text-slate-400 truncate" title={render.prompt}>{render.prompt}</p>}
        {render.status === 'failed' && (
          <p role="alert" className="text-red-600 dark:text-red-400">{t('render.failed', { error: render.error ?? '' })}</p>
        )}
        {render.status === 'completed' && (
          <div className="flex flex-wrap gap-2 pt-1">
            {downloads.filter(([, id]) => id).map(([label, id, ext]) => (
              <a
                key={label}
                href={fileUrl(id as string)}
                download={`render-${render.id}.${ext}`}
                className="flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <DownloadIcon />
                {label}
              </a>
            ))}
          </div>
        )}
      </div>
    </li>
  );
};

const RenderStudio: React.FC<RenderStudioProps> = ({ jobId, params, capture }) => {
  const { t } = useTranslation();
  const renders = [...((params.renders ?? []) as RenderEntry[])].reverse();
  const running = renders.filter((r) => r.status === 'processing').length;

  const [kind, setKind] = useState<RenderKind>('image');
  const [style, setStyle] = useState<RenderStyle>('daylight');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
          disabled={busy || running >= 2}
          className="w-full py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-semibold disabled:opacity-40"
        >
          {busy ? t('render.sending') : t('render.renderView')}
        </button>
        <div aria-live="polite" className="text-xs space-y-1">
          {running >= 2 && <p className="text-amber-700 dark:text-amber-400">{t('render.busyLimit')}</p>}
          {notice && running > 0 && <p className="text-emerald-700 dark:text-emerald-400">{notice}</p>}
          {error && <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {renders.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('render.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {renders.map((r) => <RenderCard key={r.id} render={r} />)}
          </ul>
        )}
      </div>
    </div>
  );
};

export default RenderStudio;
