import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Play,
  Languages,
  Palette,
  Info,
  Loader2,
  X,
  Maximize2,
  BookOpen,
  BookMarked,
  AlignJustify,
  LayoutGrid,
} from 'lucide-react';
import {
  AyahLinguisticsResponse,
  Chapter,
  QuranVerse,
  QuranWord,
} from '../types/quran';
import { renderTajweedText, TAJWEED_LEGEND_ITEMS } from '../utils/tajweedParser';
import { DependencyGraphCanvas } from './DependencyGraphCanvas';
import { WordGrammarInspector } from './WordGrammarInspector';
import { TafsirSadiCard } from './TafsirSadiCard';

interface MushafReaderProps {
  chapters: Chapter[];
  page: number;
  onChangePage: (page: number) => void;
  activePlayingAyahKey: string | null;
  onPlayFromAyah: (surah: number, ayah: number) => void;
  onOpenFullGraph: (surah: number, ayah: number) => void;
}

interface LineWordEntry {
  verse: QuranVerse;
  word: QuranWord;
}

type MushafViewMode = 'mushaf' | 'ayah';

const loadedFontPages = new Set<number>();
let qbsmlRegistered = false;

function toArabicIndicDigits(num: number): string {
  const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num)
    .split('')
    .map((d) => digits[Number(d)] ?? d)
    .join('');
}

function ensurePageFontStyle(pageNum: number): void {
  const styleId = `qcf-v4-style-${pageNum}`;
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @font-face {
      font-family: 'QCF_V4_P${pageNum}';
      src: url('https://verses.quran.foundation/fonts/quran/hafs/v4/colrv1/woff2/p${pageNum}.woff2') format('woff2');
      font-display: swap;
    }
  `;
  document.head.appendChild(style);
}

function ensureQbsmlFontStyle(): void {
  if (qbsmlRegistered) return;
  qbsmlRegistered = true;
  const style = document.createElement('style');
  style.id = 'qcf-v4-qbsml-style';
  style.textContent = `
    @font-face {
      font-family: 'QCF4_QBSML';
      src: url('/api/fonts/qbsml.woff2') format('woff2');
      font-display: swap;
    }
  `;
  document.head.appendChild(style);
}

export const MushafReader: React.FC<MushafReaderProps> = ({
  chapters,
  page,
  onChangePage,
  activePlayingAyahKey,
  onPlayFromAyah,
  onOpenFullGraph,
}) => {
  const [verses, setVerses] = useState<QuranVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [v4FontReady, setV4FontReady] = useState<boolean>(loadedFontPages.has(page));
  const [qbsmlReady, setQbsmlReady] = useState<boolean>(false);

  // Default to Ayah-by-Ayah on narrow/mobile screens so there are never line-wrap gaps; Proper Mushaf on wider viewports
  const [viewMode, setViewMode] = useState<MushafViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'ayah' : 'mushaf'
  );
  const [tajweedEnabled, setTajweedEnabled] = useState(true);
  const [showWbw, setShowWbw] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);

  // Selected Ayah & Word for inline Dependency Graph, Word Gloss & Tafsir as-Sa'di
  const [selectedAyahKey, setSelectedAyahKey] = useState<string | null>(null);
  const [selectedWordPos, setSelectedWordPos] = useState<number | null>(null);
  const [selectedWordObj, setSelectedWordObj] = useState<QuranWord | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'grammar' | 'tafsir'>('grammar');
  const [ayahLing, setAyahLing] = useState<AyahLinguisticsResponse | null>(null);
  const [lingLoading, setLingLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ensureQbsmlFontStyle();
    ensurePageFontStyle(page);
    if (page > 1) ensurePageFontStyle(page - 1);
    if (page < 604) ensurePageFontStyle(page + 1);

    setV4FontReady(loadedFontPages.has(page));

    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts
        .load(`24px 'QCF_V4_P${page}'`)
        .then(() => {
          loadedFontPages.add(page);
          if (!cancelled) setV4FontReady(true);
        })
        .catch(() => {});

      document.fonts
        .load(`28px 'QCF4_QBSML'`)
        .then(() => {
          if (!cancelled) setQbsmlReady(true);
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/mushaf/page/${page}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { verses: QuranVerse[] }) => {
        if (!cancelled) {
          setVerses(data.verses || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'تعذر تحميل صفحة المصحف / Failed to load Mushaf page');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  useEffect(() => {
    if (!selectedAyahKey) {
      setAyahLing(null);
      return;
    }
    const [s, a] = selectedAyahKey.split(':').map(Number);
    if (!s || !a) return;

    let cancelled = false;
    setLingLoading(true);
    fetch(`/api/linguistics/ayah/${s}/${a}`)
      .then((r) => r.json())
      .then((json: AyahLinguisticsResponse) => {
        if (!cancelled) {
          setAyahLing(json);
          setLingLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAyahKey]);

  const surahsOnPage = useMemo(() => {
    const ids = new Set<number>();
    for (const v of verses) {
      ids.add(Number(v.verse_key.split(':')[0]));
    }
    return Array.from(ids)
      .map((id) => chapters.find((c) => c.id === id))
      .filter(Boolean) as Chapter[];
  }, [verses, chapters]);

  const primarySurah = surahsOnPage[0];
  const currentJuz = verses[0]?.juz_number || 1;
  const currentHizb = verses[0]?.hizb_number || 1;

  // Authentic 15-line Madani Mushaf rows (lines 1..15)
  const mushafLines = useMemo(() => {
    const byLine = new Map<number, LineWordEntry[]>();
    const surahHeaderAtLine = new Map<number, { chapter: Chapter; showBismillah: boolean }>();

    for (const v of verses) {
      const surahId = Number(v.verse_key.split(':')[0]);
      if (v.verse_number === 1 && v.words.length > 0) {
        const firstLine = v.words[0].line_number;
        const ch = chapters.find((c) => c.id === surahId);
        if (ch) {
          const showBismillah = surahId !== 1 && surahId !== 9;
          const headerLine = showBismillah ? Math.max(1, firstLine - 2) : Math.max(1, firstLine - 1);
          surahHeaderAtLine.set(headerLine, { chapter: ch, showBismillah });
        }
      }

      for (const w of v.words) {
        const ln = w.line_number || 1;
        if (!byLine.has(ln)) byLine.set(ln, []);
        byLine.get(ln)!.push({ verse: v, word: w });
      }
    }

    const lineNumbers = Array.from(
      new Set([...Array.from(byLine.keys()), ...Array.from(surahHeaderAtLine.keys())])
    ).sort((a, b) => a - b);

    return { byLine, surahHeaderAtLine, lineNumbers };
  }, [verses, chapters]);

  const handleSelectAyahGraph = (
    verseKey: string,
    wordPos?: number,
    word?: QuranWord,
    targetTab: 'grammar' | 'tafsir' = 'grammar'
  ) => {
    setSelectedAyahKey(verseKey);
    setSelectedWordPos(wordPos ?? 1);
    setInspectorTab(targetTab);
    if (word && word.char_type_name === 'word') {
      setSelectedWordObj(word);
    } else {
      setSelectedWordObj(null);
    }
  };

  // COLRv1 glyphs have baked-in dark base ink, so keep paper warm cream when KFGQPC V4 Tajweed is enabled
  const useV4Paper = tajweedEnabled;

  // Toggle WBW seamlessly switches into Ayah-by-Ayah if in Mushaf mode so lines never break with WBW gaps
  const handleToggleWbw = () => {
    setShowWbw((prev) => {
      const next = !prev;
      if (next && viewMode === 'mushaf') {
        setViewMode('ayah');
      }
      return next;
    });
  };

  const renderSurahHeaderBanner = (ch: Chapter, showBismillah: boolean) => (
    <div className="my-2.5 space-y-2">
      <div
        className={`relative flex items-center justify-between px-4 sm:px-6 py-2 rounded-lg border-2 border-[#B58833]/55 ${
          useV4Paper
            ? 'bg-gradient-to-r from-[#F4EAD2] via-[#FCF6E6] to-[#F4EAD2]'
            : 'bg-gradient-to-r from-[#F4EAD2] via-[#FCF6E6] to-[#F4EAD2] dark:from-[#1E252D] dark:via-[#232B35] dark:to-[#1E252D]'
        }`}
      >
        <span
          className={`text-[11px] font-medium ${
            useV4Paper ? 'text-[#7D663A]' : 'text-[#7D663A] dark:text-[#C9A86A]'
          }`}
        >
          {ch.revelation_place === 'makkah' ? 'مكية' : 'مدنية'}
        </span>
        <div className="text-center">
          {tajweedEnabled && qbsmlReady ? (
            <div
              style={{ fontFamily: "'QCF4_QBSML', 'Amiri Quran', serif" }}
              className="text-3xl sm:text-4xl leading-none text-stone-900 py-0.5"
              aria-label={`سورة ${ch.name_arabic}`}
            >
              {String.fromCodePoint(61696 + ch.id - 1)}
            </div>
          ) : (
            <span
              className={`font-quran text-2xl sm:text-3xl ${
                useV4Paper ? 'text-stone-900' : 'text-stone-900 dark:text-stone-100'
              }`}
            >
              سُورَةُ {ch.name_arabic}
            </span>
          )}
          <span
            className={`block text-[10px] ${
              useV4Paper ? 'text-[#7D663A]' : 'text-[#7D663A] dark:text-[#C9A86A]'
            }`}
            dir="ltr"
          >
            Surah {ch.name_simple} · {ch.verses_count} Ayahs
          </span>
        </div>
        <span
          className={`text-[11px] font-medium ${
            useV4Paper ? 'text-[#7D663A]' : 'text-[#7D663A] dark:text-[#C9A86A]'
          }`}
        >
          {toArabicIndicDigits(ch.verses_count)} آية
        </span>
      </div>

      {showBismillah && (
        <div
          className={`text-center font-quran text-2xl sm:text-[27px] py-0.5 ${
            useV4Paper ? 'text-stone-900' : 'text-stone-900 dark:text-stone-100'
          }`}
        >
          بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 space-y-4">
      {/* Bilingual Mushaf Toolbar (Arabic first, small English below) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141A21]">
        {/* Surah & Page Navigation */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="اختر السورة / Jump to Surah"
            value={primarySurah?.id || 1}
            onChange={(e) => {
              const ch = chapters.find((c) => c.id === Number(e.target.value));
              if (ch) onChangePage(ch.pages[0]);
            }}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus-visible:outline-2 focus-visible:outline-emerald-700"
          >
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.id}. سورة {ch.name_arabic} · {ch.name_simple}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onChangePage(Math.max(1, page - 1))}
              disabled={page <= 1}
              aria-label="الصفحة السابقة / Previous Page"
              className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-xs font-mono-tabular">
              <span className="text-stone-600 dark:text-stone-400">صفحة</span>
              <input
                type="number"
                min={1}
                max={604}
                value={page}
                onChange={(e) => {
                  const p = Number(e.target.value);
                  if (p >= 1 && p <= 604) onChangePage(p);
                }}
                aria-label="رقم الصفحة / Page Number"
                className="w-11 text-center font-semibold bg-transparent text-stone-900 dark:text-stone-100 focus:outline-none"
              />
              <span className="text-stone-400">/ 604</span>
            </div>
            <button
              type="button"
              onClick={() => onChangePage(Math.min(604, page + 1))}
              disabled={page >= 604}
              aria-label="الصفحة التالية / Next Page"
              className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-xs text-stone-500 dark:text-stone-400 hidden lg:inline">
            الجزء {toArabicIndicDigits(currentJuz)} · الحزب {toArabicIndicDigits(currentHizb)}
            <span className="text-[10px] text-stone-400 ml-1.5">
              (Juz {currentJuz} · KFGQPC V4)
            </span>
          </span>
        </div>

        {/* Layout Mode + Display Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher: Proper 15-Line Mushaf vs Flowing Ayah-by-Ayah */}
          <div className="inline-flex items-center rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 p-0.5">
            <button
              type="button"
              onClick={() => {
                setViewMode('mushaf');
                setShowWbw(false);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'mushaf'
                  ? 'bg-emerald-800 text-white font-semibold'
                  : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="text-left leading-tight">
                <span className="block">مصحف الصفحة</span>
                <span className={`block text-[9px] ${viewMode === 'mushaf' ? 'text-emerald-100' : 'text-stone-400'}`}>
                  15-Line Mushaf
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ayah')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
                viewMode === 'ayah'
                  ? 'bg-emerald-800 text-white font-semibold'
                  : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
              }`}
            >
              <AlignJustify className="w-3.5 h-3.5" />
              <span className="text-left leading-tight">
                <span className="block">آية بآية</span>
                <span className={`block text-[9px] ${viewMode === 'ayah' ? 'text-emerald-100' : 'text-stone-400'}`}>
                  Ayah Flow
                </span>
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setTajweedEnabled((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              tajweedEnabled
                ? 'border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300'
                : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span className="text-left leading-tight">
              <span className="block">{tajweedEnabled ? 'التجويد (V4)' : 'الرسم العثماني'}</span>
              <span className="block text-[9px] opacity-75">
                {tajweedEnabled ? 'Tajweed 1441H' : 'Uthmani Plain'}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={handleToggleWbw}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              showWbw
                ? 'border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300'
                : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span className="text-left leading-tight">
              <span className="block">معاني الكلمات</span>
              <span className="block text-[9px] opacity-75">Word-by-Word</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowTranslations((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              showTranslations
                ? 'border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300'
                : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="text-left leading-tight">
              <span className="block">ترجمة الآية</span>
              <span className="block text-[9px] opacity-75">Translation</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowLegend((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="text-left leading-tight">
              <span className="block">دليل الألوان</span>
              <span className="block text-[9px] opacity-75">Tajweed Key</span>
            </span>
          </button>
        </div>
      </div>

      {/* Collapsible Tajweed Legend */}
      {showLegend && (
        <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141A21]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-stone-900 dark:text-stone-100">
              دليل ألوان التجويد — مصحف المدينة ١٤٤١هـ
              <span className="text-[10px] font-normal text-stone-500 ml-2">
                KFGQPC V4 (1441H Print) Tajweed Color Key
              </span>
            </h3>
            <button
              type="button"
              onClick={() => setShowLegend(false)}
              className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
            >
              إغلاق · Close
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
            {TAJWEED_LEGEND_ITEMS.map((item) => (
              <div key={item.key} className="flex items-center gap-2.5 p-2 rounded-lg bg-stone-50 dark:bg-stone-900/50">
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <div dir="rtl" className="font-quran text-base text-stone-800 dark:text-stone-200">
                    {item.arabic}
                  </div>
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 truncate">{item.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Selected Word Bar in Proper Mushaf Mode */}
      {viewMode === 'mushaf' && selectedWordObj && (
        <div className="px-4 py-2.5 rounded-xl border border-emerald-700/30 bg-emerald-50/70 dark:bg-emerald-950/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span dir="rtl" className="font-quran text-2xl text-stone-900 dark:text-stone-100">
              {selectedWordObj.text_uthmani}
            </span>
            <div>
              <div className="font-medium text-stone-900 dark:text-stone-100">
                {selectedWordObj.translation?.text || '—'}
              </div>
              <div className="text-[11px] text-stone-500 dark:text-stone-400 font-mono-tabular">
                {selectedWordObj.location}
                {selectedWordObj.transliteration?.text ? ` · ${selectedWordObj.transliteration.text}` : ''}
              </div>
            </div>
          </div>
          {selectedAyahKey && (
            <button
              type="button"
              onClick={() => {
                const [s, a] = selectedAyahKey.split(':').map(Number);
                onOpenFullGraph(s, a);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-800 text-white hover:bg-emerald-900"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>فتح المختبر النحوي · Expand Graph</span>
            </button>
          )}
        </div>
      )}

      {/* Main Split Layout: Mushaf Canvas + Optional Integrated Dependency Graph Drawer */}
      <div
        className={`grid gap-6 items-start ${
          selectedAyahKey ? 'grid-cols-1 xl:grid-cols-[1.05fr_0.95fr]' : 'grid-cols-1'
        }`}
      >
        {/* LEFT: Mushaf Canvas */}
        <div className="flex flex-col items-center w-full">
          {viewMode === 'mushaf' ? (
            /* MODE 1: PROPER 15-LINE MADANI MUSHAF — single-line fluid cqw scaling so NO mid-line wrap gaps ever happen */
            <div
              className={`w-full ${
                selectedAyahKey ? 'max-w-[740px]' : 'max-w-[820px]'
              } rounded-2xl p-2 sm:p-3 border shadow-sm ${
                useV4Paper
                  ? 'bg-[#F6F1E3] border-[#D7C9A9]'
                  : 'bg-[#F6F1E3] dark:bg-[#12171E] border-[#D7C9A9] dark:border-[#2C3440]'
              }`}
            >
              <div
                className={`mushaf-sheet relative rounded-xl border-2 px-3 sm:px-7 py-5 ${
                  useV4Paper
                    ? 'border-[#B58833]/50 bg-[#FCF9F0] text-stone-900'
                    : 'border-[#B58833]/45 dark:border-[#B58833]/35 bg-[#FCF9F0] dark:bg-[#151B23]'
                }`}
              >
                {/* Top Mushaf Running Header */}
                <div
                  className={`flex items-center justify-between text-xs pb-2.5 mb-3 border-b border-[#B58833]/25 ${
                    useV4Paper ? 'text-[#7D663A]' : 'text-[#7D663A] dark:text-[#C5A467]'
                  }`}
                >
                  <span className="font-medium">
                    الجزء {toArabicIndicDigits(currentJuz)}
                  </span>
                  <span className="font-quran text-base sm:text-lg">
                    {surahsOnPage.map((s) => `سُورَةُ ${s.name_arabic}`).join(' · ')}
                  </span>
                  <span className="font-mono-tabular">ص {toArabicIndicDigits(page)}</span>
                </div>

                {loading ? (
                  <div className="py-32 flex flex-col items-center justify-center gap-3 text-stone-500">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
                    <span className="text-sm">جاري تحميل الصفحة {page} · Loading Mushaf Page {page}…</span>
                  </div>
                ) : error ? (
                  <div className="py-20 text-center text-sm text-red-600">{error}</div>
                ) : (
                  <div dir="rtl" className={`space-y-1.5 ${tajweedEnabled ? 'tajweed-enabled' : ''}`}>
                    {mushafLines.lineNumbers.map((lineNum) => {
                      const headerMeta = mushafLines.surahHeaderAtLine.get(lineNum);
                      const lineEntries = mushafLines.byLine.get(lineNum) || [];

                      // Keep every Madani Mushaf line on ONE clean justified row using container-width units (cqw)
                      const isShortCenteredLine = page <= 2 || lineEntries.length <= 4;
                      const glyphSizeStyle = {
                        fontSize:
                          page <= 2
                            ? 'clamp(15px, 4.4cqw, 31px)'
                            : v4FontReady && tajweedEnabled
                            ? 'clamp(12px, 3.6cqw, 28px)'
                            : 'clamp(11px, 3.1cqw, 24px)',
                      };

                      return (
                        <React.Fragment key={lineNum}>
                          {headerMeta && renderSurahHeaderBanner(headerMeta.chapter, headerMeta.showBismillah)}

                          {lineEntries.length > 0 && (
                            <div
                              className={`flex flex-nowrap items-center ${
                                isShortCenteredLine
                                  ? 'justify-center gap-x-[1.6cqw]'
                                  : 'justify-between gap-x-[0.5cqw]'
                              } py-[0.35cqw] border-b border-stone-200/45 last:border-b-0 overflow-hidden`}
                            >
                              {lineEntries.map(({ verse, word }) => {
                                const isAyahSelected = selectedAyahKey === verse.verse_key;
                                const isAyahPlaying = activePlayingAyahKey === verse.verse_key;
                                const isWordSelected = isAyahSelected && selectedWordPos === word.position;
                                const wordPage = word.v2_page || page;
                                const canRenderV4Glyph = tajweedEnabled && v4FontReady && Boolean(word.code_v2);

                                if (word.char_type_name === 'end') {
                                  return (
                                    <button
                                      key={word.id}
                                      type="button"
                                      onClick={() => handleSelectAyahGraph(verse.verse_key, 1, word)}
                                      title={`مخطط الإعراب للآية ${verse.verse_key} · Dependency Graph`}
                                      className={`inline-flex items-center justify-center shrink-0 px-0.5 rounded-full transition-all leading-none ${
                                        isAyahSelected
                                          ? 'ring-2 ring-emerald-700 bg-emerald-100/80'
                                          : isAyahPlaying
                                          ? 'ring-2 ring-amber-600 bg-amber-100/70'
                                          : 'hover:bg-emerald-50/80'
                                      }`}
                                    >
                                      {canRenderV4Glyph ? (
                                        <span
                                          style={{
                                            fontFamily: `'QCF_V4_P${wordPage}', 'Amiri Quran', serif`,
                                            ...glyphSizeStyle,
                                          }}
                                          className="leading-[1.65] whitespace-nowrap"
                                        >
                                          {word.code_v2}
                                        </span>
                                      ) : (
                                        <span
                                          style={glyphSizeStyle}
                                          className="font-quran leading-[1.65] text-[#8E651C] whitespace-nowrap"
                                        >
                                          ۝{toArabicIndicDigits(verse.verse_number)}
                                        </span>
                                      )}
                                    </button>
                                  );
                                }

                                return (
                                  <button
                                    key={word.id}
                                    type="button"
                                    onClick={() => handleSelectAyahGraph(verse.verse_key, word.position, word)}
                                    className={`inline-flex items-center px-[0.25cqw] rounded transition-colors shrink-0 ${
                                      isWordSelected
                                        ? 'bg-emerald-200/80 ring-1 ring-emerald-700/60'
                                        : isAyahPlaying
                                        ? 'bg-amber-100/80'
                                        : isAyahSelected
                                        ? 'bg-emerald-50/90'
                                        : 'hover:bg-stone-200/50'
                                    }`}
                                  >
                                    {canRenderV4Glyph ? (
                                      <span
                                        style={{
                                          fontFamily: `'QCF_V4_P${wordPage}', 'Amiri Quran', serif`,
                                          ...glyphSizeStyle,
                                        }}
                                        className="leading-[1.72] text-stone-900 whitespace-nowrap"
                                      >
                                        {word.code_v2}
                                      </span>
                                    ) : (
                                      <span
                                        style={glyphSizeStyle}
                                        className={`font-quran leading-[1.72] whitespace-nowrap ${
                                          useV4Paper ? 'text-stone-900' : 'text-stone-900 dark:text-stone-100'
                                        }`}
                                      >
                                        {tajweedEnabled && word.text_uthmani_tajweed
                                          ? renderTajweedText(word.text_uthmani_tajweed, word.text_uthmani)
                                          : word.text_uthmani}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}

                {/* Bottom Mushaf Page Navigation Footer */}
                <div
                  className={`mt-5 pt-3 border-t border-[#B58833]/25 flex items-center justify-between text-xs ${
                    useV4Paper ? 'text-[#7D663A]' : 'text-[#7D663A] dark:text-[#C5A467]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onChangePage(Math.min(604, page + 1))}
                    disabled={page >= 604}
                    className="hover:underline disabled:opacity-40"
                  >
                    ← الصفحة التالية ({Math.min(604, page + 1)})
                  </button>
                  <span className="font-quran text-base">{toArabicIndicDigits(page)}</span>
                  <button
                    type="button"
                    onClick={() => onChangePage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="hover:underline disabled:opacity-40"
                  >
                    الصفحة السابقة ({Math.max(1, page - 1)}) →
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* MODE 2: FLOWING AYAH-BY-AYAH READER — ideal for mobile, split-tab, and Word-by-Word study with zero jagged line gaps */
            <div className="w-full max-w-[860px] space-y-3">
              {loading ? (
                <div className="py-24 flex flex-col items-center justify-center gap-3 text-stone-500 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141A21]">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
                  <span className="text-sm">جاري تحميل الآيات · Loading Ayahs…</span>
                </div>
              ) : error ? (
                <div className="py-20 text-center text-sm text-red-600">{error}</div>
              ) : (
                verses.map((v) => {
                  const [s, a] = v.verse_key.split(':').map(Number);
                  const ch = chapters.find((c) => c.id === s);
                  const showHeader = v.verse_number === 1 && ch;
                  const showBismillah = showHeader && s !== 1 && s !== 9;
                  const isAyahSelected = selectedAyahKey === v.verse_key;
                  const isAyahPlaying = activePlayingAyahKey === v.verse_key;
                  const cleanTrans = (v.translations?.[0]?.text || '').replace(/<[^>]+>/g, '');

                  return (
                    <React.Fragment key={v.verse_key}>
                      {showHeader && ch && (
                        <div className="rounded-xl p-3 bg-[#FCF9F0] border border-[#D7C9A9]">
                          {renderSurahHeaderBanner(ch, Boolean(showBismillah))}
                        </div>
                      )}

                      <div
                        className={`rounded-xl border p-4 sm:p-5 transition-colors ${
                          isAyahSelected
                            ? 'border-emerald-700 ring-1 ring-emerald-700/30'
                            : isAyahPlaying
                            ? 'border-amber-600'
                            : 'border-[#D7C9A9]/80 dark:border-stone-800'
                        } ${useV4Paper ? 'bg-[#FCF9F0] text-stone-900' : 'bg-white dark:bg-[#141A21]'}`}
                      >
                        {/* Top Compact Ayah Coordinate + Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#B58833]/20">
                          <span className="font-mono-tabular text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                            {ch?.name_arabic} · {toArabicIndicDigits(s)}:{toArabicIndicDigits(a)}{' '}
                            <span className="text-[10px] font-normal text-stone-400">({v.verse_key})</span>
                          </span>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onPlayFromAyah(s, a)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-stone-300/80 dark:border-stone-700 bg-white/80 dark:bg-stone-900 text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                            >
                              <Play className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                              <span>استماع</span>
                              <span className="text-[10px] opacity-65">Play</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectAyahGraph(v.verse_key, 1, undefined, 'tafsir')}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                                isAyahSelected && inspectorTab === 'tafsir'
                                  ? 'bg-amber-800 text-white'
                                  : 'bg-amber-50/90 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 border border-amber-700/30 hover:bg-amber-100/80'
                              }`}
                            >
                              <BookMarked className="w-3.5 h-3.5" />
                              <span>تفسير السعدي</span>
                              <span className="text-[10px] opacity-75">Tafsir</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectAyahGraph(v.verse_key, 1, undefined, 'grammar')}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                isAyahSelected && inspectorTab === 'grammar'
                                  ? 'bg-emerald-800 text-white'
                                  : 'bg-emerald-800/10 text-emerald-900 dark:text-emerald-300 border border-emerald-700/30 hover:bg-emerald-800/20'
                              }`}
                            >
                              <GitBranch className="w-3.5 h-3.5" />
                              <span>الإعراب والرسم الشجري</span>
                              <span className="text-[10px] opacity-75">Graph</span>
                            </button>
                          </div>
                        </div>

                        {/* Pure Continuous Flowing Ayah Text (No artificial Madani line breaks!) */}
                        <div
                          dir="rtl"
                          className={`flex flex-wrap items-start gap-x-2 gap-y-2.5 leading-relaxed ${
                            tajweedEnabled ? 'tajweed-enabled' : ''
                          }`}
                        >
                          {v.words.map((word) => {
                            const isWordSelected = isAyahSelected && selectedWordPos === word.position;
                            const wordPage = word.v2_page || page;
                            const canRenderV4Glyph = tajweedEnabled && v4FontReady && Boolean(word.code_v2);

                            if (word.char_type_name === 'end') {
                              return (
                                <button
                                  key={word.id}
                                  type="button"
                                  onClick={() => handleSelectAyahGraph(v.verse_key, 1, word)}
                                  className="inline-flex items-center justify-center px-1 self-center"
                                >
                                  {canRenderV4Glyph ? (
                                    <span
                                      style={{ fontFamily: `'QCF_V4_P${wordPage}', 'Amiri Quran', serif` }}
                                      className="text-[28px] sm:text-[31px] leading-[1.7]"
                                    >
                                      {word.code_v2}
                                    </span>
                                  ) : (
                                    <span className="font-quran text-2xl text-[#8E651C]">
                                      ۝{toArabicIndicDigits(v.verse_number)}
                                    </span>
                                  )}
                                </button>
                              );
                            }

                            return (
                              <button
                                key={word.id}
                                type="button"
                                onClick={() => handleSelectAyahGraph(v.verse_key, word.position, word)}
                                className={`inline-flex flex-col items-center px-1.5 py-0.5 rounded-lg transition-colors ${
                                  isWordSelected
                                    ? 'bg-emerald-200/75 ring-1 ring-emerald-700/50'
                                    : 'hover:bg-stone-200/50'
                                }`}
                              >
                                {canRenderV4Glyph ? (
                                  <span
                                    style={{ fontFamily: `'QCF_V4_P${wordPage}', 'Amiri Quran', serif` }}
                                    className="text-[27px] sm:text-[31px] leading-[1.75] text-stone-900"
                                  >
                                    {word.code_v2}
                                  </span>
                                ) : (
                                  <span
                                    className={`font-quran text-[26px] sm:text-[29px] leading-[1.8] ${
                                      useV4Paper ? 'text-stone-900' : 'text-stone-900 dark:text-stone-100'
                                    }`}
                                  >
                                    {tajweedEnabled && word.text_uthmani_tajweed
                                      ? renderTajweedText(word.text_uthmani_tajweed, word.text_uthmani)
                                      : word.text_uthmani}
                                  </span>
                                )}

                                {showWbw && word.translation?.text && (
                                  <span
                                    dir="ltr"
                                    className={`text-[10px] leading-tight max-w-[96px] truncate font-sans pb-0.5 ${
                                      useV4Paper ? 'text-stone-600' : 'text-stone-600 dark:text-stone-400'
                                    }`}
                                    title={word.translation.text}
                                  >
                                    {word.translation.text}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {showTranslations && cleanTrans && (
                          <p
                            dir="ltr"
                            className={`mt-3 pt-2.5 border-t border-[#B58833]/20 text-xs leading-relaxed ${
                              useV4Paper ? 'text-stone-600' : 'text-stone-600 dark:text-stone-300'
                            }`}
                          >
                            {cleanTrans}
                          </p>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })
              )}

              {/* Bottom Page Controls in Ayah Flow Mode */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141A21] text-xs">
                <button
                  type="button"
                  onClick={() => onChangePage(Math.min(604, page + 1))}
                  disabled={page >= 604}
                  className="font-medium text-emerald-800 dark:text-emerald-400 hover:underline disabled:opacity-40"
                >
                  ← الصفحة التالية ({Math.min(604, page + 1)})
                </button>
                <span className="font-mono-tabular text-stone-500">صفحة {toArabicIndicDigits(page)} / 604</span>
                <button
                  type="button"
                  onClick={() => onChangePage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="font-medium text-emerald-800 dark:text-emerald-400 hover:underline disabled:opacity-40"
                >
                  الصفحة السابقة ({Math.max(1, page - 1)}) →
                </button>
              </div>
            </div>
          )}

          {/* Per-Ayah Action Strip below Proper Mushaf View */}
          {viewMode === 'mushaf' && verses.length > 0 && (
            <div className="w-full max-w-[820px] mt-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141A21] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                    آيات الصفحة {toArabicIndicDigits(page)} — مخطط الإعراب والاستماع
                  </h3>
                  <div className="text-[10px] text-stone-500 dark:text-stone-400">
                    Ayahs on Page {page} · Open Dependency Graph or Recite
                  </div>
                </div>
              </div>
              <div className="divide-y divide-stone-100 dark:divide-stone-800/80">
                {verses.map((v) => {
                  const [s, a] = v.verse_key.split(':').map(Number);
                  const isSel = selectedAyahKey === v.verse_key;
                  const cleanTrans = (v.translations?.[0]?.text || '').replace(/<[^>]+>/g, '');
                  return (
                    <div
                      key={v.verse_key}
                      className={`py-2.5 px-2 rounded-lg flex flex-wrap items-center justify-between gap-3 ${
                        isSel ? 'bg-emerald-50/70 dark:bg-emerald-950/25' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-tabular text-xs font-semibold text-emerald-800 dark:text-emerald-400 shrink-0">
                            {v.verse_key}
                          </span>
                          {showTranslations && cleanTrans ? (
                            <span className="text-xs text-stone-600 dark:text-stone-300 truncate">
                              {cleanTrans}
                            </span>
                          ) : (
                            <span dir="rtl" className="font-quran text-base text-stone-700 dark:text-stone-300 truncate">
                              {v.words
                                .filter((w) => w.char_type_name === 'word')
                                .slice(0, 6)
                                .map((w) => w.text_uthmani)
                                .join(' ')}
                              {v.words.length > 7 ? ' …' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onPlayFromAyah(s, a)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap"
                        >
                          <Play className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                          <span>استماع</span>
                          <span className="text-[10px] opacity-65">Play</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectAyahGraph(v.verse_key, 1, undefined, 'tafsir')}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                            isSel && inspectorTab === 'tafsir'
                              ? 'bg-amber-800 text-white'
                              : 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 border border-amber-700/30 hover:bg-amber-100/80'
                          }`}
                        >
                          <BookMarked className="w-3.5 h-3.5" />
                          <span>تفسير السعدي</span>
                          <span className="text-[10px] opacity-75">Tafsir</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectAyahGraph(v.verse_key, 1, undefined, 'grammar')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                            isSel && inspectorTab === 'grammar'
                              ? 'bg-emerald-800 text-white'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border border-emerald-700/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                          }`}
                        >
                          <GitBranch className="w-3.5 h-3.5" />
                          <span>المخطط النحوي</span>
                          <span className="text-[10px] opacity-75">Graph</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Integrated Ayah Dependency Graph & Word-by-Word Grammar Panel */}
        {selectedAyahKey && (
          <aside className="xl:sticky xl:top-20 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141A21] overflow-hidden shadow-sm">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-[#11161C]">
              <div className="flex items-center gap-2 min-w-0">
                <GitBranch className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                    إعراب وتراكيب الآية {selectedAyahKey}
                  </div>
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                    Ayah {selectedAyahKey} · Syntax Tree & Morphology
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const [s, a] = selectedAyahKey.split(':').map(Number);
                    onOpenFullGraph(s, a);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>تكبير</span>
                  <span className="text-[10px] opacity-65">Expand</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAyahKey(null)}
                  aria-label="إغلاق لوحة الإعراب / Close Panel"
                  className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-200/70 dark:hover:bg-stone-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawer Tab Switcher: Syntax & Morphology vs Tafsir as-Sa'di */}
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-[#11161C]/70">
              <button
                type="button"
                onClick={() => setInspectorTab('grammar')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  inspectorTab === 'grammar'
                    ? 'bg-emerald-800 text-white'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/70 dark:hover:bg-stone-800'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>المخطط النحوي والإعراب · Graph</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('tafsir')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  inspectorTab === 'tafsir'
                    ? 'bg-amber-800 text-white'
                    : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/70 dark:hover:bg-stone-800'
                }`}
              >
                <BookMarked className="w-3.5 h-3.5" />
                <span>تفسير السعدي · Tafsir</span>
              </button>
            </div>

            <div className="p-4 max-h-[calc(100vh-185px)] overflow-y-auto custom-scrollbar space-y-5">
              {inspectorTab === 'tafsir' ? (
                <TafsirSadiCard
                  surah={Number(selectedAyahKey.split(':')[0])}
                  ayah={Number(selectedAyahKey.split(':')[1])}
                  compact
                />
              ) : lingLoading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-stone-500">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
                  <span className="text-xs">جاري تحميل المخطط النحوي والصرف… Loading…</span>
                </div>
              ) : ayahLing ? (
                <>
                  {ayahLing.verseTranslation && (
                    <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-stone-900/50 p-3 rounded-lg border border-stone-200/70 dark:border-stone-800">
                      {ayahLing.verseTranslation.replace(/<[^>]+>/g, '')}
                    </p>
                  )}

                  <DependencyGraphCanvas
                    graphs={ayahLing.graphs}
                    words={ayahLing.words}
                    hasGoldTreebank={ayahLing.hasGoldTreebank}
                    graphSource={ayahLing.graphSource}
                    ayahKey={ayahLing.ayahKey}
                    selectedWordIndex={selectedWordPos}
                    onSelectWord={(idx) => setSelectedWordPos(idx)}
                  />

                  <WordGrammarInspector
                    data={ayahLing}
                    selectedWordIndex={selectedWordPos}
                    onSelectWord={(idx) => setSelectedWordPos(idx)}
                  />
                </>
              ) : null}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
