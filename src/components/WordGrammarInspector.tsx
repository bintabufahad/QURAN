import React, { useRef } from 'react';
import { Volume2 } from 'lucide-react';
import { AyahLinguisticsResponse } from '../types/quran';
import { CORPUS_POS_COLOR } from './DependencyGraphCanvas';

interface WordGrammarInspectorProps {
  data: AyahLinguisticsResponse;
  selectedWordIndex: number | null;
  onSelectWord: (wordIndex: number) => void;
}

export const WordGrammarInspector: React.FC<WordGrammarInspectorProps> = ({
  data,
  selectedWordIndex,
  onSelectWord,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playWordPronunciation = (url: string | null | undefined, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!url) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().catch(() => {});
  };

  return (
    <div className="space-y-6">
      {/* Classic Quran Corpus 3-Column Word Grammar Breakdown Table */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141A21] overflow-hidden">
        {/* Section Banner */}
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-stone-50/70 dark:bg-[#11161C]">
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              التفصيل النحوي والصرفي لكلمات الآية (على نمط مدونة القرآن)
            </h3>
            <div className="text-[10px] text-stone-500 dark:text-stone-400">
              Quran Corpus Word-by-Word Syntax & Morphology Breakdown ({data.words.length} words)
            </div>
          </div>
          <span className="text-[11px] text-stone-500 dark:text-stone-400">
            اضغط على أي صف للربط مع الشجرة النحوية أعلاه
          </span>
        </div>

        {/* Exact Corpus Header Strip (Olive-sage band) */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#EEF4DF] dark:bg-[#1E2A1E] border-y border-[#C7D6AB] dark:border-[#344634] text-xs font-semibold text-stone-800 dark:text-stone-200">
                <th className="py-2 px-4 w-[170px] sm:w-[200px]">
                  <span>Translation</span>
                  <span className="block text-[10px] font-normal text-stone-500 dark:text-stone-400">
                    الترجمة والموضع
                  </span>
                </th>
                <th className="py-2 px-4 text-center w-[170px] sm:w-[210px]">
                  <span>Arabic word</span>
                  <span className="block text-[10px] font-normal text-stone-500 dark:text-stone-400">
                    الكلمة وأقسامها
                  </span>
                </th>
                <th className="py-2 px-4">
                  <span>Syntax and morphology</span>
                  <span className="block text-[10px] font-normal text-stone-500 dark:text-stone-400">
                    التحليل النحوي والصرفي والإعراب
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.words.map((word) => {
                const isSelected = selectedWordIndex === word.wordIndex;
                const nonDetSegments = word.segments.filter((s) => s.pos !== 'DET');
                const segCols = nonDetSegments.length > 0 ? nonDetSegments : word.segments;

                return (
                  <tr
                    key={word.location}
                    onClick={() => onSelectWord(word.wordIndex)}
                    className={`cursor-pointer border-b border-dashed border-stone-300 dark:border-stone-700/80 transition-colors ${
                      isSelected
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                        : 'hover:bg-stone-50/80 dark:hover:bg-stone-900/40'
                    }`}
                  >
                    {/* Col 1: Location, Transliteration, WBW English Translation */}
                    <td className="py-4 px-4 align-middle">
                      <div className="flex flex-col items-start gap-0.5 leading-snug">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono-tabular text-stone-500 dark:text-stone-400">
                            ({word.location})
                          </span>
                          {word.wordAudioUrl && (
                            <button
                              type="button"
                              onClick={(e) => playWordPronunciation(word.wordAudioUrl, e)}
                              title="استمع لنطق الكلمة · Listen"
                              aria-label={`نطق ${word.arabicFull}`}
                              className="p-0.5 rounded text-stone-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {word.transliteration && (
                          <span className="text-xs font-medium text-[#3B6EA5] dark:text-sky-400">
                            {word.transliteration}
                          </span>
                        )}
                        {word.wbwTranslation && (
                          <span className="text-xs text-stone-900 dark:text-stone-100">
                            {word.wbwTranslation}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Col 2: Segmented Color-Coded Arabic Word + Dots + POS Tags Underneath */}
                    <td className="py-4 px-4 align-middle text-center">
                      <div className="inline-flex flex-col items-center">
                        {/* Joined Multi-Segment Arabic Word (zero spaces between spans!) */}
                        <div
                          dir="rtl"
                          className="font-corpus-ar text-3xl leading-[1.5] tracking-normal"
                        >
                          {word.segments.map((seg, si) => (
                            <span
                              key={`${word.location}-ar-${si}`}
                              style={{
                                color: CORPUS_POS_COLOR[seg.pos] || '#1E293B',
                              }}
                            >
                              {seg.arabic}
                            </span>
                          ))}
                        </div>

                        {/* Segment Dots & POS Tags directly under the word in RTL order */}
                        <div
                          dir="rtl"
                          className="flex items-start justify-center gap-4 mt-1"
                        >
                          {segCols.map((seg, si) => {
                            const c = CORPUS_POS_COLOR[seg.pos] || '#475569';
                            return (
                              <div
                                key={`${word.location}-tag-${si}`}
                                className="flex flex-col items-center leading-tight"
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full mb-1"
                                  style={{ backgroundColor: c }}
                                />
                                <span
                                  className="text-[11px] font-semibold"
                                  style={{ color: c }}
                                >
                                  {seg.pos}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </td>

                    {/* Col 3: Per-Segment POS Descriptions + Green Arabic Summary Line */}
                    <td className="py-4 px-4 align-middle">
                      <div className="flex flex-col items-end text-right space-y-1">
                        {segCols.map((seg, si) => {
                          const c = CORPUS_POS_COLOR[seg.pos] || '#475569';
                          return (
                            <div
                              key={`${word.location}-desc-${si}`}
                              dir="ltr"
                              className="text-xs text-stone-800 dark:text-stone-200 leading-relaxed"
                            >
                              <span className="font-semibold" style={{ color: c }}>
                                {seg.pos}
                              </span>{' '}
                              – <span>{seg.englishDescription || seg.posLabel.toLowerCase()}</span>
                            </div>
                          );
                        })}

                        {word.corpusArabicLine && (
                          <div
                            dir="rtl"
                            className="font-corpus-label text-[15px] sm:text-[16px] font-normal text-[#15803D] dark:text-emerald-400 pt-0.5 leading-relaxed"
                          >
                            {word.corpusArabicLine}
                          </div>
                        )}

                        {(word.root || word.lemma) && (
                          <div
                            dir="rtl"
                            className="flex items-center gap-3 text-[11px] text-stone-400 dark:text-stone-500 pt-0.5"
                          >
                            {word.root && (
                              <span>
                                الجذر:{' '}
                                <span className="font-corpus-ar text-sm text-amber-800 dark:text-amber-400">
                                  {word.root}
                                </span>
                              </span>
                            )}
                            {word.lemma && (
                              <span>
                                الأصل:{' '}
                                <span className="font-corpus-ar text-sm text-stone-600 dark:text-stone-300">
                                  {word.lemma}
                                </span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
