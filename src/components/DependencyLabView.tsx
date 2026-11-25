import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, GitBranch, Play, Loader2, AlertCircle } from 'lucide-react';
import { AyahLinguisticsResponse, Chapter } from '../types/quran';
import { DependencyGraphCanvas } from './DependencyGraphCanvas';
import { WordGrammarInspector } from './WordGrammarInspector';
import { TafsirSadiCard } from './TafsirSadiCard';

interface DependencyLabViewProps {
  chapters: Chapter[];
  surah: number;
  ayah: number;
  onChangeCoordinate: (surah: number, ayah: number) => void;
  onPlayAyah?: (surah: number, ayah: number) => void;
}

export const DependencyLabView: React.FC<DependencyLabViewProps> = ({
  chapters,
  surah,
  ayah,
  onChangeCoordinate,
  onPlayAyah,
}) => {
  const [data, setData] = useState<AyahLinguisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(1);

  const currentChapter = chapters.find((c) => c.id === surah);
  const maxAyahs = currentChapter?.verses_count || 7;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/linguistics/ayah/${surah}/${ayah}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: AyahLinguisticsResponse) => {
        if (!cancelled) {
          setData(json);
          setSelectedWordIndex(json.words[0]?.wordIndex ?? null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'تعذر تحميل بيانات الآية · Failed to load Ayah linguistic data');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [surah, ayah]);

  const handlePrevAyah = () => {
    if (ayah > 1) {
      onChangeCoordinate(surah, ayah - 1);
    } else if (surah > 1) {
      const prevCh = chapters.find((c) => c.id === surah - 1);
      onChangeCoordinate(surah - 1, prevCh?.verses_count || 1);
    }
  };

  const handleNextAyah = () => {
    if (ayah < maxAyahs) {
      onChangeCoordinate(surah, ayah + 1);
    } else if (surah < 114) {
      onChangeCoordinate(surah + 1, 1);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Bilingual Coordinate Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141A21]">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor="lab-surah-select" className="sr-only">
              اختر السورة · Select Surah
            </label>
            <select
              id="lab-surah-select"
              value={surah}
              onChange={(e) => onChangeCoordinate(Number(e.target.value), 1)}
              className="px-3 py-2 text-sm font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus-visible:outline-2 focus-visible:outline-emerald-700"
            >
              {chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.id}. سورة {ch.name_arabic} · {ch.name_simple}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="lab-ayah-select" className="text-xs font-medium text-stone-600 dark:text-stone-400">
              الآية <span className="text-[10px] opacity-70">Ayah</span>
            </label>
            <select
              id="lab-ayah-select"
              value={ayah}
              onChange={(e) => onChangeCoordinate(surah, Number(e.target.value))}
              className="px-3 py-2 text-sm font-mono-tabular font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus-visible:outline-2 focus-visible:outline-emerald-700"
            >
              {Array.from({ length: maxAyahs }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} / {maxAyahs}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevAyah}
              disabled={surah === 1 && ayah === 1}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>السابقة</span>
              <span className="text-[10px] opacity-65">Prev</span>
            </button>
            <button
              type="button"
              onClick={handleNextAyah}
              disabled={surah === 114 && ayah === maxAyahs}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 transition-colors"
            >
              <span>التالية</span>
              <span className="text-[10px] opacity-65">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Linguistic Benchmarks */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-500 dark:text-stone-400 mr-1">
            نماذج: <span className="text-[10px] opacity-70">Examples</span>
          </span>
          {[
            { s: 8, a: 12, ar: '٨:١٢ الأنفال', en: 'Al-Anfal 8:12' },
            { s: 1, a: 1, ar: '١:١ البسملة', en: 'Bismillah' },
            { s: 2, a: 255, ar: '٢:٢٥٥ آية الكرسي', en: 'Ayat al-Kursi' },
            { s: 18, a: 1, ar: '١٨:١ الكهف', en: 'Al-Kahf (EQTB)' },
            { s: 112, a: 1, ar: '١١٢:١ الإخلاص', en: 'Al-Ikhlas' },
          ].map((ex) => (
            <button
              key={ex.en}
              type="button"
              onClick={() => onChangeCoordinate(ex.s, ex.a)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-colors whitespace-nowrap shrink-0 text-center leading-tight ${
                surah === ex.s && ayah === ex.a
                  ? 'border-emerald-700 bg-emerald-700 text-white font-semibold'
                  : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <span className="block">{ex.ar}</span>
              <span className="block text-[9px] opacity-75">{ex.en}</span>
            </button>
          ))}

          {onPlayAyah && (
            <button
              type="button"
              onClick={() => onPlayAyah(surah, ayah)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>استماع للآية</span>
              <span className="text-[10px] text-emerald-100">Recite</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-stone-500 dark:text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
          <span className="text-sm">جاري تحليل الشجرة النحوية والصرف للآية {surah}:{ayah}…</span>
          <span className="text-[11px] opacity-70">Analyzing syntax treebank & morphology…</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/20 flex items-center gap-3 text-sm text-red-800 dark:text-red-300">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Ayah Header & Full Arabic Verse + Translation */}
          <div className="p-6 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141A21]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-xs text-stone-500 dark:text-stone-400">
              <div className="flex items-center gap-2">
                <GitBranch className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span className="font-semibold text-stone-900 dark:text-stone-100">
                  سورة {currentChapter?.name_arabic} · الآية {surah}:{ayah}
                </span>
                <span className="text-[10px] text-stone-400">
                  (Surah {currentChapter?.name_simple})
                </span>
              </div>
              <span className="text-xs">
                {data.graphSource === 'qac-gold-treebank' ? (
                  <>
                    <span className="font-medium text-emerald-800 dark:text-emerald-400">
                      المصدر: مدونة إعراب القرآن (QAC v2.0)
                    </span>
                    <span className="text-[10px] text-stone-400 ml-1.5">Quranic Arabic Corpus Gold</span>
                  </>
                ) : (
                  <>
                    <span className="font-medium text-sky-800 dark:text-sky-400">
                      المصدر: شجرة الإعراب الموسعة (نور بيان EQTB)
                    </span>
                    <span className="text-[10px] text-stone-400 ml-1.5">Extended Quranic Treebank</span>
                  </>
                )}
              </span>
            </div>

            <div
              dir="rtl"
              className="text-3xl sm:text-4xl font-quran leading-[2.2] text-stone-900 dark:text-stone-100 text-right py-2"
            >
              {data.verseTextUthmani}
            </div>

            {data.verseTranslation && (
              <p className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                {data.verseTranslation.replace(/<[^>]+>/g, '')}
              </p>
            )}
          </div>

          {/* Interactive SVG Dependency Graph (Pure Arabic corpus.quran.com style) */}
          <DependencyGraphCanvas
            graphs={data.graphs}
            words={data.words}
            hasGoldTreebank={data.hasGoldTreebank}
            graphSource={data.graphSource}
            ayahKey={data.ayahKey}
            selectedWordIndex={selectedWordIndex}
            onSelectWord={(idx) => setSelectedWordIndex(idx)}
          />

          {/* Word-by-Word Grammar + Traditional I'rab */}
          <WordGrammarInspector
            data={data}
            selectedWordIndex={selectedWordIndex}
            onSelectWord={(idx) => setSelectedWordIndex(idx)}
          />

          {/* Authentic Complete Tafsir as-Sa'di */}
          <TafsirSadiCard surah={surah} ayah={ayah} />
        </div>
      ) : null}
    </div>
  );
};
