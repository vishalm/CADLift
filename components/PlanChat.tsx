/**
 * PlanChat - side panel for editing a PDF plan model in natural language.
 *
 * Shows the model's colour layers and a chat. Each message goes to the backend,
 * which asks the LLM for layer changes (colour, height, visibility), rebuilds the
 * GLB, and stores a new version. Undo reverts to the previous version.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorDetail, jobService } from '../services/jobService';

interface PlanLayer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

interface PlanChatProps {
  jobId: string;
  /** Job params from the API (plan_spec, plan_chat, plan_versions). */
  params: Record<string, unknown>;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4 20-7z" />
  </svg>
);

const UndoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 7v6h6" />
    <path d="M3 13a9 9 0 1 0 3-7.7L3 7" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const Swatch = ({ color, dimmed }: { color: string; dimmed?: boolean }) => (
  <span
    className="inline-block w-3.5 h-3.5 rounded-sm border border-slate-300 dark:border-slate-600 shrink-0"
    style={{ backgroundColor: color, opacity: dimmed ? 0.35 : 1 }}
    aria-hidden="true"
  />
);

const PlanChat: React.FC<PlanChatProps> = ({ jobId, params }) => {
  const { t } = useTranslation();
  const spec = (params.plan_spec ?? {}) as { layers?: PlanLayer[]; floor?: { color: string; visible: boolean } };
  const history = (params.plan_chat ?? []) as ChatMessage[];
  const versions = (params.plan_versions ?? []) as unknown[];
  const layers = spec.layers ?? [];

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [history.length, pending, busy]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setSkipped([]);
    setPending(message);
    setInput('');
    try {
      const result = await jobService.chatPlan(jobId, message);
      setSkipped(result.skipped);
    } catch (err) {
      setError(apiErrorDetail(err));
      setInput(message);
    } finally {
      setPending(null);
      setBusy(false);
    }
  };

  const undo = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSkipped([]);
    try {
      await jobService.undoPlan(jobId);
    } catch (err) {
      setError(apiErrorDetail(err));
    } finally {
      setBusy(false);
    }
  };

  const suggestions = [1, 2, 3, 4].map((n) => t(`common.plan_chat_suggestion_${n}`));

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{t('common.plan_chat_title')}</h3>
        <button
          type="button"
          onClick={undo}
          disabled={busy || versions.length < 2}
          className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <UndoIcon />
          {t('common.plan_chat_undo')}
        </button>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setLayersOpen((open) => !open)}
          aria-expanded={layersOpen}
          className="w-full px-4 py-2 flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <ChevronIcon open={layersOpen} />
          {t('common.plan_chat_layers', { count: layers.length + 1 })}
        </button>
        {layersOpen && (
          <ul className="max-h-48 overflow-y-auto px-4 pb-2 space-y-1 text-xs">
            {spec.floor && (
              <li className="flex items-center gap-2">
                <Swatch color={spec.floor.color} dimmed={!spec.floor.visible} />
                <span className={spec.floor.visible ? '' : 'line-through text-slate-400'}>{t('common.plan_chat_floor')}</span>
              </li>
            )}
            {layers.map((layer) => (
              <li key={layer.id} className="flex items-center gap-2">
                <Swatch color={layer.color} dimmed={!layer.visible} />
                <span className={`truncate ${layer.visible ? '' : 'line-through text-slate-400'}`}>{layer.name}</span>
                {!layer.visible && <span className="text-slate-400 shrink-0">{t('common.plan_chat_hidden')}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm" aria-live="polite">
        {history.length === 0 && !pending && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('common.plan_chat_hint')}</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={busy}
                  className="px-2.5 py-1 text-xs rounded-full border border-slate-300 dark:border-slate-600 hover:border-primary-500 hover:text-primary-600 disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {history.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-br-sm'
                  : 'bg-slate-100 dark:bg-slate-800 rounded-bl-sm'
              }`}
            >
              <span className="sr-only">{m.role === 'user' ? t('common.plan_chat_you') : t('common.plan_chat_ai')}: </span>
              {m.content}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex justify-end">
            <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-br-sm bg-slate-900 text-white dark:bg-white dark:text-slate-900 opacity-70">
              {pending}
            </div>
          </div>
        )}
        {busy && <p className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">{t('common.plan_chat_busy')}</p>}
        {skipped.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">{t('common.plan_chat_skipped', { items: skipped.join('; ') })}</p>
        )}
        {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div ref={endRef} />
      </div>

      <form
        className="p-3 border-t border-slate-200 dark:border-slate-700 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="plan-chat-input" className="sr-only">{t('common.plan_chat_title')}</label>
        <textarea
          id="plan-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={2}
          maxLength={1000}
          placeholder={t('common.plan_chat_placeholder')}
          disabled={busy}
          className="flex-1 resize-none px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label={t('common.plan_chat_send')}
          className="self-end p-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 disabled:opacity-40"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
};

export default PlanChat;
