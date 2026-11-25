import React, { useEffect, useState } from 'react';
import { BookMarked, Loader2, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { TafsirSadiResponse } from '../types/quran';

interface TafsirSadiCardProps {
  surah: number;
  ayah: number;
  compact?: boolean;
}

/**
 * Formats authentic Tafsir as-Sa'di paragraphs, highlighting embedded Quranic quotes
 * delimited by ﴿...﴾ or {...} in clear calligraphic Naskh script.
 */
function renderTafsirParagraph(paragraph: string, keyPrefix: string): React.ReactNode {
  const tokens = paragraph.split(/(﴿[^﴾]+﴾|\{[^}]+\})/g);
  return tokens.map((part, idx) => {
    if (!part) return null;
    if (
      (part.startsWith('﴿') && part.endsWith('﴾')) ||
      (part.startsWith('{') && part.endsWith('}'))
    ) {
      const normalized =
        part.startsWith('{') && part.endsWith('}')
          ? `﴿${part.slice(1, -1)}﴾`
          : part;
      return (
        <span
          key={`${keyPrefix}-q-${idx}`}
          className="font-quran text-[1.16em] text-emerald-900 dark:text-emerald-300 px-0.5"
        >
          {normalized}
        </span>
      );
    }
    return <React.Fragment key={`${keyPrefix}-t-${idx}`}>{part}</React.Fragment>;
  });
}

export const TafsirSadiCard: React.FC<TafsirSadiCardProps> = ({
  surah,
  ayah,
  compact = false,
}) => {
  const [tafsir, setTafsir] = useState<TafsirSadiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/tafsir/sadi/${surah}/${ayah}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: TafsirSadiResponse) => {
        if (!cancelled) {
          setTafsir(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'تعذر تحميل تفسير السعدي · Failed to load Tafsir');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [surah, ayah]);

  const paragraphs = tafsir?.tafsirText
    ? tafsir.tafsirText
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  return (
    <div
      dir="rtl"
      className={`border border-stone-200 dark:border-stone-800 rounded-xl bg-white dark:bg-[#141A21] ${
        compact ? 'p-4' : 'p-5 sm:p-6'
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 mb-4 border-b border-stone-200 dark:border-stone-800">
        <div className="flex items-start gap-2.5">
          <BookMarked className="w-4 h-4 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              تفسير السعدي — تيسير الكريم الرحمن في تفسير كلام المنان
            </h3>
            <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
              {tafsir?.author || 'الشيخ عبد الرحمن بن ناصر السعدي (ت ١٣٧٦ هـ)'}
              <span className="mx-1.5 text-stone-300 dark:text-stone-700">·</span>
              <span dir="ltr" className="text-[10px]">
                Tafsīr al-Sa‘dī ({surah}:{ayah})
              </span>
            </div>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-400 shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{tafsir?.sourceLabel || 'مركز تفسير للدراسات القرآنية'}</span>
        </span>
      </div>

      {loading ? (
        <div className="py-10 flex flex-col items-center justify-center gap-2 text-stone-500 dark:text-stone-400">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
          <span className="text-xs">جاري تحميل تفسير السعدي للآية {surah}:{ayah}…</span>
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/20 flex items-center gap-2 text-xs text-red-800 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : tafsir ? (
        <div className="space-y-4">
          {tafsir.ayahText && (
            <div className="px-4 py-3 rounded-lg bg-[#FCF9F0] dark:bg-stone-900/60 border border-[#D7C9A9]/70 dark:border-stone-800">
              <div className="font-quran text-xl sm:text-2xl leading-[2] text-stone-900 dark:text-stone-100">
                ﴿{tafsir.ayahText}﴾
              </div>
            </div>
          )}

          <div className="space-y-3 font-corpus-label text-[16px] sm:text-[17px] leading-[2.15] text-stone-800 dark:text-stone-200">
            {paragraphs.map((p, idx) => (
              <p key={idx}>{renderTafsirParagraph(p, `tafsir-${surah}-${ayah}-${idx}`)}</p>
            ))}
          </div>

          <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-start gap-2 text-[11px] text-stone-500 dark:text-stone-400">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-stone-400" />
            <span>{tafsir.tashkeelPolicy}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
