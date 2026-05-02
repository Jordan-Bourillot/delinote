import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2, Save, X, Wand2, Loader2, Copy } from 'lucide-react';
import { useT } from '../i18n';
import { useStore } from '../store';
import { transcribeBlob, type ProgressEvent } from '../asr';

export function AudioRecorder({ noteId, onAttach, onTranscript, onClose }: {
  noteId: string;
  onAttach: (filename: string, mime: string, size: number, attachmentId: string) => void;
  onTranscript?: (text: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAt = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    if (tickRef.current) clearInterval(tickRef.current);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: pickMime() });
      recorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        stream.getTracks().forEach((tr) => tr.stop());
        if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      };
      mr.start();
      startedAt.current = Date.now();
      setElapsed(0);
      setTranscript(null);
      tickRef.current = setInterval(() => setElapsed(Date.now() - startedAt.current), 200);
      setRecording(true);
    } catch {
      toast('error', t('audio.permission'));
    }
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function discard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl(null);
    setElapsed(0);
    setTranscript(null);
    setProgress(null);
  }

  async function save() {
    if (!blob) return;
    const ext = (blob.type.split('/')[1] || 'webm').split(';')[0];
    const filename = `voice_${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
    const buf = await blob.arrayBuffer();
    const att = await window.nv.saveAttachment(noteId, filename, blob.type, buf);
    onAttach(att.filename, att.mime, att.size, att.id);
    if (transcript && onTranscript) onTranscript(transcript);
    onClose();
  }

  async function transcribe() {
    if (!blob) return;
    setTranscribing(true);
    setProgress(null);
    try {
      const text = await transcribeBlob(blob, (p) => setProgress(p));
      setTranscript(text || '(vide)');
    } catch (e: any) {
      console.warn('[asr] failed', e);
      toast('error', t('asr.failed'));
    } finally {
      setTranscribing(false);
    }
  }

  function insertTranscriptOnly() {
    if (transcript && onTranscript) onTranscript(transcript);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="theme-card border theme-border rounded-xl shadow-2xl w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold theme-text flex items-center gap-2">
            <Mic size={16} /> {t('audio.record')}
          </h2>
          <button onClick={onClose} className="theme-muted hover:theme-text"><X size={14} /></button>
        </div>

        <div className="flex flex-col items-center gap-4 py-6">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center transition ${
              recording ? 'bg-red-500/20 ring-4 ring-red-500/40 animate-pulse' : 'theme-card-soft border theme-border-soft'
            }`}
          >
            {recording ? <Square size={32} className="text-red-500" /> : <Mic size={32} className="theme-muted" />}
          </div>
          <div className="text-2xl font-mono tabular-nums theme-text">{formatTime(elapsed)}</div>
          {recording && <div className="text-xs theme-muted">{t('audio.recording')}</div>}
        </div>

        {previewUrl && (
          <audio controls src={previewUrl} className="w-full mb-3" />
        )}

        {transcribing && (
          <div className="mb-3 p-3 rounded-lg theme-card-soft border theme-border-soft">
            <div className="text-xs theme-muted flex items-center gap-2 mb-1.5">
              <Loader2 size={12} className="animate-spin" />
              {progress?.kind === 'download'
                ? t('asr.downloading', { pct: Math.round((progress.ratio ?? 0) * 100) })
                : t('asr.working')}
            </div>
            {progress?.kind === 'download' && progress.total > 0 && (
              <div className="h-1 rounded bg-black/10 overflow-hidden">
                <div
                  className="h-full theme-accent-bg transition-all"
                  style={{ width: `${Math.round(progress.ratio * 100)}%` }}
                />
              </div>
            )}
            <p className="text-[10px] theme-muted mt-1.5">{t('asr.firstUseHint')}</p>
          </div>
        )}

        {transcript && !transcribing && (
          <div className="mb-3 p-3 rounded-lg theme-card-soft border theme-border-soft">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wider theme-muted font-semibold">{t('asr.result')}</span>
              <button
                onClick={() => { void navigator.clipboard.writeText(transcript); toast('success', t('asr.copied')); }}
                className="theme-muted hover:theme-text"
                title={t('asr.copy')}
              >
                <Copy size={11} />
              </button>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="w-full theme-input rounded p-2 text-xs"
              rows={4}
            />
          </div>
        )}

        <div className="flex gap-2 justify-center flex-wrap">
          {!recording && !blob && (
            <button onClick={start} className="px-4 py-2 rounded-lg text-white bg-red-500 hover:bg-red-600 shadow-sm flex items-center gap-2">
              <Mic size={14} /> {t('audio.record')}
            </button>
          )}
          {recording && (
            <button onClick={stop} className="px-4 py-2 rounded-lg text-white theme-accent-bg hover:opacity-90 shadow-sm flex items-center gap-2">
              <Square size={14} /> {t('audio.stop')}
            </button>
          )}
          {blob && !recording && (
            <>
              <button onClick={discard} disabled={transcribing} className="px-3 py-2 rounded-lg theme-muted hover:theme-text hover:theme-hover flex items-center gap-2 disabled:opacity-40">
                <Trash2 size={14} />
              </button>
              {!transcript && onTranscript && (
                <button
                  onClick={() => void transcribe()}
                  disabled={transcribing}
                  className="px-3 py-2 rounded-lg theme-card border theme-border-soft hover:theme-hover text-xs flex items-center gap-2 disabled:opacity-40"
                  title={t('asr.transcribe')}
                >
                  {transcribing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  {t('asr.transcribe')}
                </button>
              )}
              {transcript && onTranscript && (
                <button
                  onClick={insertTranscriptOnly}
                  className="px-3 py-2 rounded-lg theme-card border theme-border-soft hover:theme-hover text-xs flex items-center gap-2"
                >
                  {t('asr.insertOnly')}
                </button>
              )}
              <button onClick={() => void save()} disabled={transcribing} className="px-4 py-2 rounded-lg text-white theme-accent-bg hover:opacity-90 shadow-sm flex items-center gap-2 disabled:opacity-40">
                <Save size={14} /> {transcript ? t('asr.saveBoth') : t('med.save')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function pickMime() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const m of candidates) if (MediaRecorder.isTypeSupported(m)) return m;
  return '';
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
