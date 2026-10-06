/**
 * ModelViewer - full-window 3D viewer for one job (/viewer/:jobId).
 *
 * The model fills the screen; a slim top bar offers back, browser full screen
 * (button or F key) and, for PDF plan models, the AI chat panel.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Viewer3D from '../components/Viewer3D';
import PlanChat from '../components/PlanChat';
import { useJobPollingState } from '../hooks/useJobPolling';

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const BackIcon = () => (
  <svg {...iconProps}><path d="m15 18-6-6 6-6" /></svg>
);
const ExpandIcon = () => (
  <svg {...iconProps}><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
);
const ShrinkIcon = () => (
  <svg {...iconProps}><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
);
const ChatIcon = () => (
  <svg {...iconProps}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
);
const DownloadIcon = () => (
  <svg {...iconProps}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
);

const barButton =
  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors';

const ModelViewer: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { jobId = '' } = useParams<{ jobId: string }>();
  const { job, loaded } = useJobPollingState(jobId, 2000);
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chatOpen, setChatOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);

  const glbUrl = job?.glb_download_url;
  const params = job?.metadata;
  const hasChat = !!params?.plan_spec;

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      rootRef.current?.requestFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('keydown', onKey);
    };
  }, [toggleFullscreen]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/dashboard');
  };

  return (
    <div ref={rootRef} className="fixed inset-0 z-[100] flex flex-col bg-slate-100 dark:bg-slate-950">
      <header className="h-12 shrink-0 flex items-center justify-between gap-2 px-2 sm:px-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <button type="button" onClick={goBack} className={barButton}>
            <BackIcon />
            <span className="hidden sm:inline">{t('viewer.back')}</span>
          </button>
          <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate">{t('viewer.title')}</h1>
        </div>
        <div className="flex items-center gap-1">
          {glbUrl && (
            <a href={glbUrl} download className={barButton} aria-label={t('viewer.download')}>
              <DownloadIcon />
              <span className="hidden md:inline">{t('viewer.download')}</span>
            </a>
          )}
          {hasChat && (
            <button type="button" onClick={() => setChatOpen((open) => !open)} aria-pressed={chatOpen} className={barButton}>
              <ChatIcon />
              <span className="hidden md:inline">{chatOpen ? t('viewer.hideChat') : t('viewer.showChat')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={barButton}
            aria-label={isFullscreen ? t('viewer.exitFullscreen') : t('viewer.enterFullscreen')}
          >
            {isFullscreen ? <ShrinkIcon /> : <ExpandIcon />}
            <span className="hidden md:inline">{isFullscreen ? t('viewer.exitFullscreen') : t('viewer.enterFullscreen')}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <main className="flex-1 min-w-0 relative">
          {glbUrl ? (
            <Viewer3D modelUrl={glbUrl} fileName="model.glb" width="100%" height="100%" backgroundColor="#eef1f5" />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
              {!loaded ? (
                <>
                  <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('viewer.loadingModel')}</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md">{t('viewer.notReady')}</p>
                  <Link to="/dashboard" className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-semibold">
                    {t('viewer.back')}
                  </Link>
                </>
              )}
            </div>
          )}
        </main>
        {hasChat && chatOpen && params && (
          <aside className="w-full max-w-[380px] shrink-0 border-l border-slate-200 dark:border-slate-800 flex flex-col min-h-0 max-sm:absolute max-sm:inset-y-12 max-sm:right-0 max-sm:z-10">
            <PlanChat jobId={jobId} params={params} />
          </aside>
        )}
      </div>
    </div>
  );
};

export default ModelViewer;
