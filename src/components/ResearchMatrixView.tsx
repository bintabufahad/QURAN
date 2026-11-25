import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Database, Volume2, BookOpen } from 'lucide-react';
import { CoverageSummary, ReciterProfile } from '../types/quran';

interface ResearchMatrixViewProps {
  reciters: ReciterProfile[];
  onNavigateToLab: (surah: number, ayah: number) => void;
}

export const ResearchMatrixView: React.FC<ResearchMatrixViewProps> = ({
  reciters,
  onNavigateToLab,
}) => {
  const [coverage, setCoverage] = useState<CoverageSummary | null>(null);

  useEffect(() => {
    fetch('/api/linguistics/coverage')
      .then((r) => r.json())
      .then((d: CoverageSummary) => setCoverage(d))
      .catch(() => {});
  }, []);

  const featuredReciters = reciters.filter((r) => r.featured);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div
        dir="rtl"
        className="p-6 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141A21]"
      >
        <h1 className="font-ar text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100">
          تدقيق مصادر القرآن والإعراب والتلاوات
        </h1>
        <p className="text-[11px] font-medium text-stone-400">
          Quranic Linguistic, Mushaf & Audio Dataset Audit
        </p>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1.5 max-w-3xl">
          تغطية موثقة بالكامل عبر مصحف مجمع الملك فهد (طبعة ١٤٤١هـ)، ومدونة القرآن الكريم (QAC v2.0)، وشجرة الإعراب الموسعة (NoorBayan EQTB)، ومكتبة MP3Quran v3 — بتغطية شاملة بنسبة ١٠٠٪ لآيات القرآن دون أي تخمين.
        </p>

        {/* Audited Live Counters */}
        {coverage && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5 pt-5 border-t border-stone-200 dark:border-stone-800">
            <div>
              <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                التحليل الصرفي كلمة بكلمة
              </div>
              <div className="text-[10px] text-stone-400">Word-by-Word Morphology</div>
              <div className="text-2xl font-display font-semibold text-stone-900 dark:text-stone-100 font-mono-tabular mt-0.5">
                {coverage.totalQuranWords.toLocaleString()}
              </div>
              <div className="text-xs text-emerald-800 dark:text-emerald-400 mt-0.5">
                ١٠٠٪ من {coverage.totalQuranAyahs.toLocaleString()} آية ({coverage.totalMorphSegments.toLocaleString()} وحدة صرفية)
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                الشجر النحوي المعتمد (QAC v2.0)
              </div>
              <div className="text-[10px] text-stone-400">QAC v2.0 Gold Treebank</div>
              <div className="text-2xl font-display font-semibold text-stone-900 dark:text-stone-100 font-mono-tabular mt-0.5">
                {coverage.goldTreebankAyahs.toLocaleString()} / 6,236
              </div>
              <div className="text-xs text-emerald-800 dark:text-emerald-400 mt-0.5">
                {coverage.goldTreebankCoveragePct}% ({coverage.goldTreebankSurahs} سورة في syntax.txt)
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                التكملة الشجرية (NoorBayan EQTB)
              </div>
              <div className="text-[10px] text-stone-400">Extended Quranic Treebank</div>
              <div className="text-2xl font-display font-semibold text-stone-900 dark:text-stone-100 font-mono-tabular mt-0.5">
                {coverage.eqtbAyahs.toLocaleString()} / 6,236
              </div>
              <div className="text-xs text-sky-800 dark:text-sky-400 mt-0.5">
                {coverage.eqtbCoveragePct}% (التوبة ٩٢–١٢٩ والسور ١٠–٥٨)
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                التغطية الكلية لشجر الإعراب
              </div>
              <div className="text-[10px] text-stone-400">Combined Graph Coverage</div>
              <div className="text-2xl font-display font-semibold text-stone-900 dark:text-stone-100 font-mono-tabular mt-0.5">
                {(coverage.goldTreebankAyahs + coverage.eqtbAyahs).toLocaleString()} / 6,236
              </div>
              <div className="text-xs text-emerald-800 dark:text-emerald-400 mt-0.5">
                ١٠٠٪ موثق بالبيانات · {coverage.irabCoveredAyahs.toLocaleString()} آية إعراب نصي
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Comparison Matrix */}
      <div
        dir="rtl"
        className="p-6 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141A21] space-y-4"
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          <div>
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              مقارنة مصادر البيانات اللغوية والمصحف والصوتيات
            </h2>
            <p className="text-[10px] text-stone-400">
              Linguistic, Mushaf & Audio Provider Comparison
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400">
                <th className="py-2.5 pl-4 font-semibold">
                  المصدر / قاعدة البيانات
                  <span className="block text-[9.5px] font-normal text-stone-400">Provider</span>
                </th>
                <th className="py-2.5 pl-4 font-semibold">
                  التغطية القرآنية
                  <span className="block text-[9.5px] font-normal text-stone-400">Coverage</span>
                </th>
                <th className="py-2.5 pl-4 font-semibold">
                  شجر العلاقات النحوية
                  <span className="block text-[9.5px] font-normal text-stone-400">Dependency Graphs</span>
                </th>
                <th className="py-2.5 pl-4 font-semibold">
                  البنية والبيانات
                  <span className="block text-[9.5px] font-normal text-stone-400">Format</span>
                </th>
                <th className="py-2.5 font-semibold">
                  التقييم والدور في الموقع
                  <span className="block text-[9.5px] font-normal text-stone-400">Role</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800 text-stone-700 dark:text-stone-300">
              <tr>
                <td className="py-3 pl-4 font-semibold text-stone-900 dark:text-stone-100">
                  مدونة القرآن الكريم (QAC v2.0 · ليدز)
                  <div className="text-[10px] font-normal text-stone-400">
                    Quranic Arabic Corpus v2.0
                  </div>
                </td>
                <td className="py-3 pl-4">
                  <span className="text-emerald-800 dark:text-emerald-400 font-medium">
                    ١٠٠٪ صرف (77,429 كلمة)
                  </span>
                  <div className="text-stone-500">٣٩.١٪ شجر نحوي معتمد (2,436 آية)</div>
                </td>
                <td className="py-3 pl-4">
                  السور ١–٨، ٩:١–٩١، و٥٩–١١٤ شاملة التقديرات المحذوفة وأقواس الجمل والعطف
                </td>
                <td className="py-3 pl-4">
                  <code className="font-mono-tabular">syntax.txt</code>،{' '}
                  <code className="font-mono-tabular">quran-morphology.txt</code>،{' '}
                  <code className="font-mono-tabular">irab.tsv</code>
                </td>
                <td className="py-3">
                  المصدر الأساسي المعتمد لـ ٢٬٤٣٦ آية وللتحليل الصرفي والإعراب النصي لكامل القرآن.
                </td>
              </tr>

              <tr>
                <td className="py-3 pl-4 font-semibold text-stone-900 dark:text-stone-100">
                  الشجرة القرآنية الموسعة (NoorBayan EQTB)
                  <div className="text-[10px] font-normal text-stone-400">
                    Extended Quranic Treebank
                  </div>
                </td>
                <td className="py-3 pl-4">
                  <span className="text-sky-800 dark:text-sky-400 font-medium">
                    ١٠٠٪ من القرآن (6,236 آية)
                  </span>
                </td>
                <td className="py-3 pl-4">
                  علاقات إعرابية كاملة وأقواس جمل مطابقة لبنية QAC
                </td>
                <td className="py-3 pl-4">
                  ملف <code className="font-mono-tabular">Quranic.csv</code> ضمن مستودع{' '}
                  <code className="font-mono-tabular">NoorBayan/Quranic</code>
                </td>
                <td className="py-3">
                  يغطي الآيات الـ ٣٬٨٠٠ المكملة التي لم تدخل في syntax.txt (التوبة ٩٢–١٢٩ والسور ١٠–٥٨).
                </td>
              </tr>

              <tr>
                <td className="py-3 pl-4 font-semibold text-stone-900 dark:text-stone-100">
                  مكتبة ترتيل الشاملة (QUL · TarteelAI)
                  <div className="text-[10px] font-normal text-stone-400">QUL Database</div>
                </td>
                <td className="py-3 pl-4">
                  <span className="text-amber-700 dark:text-amber-400 font-medium">
                    جزئية / تحرير مجتمعي
                  </span>
                </td>
                <td className="py-3 pl-4">
                  بها فجوات وتفاوتات معروفة في بعض الآيات
                </td>
                <td className="py-3 pl-4">قواعد بيانات قابلة للتنزيل</td>
                <td className="py-3">
                  تم تجاوزها والاعتماد على دمج QAC v2.0 الأصلي مع NoorBayan EQTB لدقة أعلى وتغطية ١٠٠٪.
                </td>
              </tr>

              <tr>
                <td className="py-3 pl-4 font-semibold text-stone-900 dark:text-stone-100">
                  مصحف مجمع الملك فهد (طبعة ١٤٤١هـ · V4)
                  <div className="text-[10px] font-normal text-stone-400">
                    KFGQPC V4 COLRv1 & Quran.com v4
                  </div>
                </td>
                <td className="py-3 pl-4">
                  <span className="text-emerald-800 dark:text-emerald-400 font-medium">
                    ١٠٠٪ (٦٠٤ صفحات مدنية)
                  </span>
                </td>
                <td className="py-3 pl-4">غير مخصص للإعراب</td>
                <td className="py-3 pl-4">
                  خطوط <code className="font-mono-tabular">COLRv1</code> للتجويد (
                  <code className="font-mono-tabular">p1..p604.woff2</code>) وشعارات السور{' '}
                  <code className="font-mono-tabular">QCF4_QBSML</code>
                </td>
                <td className="py-3">
                  عرض مصحف التجويد الملون مطابقاً تماماً لمصحف المدينة المنورة ذي الـ ١٥ سطراً.
                </td>
              </tr>

              <tr>
                <td className="py-3 pl-4 font-semibold text-stone-900 dark:text-stone-100">
                  تفسير السعدي (مركز تفسير للدراسات القرآنية)
                  <div className="text-[10px] font-normal text-stone-400">
                    Tafsīr al-Sa‘dī · tafsir.app & Quran.com #91
                  </div>
                </td>
                <td className="py-3 pl-4">
                  <span className="text-emerald-800 dark:text-emerald-400 font-medium">
                    ١٠٠٪ (6,236 آية)
                  </span>
                </td>
                <td className="py-3 pl-4">تفسير علمي موثق</td>
                <td className="py-3 pl-4">
                  تيسير الكريم الرحمن في تفسير كلام المنان (النص الأصلي مضبوط الآيات دون تشكيل آلي مضاف)
                </td>
                <td className="py-3">
                  عرض تفسير كل آية مباشرة في المصحف والمختبر النحوي من الطبعة الرقمية المعتمدة.
                </td>
              </tr>

              <tr>
                <td className="py-3 pl-4 font-semibold text-stone-900 dark:text-stone-100">
                  واجهة MP3Quran API v3
                  <div className="text-[10px] font-normal text-stone-400">MP3Quran Audio API</div>
                </td>
                <td className="py-3 pl-4">
                  <span className="text-emerald-800 dark:text-emerald-400 font-medium">
                    أكثر من ١٥٠ قارئاً (كاملة وناقصة)
                  </span>
                </td>
                <td className="py-3 pl-4">صوتيات + توقيت آيات</td>
                <td className="py-3 pl-4">
                  <code className="font-mono-tabular">reciters</code> +{' '}
                  <code className="font-mono-tabular">ayat_timing</code>
                </td>
                <td className="py-3">
                  يشغل منشئ التلاوات المتعدد القراء مع دعم المصاحف المجودة والناقصة والبديل التلقائي.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Two-Column Breakdown: Treebank Coverage Blocks & Audio Reciter Coverage */}
      <div dir="rtl" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141A21] space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <div>
              <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                نطاقات شجر الإعراب الموثقة بنسبة ١٠٠٪
              </h3>
              <p className="text-[10px] text-stone-400">
                100% Dataset-Backed Dependency Graph Ranges
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {(coverage?.goldCoveredRanges || []).map((block) => {
              const isGold = block.source === 'qac-gold-treebank';
              return (
                <div
                  key={block.range}
                  className="p-3.5 rounded-lg border border-stone-200/80 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/40 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                      {block.range}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 flex items-center gap-1.5">
                      {isGold ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <Database className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400 shrink-0" />
                      )}
                      <span>{block.status}</span>
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-xs font-mono-tabular font-semibold text-stone-900 dark:text-stone-100">
                      {block.ayahs.toLocaleString()} آية
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigateToLab(
                          block.range.includes('10–58') ? 18 : block.range.includes('59') ? 67 : 2,
                          1
                        )
                      }
                      className="text-[11px] text-emerald-800 dark:text-emerald-400 hover:underline mt-0.5"
                    >
                      معاينة مثال · Inspect ←
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141A21] space-y-4">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <div>
              <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                تدقيق القراء المعتمدين والتوقيت والمصاحف المجودة
              </h3>
              <p className="text-[10px] text-stone-400">
                Featured Reciters Audio & Timing Audit
              </p>
            </div>
          </div>

          <div className="divide-y divide-stone-100 dark:divide-stone-800 text-xs">
            {featuredReciters.map((r) => (
              <div key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-stone-900 dark:text-stone-100">
                    {r.arabicName || r.name}
                  </div>
                  <div className="text-[10px] text-stone-400">{r.name}</div>
                  <div className="text-stone-500 dark:text-stone-400 mt-0.5 flex items-center gap-1.5">
                    {r.isComplete ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                    <span>
                      {r.hasExactAyahTiming
                        ? 'توقيت دقيق بالمللي ثانية'
                        : 'بث السورة كاملة مع تقسيم تناسبي'}
                      {!r.isComplete && r.missingSurahs.length <= 6
                        ? ` · السور الناقصة: ${r.missingSurahs.join('، ')}`
                        : ''}
                    </span>
                  </div>
                </div>
                <span
                  className={`font-mono-tabular font-semibold shrink-0 ${
                    r.isComplete
                      ? 'text-emerald-800 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {r.surahTotal}/114 سورة
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
