import React, { useMemo, useRef, useState } from 'react';
import {
  Play,
  Plus,
  Trash2,
  Save,
  Upload,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Search,
  Sparkles,
  Volume2,
  Link as LinkIcon,
  FolderOpen,
  Music2,
} from 'lucide-react';
import {
  Chapter,
  CustomAudioSource,
  CustomRecitationConfig,
  RecitationSegment,
  ReciterProfile,
} from '../types/quran';
import {
  saveAudioBlob,
  deleteAudioBlob,
  saveCustomAudioMeta,
} from '../utils/customAudioStore';

interface RecitationBuilderProps {
  chapters: Chapter[];
  reciters: ReciterProfile[];
  customAudioSources: CustomAudioSource[];
  onUpdateCustomAudioSources: (sources: CustomAudioSource[]) => void;
  savedPlaylists: CustomRecitationConfig[];
  onSavePlaylist: (config: CustomRecitationConfig) => Promise<void>;
  onDeletePlaylist: (id: string) => Promise<void>;
  onStartPlayback: (config: CustomRecitationConfig, startSegmentIdx?: number) => void;
  activeConfigId?: string;
}

export const RecitationBuilder: React.FC<RecitationBuilderProps> = ({
  chapters,
  reciters,
  customAudioSources,
  onUpdateCustomAudioSources,
  savedPlaylists,
  onSavePlaylist,
  onDeletePlaylist,
  onStartPlayback,
  activeConfigId,
}) => {
  const [configName, setConfigName] = useState('تلاوة مخصصة لسورة البقرة (متعددة القراء)');
  const [configId, setConfigId] = useState<string>('draft-baqarah');
  const [surah, setSurah] = useState<number>(2);
  const [autoFallback, setAutoFallback] = useState<boolean>(true);
  const [defaultFallbackId, setDefaultFallbackId] = useState<string>('mp3q-86'); // الشيخ ناصر القطامي

  const [segments, setSegments] = useState<RecitationSegment[]>([
    {
      id: 'seg-1',
      surah: 2,
      startAyah: 1,
      endAyah: 121,
      reciterId: 'mp3q-86', // الشيخ ناصر القطامي
    },
    {
      id: 'seg-2',
      surah: 2,
      startAyah: 122,
      endAyah: 130,
      reciterId: 'mp3q-259', // الشيخ أحمد النفيس (أو استبدله بملف مرفوع)
    },
    {
      id: 'seg-3',
      surah: 2,
      startAyah: 131,
      endAyah: 286,
      reciterId: 'mp3q-253', // الشيخ إسلام صبحي
    },
  ]);

  const [reciterSearch, setReciterSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [customLabelInput, setCustomLabelInput] = useState('');
  const [inlineUrlInputs, setInlineUrlInputs] = useState<Record<string, string>>({});
  const [pendingUploadSegmentIdx, setPendingUploadSegmentIdx] = useState<number | null>(null);

  const libraryFileInputRef = useRef<HTMLInputElement | null>(null);
  const segmentFileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedChapter = chapters.find((c) => c.id === surah);
  const maxAyahs = selectedChapter?.verses_count || 286;

  const reciterMap = useMemo(() => {
    const map = new Map<string, ReciterProfile>();
    for (const r of reciters) map.set(r.id, r);
    return map;
  }, [reciters]);

  const featuredReciters = useMemo(() => reciters.filter((r) => r.featured), [reciters]);

  const filteredCatalog = useMemo(() => {
    const q = reciterSearch.trim().toLowerCase();
    if (!q) return reciters.slice(0, 18);
    return reciters
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.arabicName && r.arabicName.includes(q)) ||
          r.rewaya.toLowerCase().includes(q)
      )
      .slice(0, 24);
  }, [reciters, reciterSearch]);

  const completeFallbackCandidates = useMemo(
    () => reciters.filter((r) => r.isComplete),
    [reciters]
  );

  const handleSurahChange = (newSurah: number) => {
    const ch = chapters.find((c) => c.id === newSurah);
    const total = ch?.verses_count || 7;
    setSurah(newSurah);
    setSegments((prev) =>
      prev.map((seg, idx) => ({
        ...seg,
        surah: newSurah,
        startAyah: idx === 0 ? 1 : Math.min(seg.startAyah, total),
        endAyah: idx === prev.length - 1 ? total : Math.min(seg.endAyah, total),
      }))
    );
  };

  const loadBaqarahExamplePreset = () => {
    setConfigId('preset-baqarah-example');
    setConfigName('سورة البقرة · القطامي + قارئي المفضل + إسلام صبحي');
    setSurah(2);
    setAutoFallback(true);
    setDefaultFallbackId('mp3q-86');
    const customFirst = customAudioSources[0];
    setSegments([
      { id: 'ex-1', surah: 2, startAyah: 1, endAyah: 121, reciterId: 'mp3q-86' },
      {
        id: 'ex-2',
        surah: 2,
        startAyah: 122,
        endAyah: 130,
        reciterId: customFirst ? 'custom-upload' : 'mp3q-51', // تلاوة مرفوعة أو عبد الباسط المجود
        customAudioId: customFirst?.id,
      },
      { id: 'ex-3', surah: 2, startAyah: 131, endAyah: 286, reciterId: 'mp3q-253' },
    ]);
  };

  const loadIncompleteFallbackPreset = () => {
    // سورة الصافات (37) غير متوفرة في مصحف إسلام صبحي (109/114)
    setConfigId('preset-incomplete-fallback');
    setConfigName('سورة الصافات (٣٧) · الانتقال التلقائي للقارئ البديل');
    setSurah(37);
    setAutoFallback(true);
    setDefaultFallbackId('mp3q-86');
    setSegments([
      {
        id: 'inc-1',
        surah: 37,
        startAyah: 1,
        endAyah: 75,
        reciterId: 'mp3q-253', // إسلام صبحي -> يتحول تلقائياً لناصر القطامي
        fallbackReciterId: 'mp3q-86',
      },
      {
        id: 'inc-2',
        surah: 37,
        startAyah: 76,
        endAyah: 182,
        reciterId: 'mp3q-259', // أحمد النفيس
      },
    ]);
  };

  const handleAddSegment = () => {
    const last = segments[segments.length - 1];
    const nextStart = last ? Math.min(maxAyahs, last.endAyah + 1) : 1;
    setSegments((prev) => [
      ...prev,
      {
        id: `seg-${Date.now()}`,
        surah,
        startAyah: nextStart,
        endAyah: maxAyahs,
        reciterId: 'mp3q-86',
      },
    ]);
  };

  const handleSplitSegment = (idx: number) => {
    const seg = segments[idx];
    if (!seg || seg.endAyah - seg.startAyah < 1) return;
    const mid = Math.floor((seg.startAyah + seg.endAyah) / 2);
    const first: RecitationSegment = { ...seg, endAyah: mid };
    const second: RecitationSegment = {
      ...seg,
      id: `seg-${Date.now()}`,
      startAyah: mid + 1,
    };
    const next = [...segments];
    next.splice(idx, 1, first, second);
    setSegments(next);
  };

  const updateSegment = (idx: number, patch: Partial<RecitationSegment>) => {
    setSegments((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeSegment = (idx: number) => {
    if (segments.length <= 1) return;
    setSegments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUploadCustomFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    assignToSegmentIdx: number | null = null
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const id = `custom-${Date.now()}`;
    await saveAudioBlob(id, file);

    const segInfo =
      assignToSegmentIdx !== null ? segments[assignToSegmentIdx] : undefined;
    const defaultLabel = segInfo
      ? `${file.name.replace(/\.[^.]+$/, '')} (${selectedChapter?.name_arabic || `سورة ${segInfo.surah}`} ${segInfo.startAyah}–${segInfo.endAyah})`
      : file.name.replace(/\.[^.]+$/, '');

    const newSource: CustomAudioSource = {
      id,
      label: customLabelInput.trim() || defaultLabel,
      fileName: file.name,
      isLocalUpload: true,
    };
    const updated = [newSource, ...customAudioSources];
    saveCustomAudioMeta(updated);
    onUpdateCustomAudioSources(updated);

    if (assignToSegmentIdx !== null) {
      updateSegment(assignToSegmentIdx, {
        reciterId: 'custom-upload',
        customAudioId: id,
      });
    }

    setCustomLabelInput('');
    setPendingUploadSegmentIdx(null);
    e.target.value = '';
  };

  const handleAddCustomUrl = (assignToSegmentIdx: number | null = null, explicitUrl?: string) => {
    const urlVal = (explicitUrl ?? customUrlInput).trim();
    if (!urlVal) return;
    const id = `custom-url-${Date.now()}`;
    const segInfo =
      assignToSegmentIdx !== null ? segments[assignToSegmentIdx] : undefined;
    const newSource: CustomAudioSource = {
      id,
      label:
        customLabelInput.trim() ||
        (segInfo
          ? `تلاوة خاصة (${selectedChapter?.name_arabic || `سورة ${segInfo.surah}`} ${segInfo.startAyah}–${segInfo.endAyah})`
          : 'رابط تلاوة مخصص'),
      url: urlVal,
      isLocalUpload: false,
    };
    const updated = [newSource, ...customAudioSources];
    saveCustomAudioMeta(updated);
    onUpdateCustomAudioSources(updated);

    if (assignToSegmentIdx !== null && segInfo) {
      updateSegment(assignToSegmentIdx, {
        reciterId: 'custom-upload',
        customAudioId: id,
      });
      setInlineUrlInputs((prev) => ({ ...prev, [segInfo.id]: '' }));
    } else {
      setCustomUrlInput('');
      setCustomLabelInput('');
    }
  };

  const handleDeleteCustomSource = async (source: CustomAudioSource) => {
    if (source.isLocalUpload) {
      await deleteAudioBlob(source.id).catch(() => {});
    }
    const updated = customAudioSources.filter((s) => s.id !== source.id);
    saveCustomAudioMeta(updated);
    onUpdateCustomAudioSources(updated);
  };

  const buildCurrentConfig = (): CustomRecitationConfig => ({
    id: configId,
    name:
      configName.trim() ||
      `تلاوة ${selectedChapter?.name_arabic || `سورة ${surah}`}`,
    surah,
    autoFallback,
    defaultFallbackReciterId: defaultFallbackId,
    segments,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const cfg = buildCurrentConfig();
      await onSavePlaylist(cfg);
      setSaveBanner(`تم حفظ "${cfg.name}" · Saved`);
      setTimeout(() => setSaveBanner(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadPlaylist = (pl: CustomRecitationConfig) => {
    setConfigId(pl.id);
    setConfigName(pl.name);
    setSurah(pl.surah);
    setAutoFallback(pl.autoFallback);
    setDefaultFallbackId(pl.defaultFallbackReciterId);
    setSegments(pl.segments);
  };

  const triggerSegmentUpload = (idx: number) => {
    setPendingUploadSegmentIdx(idx);
    segmentFileInputRef.current?.click();
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Hidden input used by inline segment upload buttons */}
      <input
        ref={segmentFileInputRef}
        type="file"
        accept="audio/*"
        onChange={(e) => handleUploadCustomFile(e, pendingUploadSegmentIdx)}
        className="hidden"
      />

      {/* Top Studio Header & 1-Click Example Presets */}
      <div className="p-5 rounded-2xl border-2 border-[#B6CDA2] bg-[#FCF9F0] text-stone-900 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div dir="rtl" className="text-right">
          <h1 className="font-ar text-xl sm:text-2xl font-bold text-stone-900">
            منشئ التلاوة المخصصة متعدد القراء
          </h1>
          <p className="text-[11px] font-medium text-stone-500">
            Create Your Own Recitation — Multi-Reciter & Custom Audio Studio
          </p>
          <p className="text-xs text-stone-700 mt-1.5 max-w-2xl">
            ادمج عدة قراء في تلاوة واحدة متصلة بحسب نطاق الآيات، وارفع تسجيلات قارئك المفضل مباشرة داخل أي نطاق آيات ثم أكمل الباقي مع الشيخ أحمد النفيس أو إسلام صبحي أو ناصر القطامي أو عبد الباسط المجود.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={loadBaqarahExamplePreset}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#B6CDA2] bg-white text-stone-900 hover:bg-[#B6CDA2]/20 transition-colors text-right"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="leading-tight">
              <span className="block text-xs font-semibold">نموذج البقرة (٣ قراء)</span>
              <span className="block text-[9.5px] text-stone-500">Al-Baqarah 3-Reciter Example</span>
            </span>
          </button>

          <button
            type="button"
            onClick={loadIncompleteFallbackPreset}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#B6CDA2] bg-white text-stone-900 hover:bg-[#B6CDA2]/20 transition-colors text-right"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="leading-tight">
              <span className="block text-xs font-semibold">تجربة البديل التلقائي (الصافات)</span>
              <span className="block text-[9.5px] text-stone-500">Test Missing Surah Fallback</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onStartPlayback(buildCurrentConfig(), 0)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 transition-colors text-right"
          >
            <Play className="w-3.5 h-3.5 shrink-0" />
            <span className="leading-tight">
              <span className="block text-xs font-semibold">تشغيل التلاوة المخصصة</span>
              <span className="block text-[9.5px] text-emerald-100">Play Custom Sequence</span>
            </span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Builder Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.65fr] gap-6 items-start">
        {/* LEFT: Range Composer & Incomplete-Collection Fallback Engine */}
        <div className="space-y-5">
          <div className="p-5 rounded-2xl border-2 border-[#B6CDA2] bg-[#FCF9F0] text-stone-900 space-y-5 shadow-xl">
            {/* Configuration Metadata Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div dir="rtl">
                <label
                  htmlFor="recitation-config-name"
                  className="block text-xs font-semibold text-stone-800 mb-1"
                >
                  اسم التلاوة المخصصة{' '}
                  <span className="text-[10px] font-normal text-stone-500">
                    · Configuration Name
                  </span>
                </label>
                <input
                  id="recitation-config-name"
                  type="text"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#B6CDA2] bg-white text-stone-900 focus-visible:outline-2 focus-visible:outline-emerald-700"
                />
              </div>

              <div dir="rtl">
                <label
                  htmlFor="recitation-surah-select"
                  className="block text-xs font-semibold text-stone-800 mb-1"
                >
                  السورة المختارة{' '}
                  <span className="text-[10px] font-normal text-stone-500">
                    · Target Surah
                  </span>
                </label>
                <select
                  id="recitation-surah-select"
                  value={surah}
                  onChange={(e) => handleSurahChange(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[#B6CDA2] bg-white text-stone-900 focus-visible:outline-2 focus-visible:outline-emerald-700"
                >
                  {chapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.id}. سورة {ch.name_arabic} ({ch.name_simple}) — {ch.verses_count} آية
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Global Incomplete Collection Fallback Policy */}
            <div
              dir="rtl"
              className="p-4 rounded-xl bg-white border border-[#B6CDA2]/70 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-stone-900">
                  سياسة القارئ البديل عند نقص المصحف{' '}
                  <span className="text-[10px] font-normal text-stone-500">
                    · Incomplete Collection Fallback
                  </span>
                </div>
                <p className="text-xs text-stone-600">
                  استبدال القارئ تلقائياً إذا لم يسجل سورة {selectedChapter?.name_arabic || surah}.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoFallback}
                    onChange={(e) => setAutoFallback(e.target.checked)}
                    className="rounded border-[#B6CDA2] text-emerald-700 focus:ring-emerald-700"
                  />
                  <span>تفعيل البديل التلقائي · Auto-Fallback</span>
                </label>

                <select
                  aria-label="القارئ البديل الافتراضي · Default fallback reciter"
                  value={defaultFallbackId}
                  onChange={(e) => setDefaultFallbackId(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-[#B6CDA2] bg-[#FCF9F0] text-stone-900"
                >
                  {completeFallbackCandidates.slice(0, 25).map((r) => (
                    <option key={r.id} value={r.id}>
                      البديل: {r.arabicName || r.name} (١١٤/١١٤)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Visual Timeline Proportion Bar */}
            <div>
              <div dir="rtl" className="flex items-center justify-between text-xs text-stone-600 mb-1.5">
                <span>
                  المخطط الزمني لتلاوة سورة {selectedChapter?.name_arabic || surah}{' '}
                  <span className="text-[10px] text-stone-500">· Coverage Timeline</span>
                </span>
                <span className="font-mono-tabular">
                  الآيات 1 – {maxAyahs}
                </span>
              </div>
              <div className="h-3 w-full rounded-md bg-white border border-[#B6CDA2]/60 overflow-hidden flex">
                {segments.map((seg, idx) => {
                  const span = Math.max(1, seg.endAyah - seg.startAyah + 1);
                  const widthPct = Math.min(100, (span / maxAyahs) * 100);
                  const colors = ['#0F6E54', '#B58833', '#0369A1', '#7C3AED', '#B91C1C'];
                  const rec = reciterMap.get(seg.reciterId);
                  const isMissing =
                    seg.reciterId !== 'custom-upload' &&
                    rec &&
                    !rec.availableSurahs.includes(seg.surah);

                  return (
                    <div
                      key={seg.id}
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: isMissing ? '#D97706' : colors[idx % colors.length],
                      }}
                      className="h-full border-r border-white/60 transition-all"
                      title={`الآيات ${seg.startAyah}–${seg.endAyah}: ${
                        seg.reciterId === 'custom-upload'
                          ? 'تلاوة مرفوعة (قارئي المفضل)'
                          : rec?.arabicName || rec?.name || seg.reciterId
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Ayah Range Segments List */}
            <div className="space-y-3">
              <div dir="rtl" className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-stone-900">
                  مقاطع نطاقات الآيات ({segments.length}){' '}
                  <span className="text-[10px] font-normal text-stone-500">
                    · Ayah Range Segments
                  </span>
                </h2>
                <button
                  type="button"
                  onClick={handleAddSegment}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#B6CDA2] bg-white text-stone-800 hover:bg-[#B6CDA2]/20 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة نطاق آيات · Add Range</span>
                </button>
              </div>

              {segments.map((seg, idx) => {
                const isCustom = seg.reciterId === 'custom-upload';
                const rec = reciterMap.get(seg.reciterId);
                const isSurahMissing = !isCustom && rec && !rec.availableSurahs.includes(seg.surah);
                const resolvedFallbackId = seg.fallbackReciterId || defaultFallbackId;
                const fallbackRec = reciterMap.get(resolvedFallbackId);

                return (
                  <div
                    key={seg.id}
                    className={`p-4 rounded-xl border transition-colors ${
                      isSurahMissing && !autoFallback
                        ? 'border-amber-400 bg-amber-50'
                        : isCustom
                        ? 'border-emerald-600/50 bg-emerald-50/70'
                        : 'border-[#B6CDA2]/60 bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono-tabular text-xs font-semibold text-stone-500 w-6">
                        0{idx + 1}
                      </span>

                      {/* Ayah Start */}
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-stone-700">
                          من آية
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={maxAyahs}
                          value={seg.startAyah}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(maxAyahs, Number(e.target.value) || 1));
                            updateSegment(idx, {
                              startAyah: val,
                              endAyah: Math.max(val, seg.endAyah),
                            });
                          }}
                          className="w-16 px-2 py-1.5 text-xs font-mono-tabular rounded-lg border border-[#B6CDA2] bg-[#FCF9F0] text-stone-900"
                        />
                      </div>

                      {/* Ayah End */}
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-stone-700">
                          إلى آية
                        </label>
                        <input
                          type="number"
                          min={seg.startAyah}
                          max={maxAyahs}
                          value={seg.endAyah}
                          onChange={(e) => {
                            const val = Math.max(
                              seg.startAyah,
                              Math.min(maxAyahs, Number(e.target.value) || seg.startAyah)
                            );
                            updateSegment(idx, { endAyah: val });
                          }}
                          className="w-16 px-2 py-1.5 text-xs font-mono-tabular rounded-lg border border-[#B6CDA2] bg-[#FCF9F0] text-stone-900"
                        />
                      </div>

                      {/* Reciter Selector — Arabic first */}
                      <div className="flex-1 min-w-[230px]">
                        <select
                          dir="rtl"
                          aria-label={`قارئ المقطع ${idx + 1}`}
                          value={seg.reciterId}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            updateSegment(idx, {
                              reciterId: nextId,
                              customAudioId:
                                nextId === 'custom-upload'
                                  ? customAudioSources[0]?.id
                                  : undefined,
                            });
                          }}
                          className="w-full px-3 py-1.5 text-xs font-medium rounded-lg border border-[#B6CDA2] bg-[#FCF9F0] text-stone-900"
                        >
                          <optgroup label="تلاوتي المفضلة (ملف مرفوع / رابط) · Favourite Upload">
                            <option value="custom-upload">
                              تلاوتي المفضلة (رفع ملف صوتي لهذا النطاق) · Custom Upload
                            </option>
                          </optgroup>
                          <optgroup label="القراء المعتمدون · Featured Reciters">
                            {featuredReciters.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.arabicName || r.name} ({r.surahTotal}/114
                                {r.hasExactAyahTiming ? ' · توقيت دقيق' : ' · تلاوة السورة'})
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="بقية القراء (MP3Quran) · All Reciters">
                            {reciters
                              .filter((r) => !r.featured)
                              .slice(0, 80)
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.arabicName || r.name} ({r.surahTotal}/114)
                                </option>
                              ))}
                          </optgroup>
                        </select>
                      </div>

                      {/* Inline 1-Click Upload MP3 button right on EVERY Ayah range */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => triggerSegmentUpload(idx)}
                          title="ارفع ملف MP3 لقارئك المفضل لهذا النطاق مباشرة"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-emerald-700/40 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 transition-colors"
                        >
                          <Upload className="w-3 h-3" />
                          <span>رفع ملف · Upload MP3</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onStartPlayback(buildCurrentConfig(), idx)}
                          title="تشغيل من هذا المقطع · Play from segment"
                          className="p-1.5 rounded-lg border border-[#B6CDA2] bg-[#FCF9F0] text-emerald-800 hover:bg-[#B6CDA2]/25"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSplitSegment(idx)}
                          disabled={seg.endAyah - seg.startAyah < 1}
                          className="px-2 py-1 text-[11px] font-medium rounded-lg border border-[#B6CDA2] bg-[#FCF9F0] text-stone-800 hover:bg-[#B6CDA2]/25 disabled:opacity-40"
                        >
                          تقسيم · Split
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSegment(idx)}
                          disabled={segments.length <= 1}
                          aria-label="حذف المقطع"
                          className="p-1.5 rounded-lg text-stone-500 hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Custom Upload Panel when 'custom-upload' is selected */}
                    {isCustom && (
                      <div
                        dir="rtl"
                        className="mt-3 pt-3 border-t border-emerald-200 space-y-2.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Music2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span className="font-semibold text-stone-800">
                              تسجيل قارئك المفضل لهذا النطاق ({seg.startAyah}–{seg.endAyah}):
                            </span>
                            {customAudioSources.length > 0 ? (
                              <select
                                value={seg.customAudioId || customAudioSources[0].id}
                                onChange={(e) =>
                                  updateSegment(idx, { customAudioId: e.target.value })
                                }
                                className="px-2.5 py-1 rounded-lg border border-[#B6CDA2] bg-white text-stone-900"
                              >
                                {customAudioSources.map((src) => (
                                  <option key={src.id} value={src.id}>
                                    {src.label} ({src.isLocalUpload ? 'ملف محلي' : 'رابط'})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-amber-700">
                                لم يتم رفع ملف صوتي بعد — ارفع ملف MP3 الآن أو الصق رابطاً أدناه.
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => triggerSegmentUpload(idx)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 font-medium"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>
                              {customAudioSources.length > 0
                                ? 'رفع ملف صوتي آخر · Upload another'
                                : 'اختر ملف MP3/WAV من جهازك · Upload File'}
                            </span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="url"
                            placeholder="أو الصق رابط ملف صوتي مباشر لهذا النطاق (Or paste audio URL)…"
                            value={inlineUrlInputs[seg.id] || ''}
                            onChange={(e) =>
                              setInlineUrlInputs((prev) => ({
                                ...prev,
                                [seg.id]: e.target.value,
                              }))
                            }
                            className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-[#B6CDA2] bg-white text-stone-900"
                          />
                          <button
                            type="button"
                            disabled={!(inlineUrlInputs[seg.id] || '').trim()}
                            onClick={() => handleAddCustomUrl(idx, inlineUrlInputs[seg.id])}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#B6CDA2] text-black font-bold hover:bg-[#a3be8c] disabled:opacity-40"
                          >
                            <LinkIcon className="w-3 h-3" />
                            <span>ربط · Attach</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Incomplete Reciter Availability Alert & Manual/Auto Fallback Selector */}
                    {isSurahMissing && (
                      <div
                        dir="rtl"
                        className="mt-3 pt-3 border-t border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2 text-amber-900">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                          <span>
                            سورة {selectedChapter?.name_arabic || seg.surah} غير متوفرة لدى{' '}
                            <strong>{rec.arabicName || rec.name}</strong> ({rec.surahTotal}/114 سورة).
                            {autoFallback && fallbackRec && (
                              <>
                                {' '}
                                <ArrowLeft className="inline w-3 h-3 mx-0.5" /> سيتم التشغيل تلقائياً بصوت{' '}
                                <strong>{fallbackRec.arabicName || fallbackRec.name}</strong>.
                              </>
                            )}
                          </span>
                        </div>

                        <select
                          aria-label="القارئ البديل لهذا المقطع"
                          value={resolvedFallbackId}
                          onChange={(e) =>
                            updateSegment(idx, { fallbackReciterId: e.target.value })
                          }
                          className="px-2.5 py-1 rounded-lg border border-amber-300 bg-[#FCF9F0] text-stone-900"
                        >
                          {completeFallbackCandidates.slice(0, 25).map((r) => (
                            <option key={r.id} value={r.id}>
                              البديل: {r.arabicName || r.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Precision Indicator */}
                    {!isCustom && rec && !isSurahMissing && (
                      <div
                        dir="rtl"
                        className="mt-2 flex items-center gap-2 text-[11px] text-stone-600"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                        <span>
                          سورة {selectedChapter?.name_arabic || seg.surah} متوفرة ·{' '}
                          {rec.hasExactAyahTiming
                            ? 'توقيت دقيق بالمللي ثانية لكل آية (Exact ms timing)'
                            : 'بث صوتي كامل للسورة مع تحديد نطاق الآيات (Surah MP3 stream)'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Save Row */}
            <div className="pt-4 border-t border-[#B6CDA2]/40 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-emerald-800 font-medium">
                {saveBanner || ''}
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-[#B6CDA2] bg-white text-stone-900 hover:bg-[#B6CDA2]/20 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'جارٍ الحفظ…' : 'حفظ الترتيب · Save'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onStartPlayback(buildCurrentConfig(), 0)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>استمع الآن · Listen Now</span>
                </button>
              </div>
            </div>
          </div>

          {/* Saved Custom Recitation Configurations */}
          <div
            dir="rtl"
            className="p-5 rounded-2xl border-2 border-[#B6CDA2] bg-[#FCF9F0] text-stone-900 shadow-xl"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-emerald-800" />
                <h3 className="text-sm font-semibold text-stone-900">
                  التلاوات المحفوظة ({savedPlaylists.length}){' '}
                  <span className="text-[10px] font-normal text-stone-500">
                    · Saved Configurations
                  </span>
                </h3>
              </div>
            </div>

            {savedPlaylists.length === 0 ? (
              <p className="text-xs text-stone-600 py-3">
                لا توجد قوائم محفوظة بعد. رتب المقاطع أعلاه ثم اضغط «حفظ الترتيب» للرجوع إليها في أي وقت.
              </p>
            ) : (
              <div className="divide-y divide-[#B6CDA2]/30">
                {savedPlaylists.map((pl) => {
                  const ch = chapters.find((c) => c.id === pl.surah);
                  const isActive = activeConfigId === pl.id;
                  return (
                    <div
                      key={pl.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-stone-900 truncate">
                          {pl.name}
                        </div>
                        <div className="text-xs text-stone-600">
                          سورة {ch?.name_arabic || pl.surah} ({ch?.name_simple}) · {pl.segments.length} مقاطع
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoadPlaylist(pl)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#B6CDA2] bg-white text-stone-800 hover:bg-[#B6CDA2]/20"
                        >
                          تعديل · Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartPlayback(pl, 0)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg ${
                            isActive
                              ? 'bg-emerald-800 text-white'
                              : 'bg-emerald-50 text-emerald-900 border border-emerald-700/30'
                          }`}
                        >
                          <Play className="w-3 h-3" />
                          <span>تشغيل · Play</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePlaylist(pl.id)}
                          aria-label={`حذف ${pl.name}`}
                          className="p-1.5 text-stone-500 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Custom Favourite Reciter Library + Reciter Coverage Explorer */}
        <div className="space-y-5">
          {/* Custom Favourite Reciter Audio Library */}
          <div
            dir="rtl"
            className="p-5 rounded-2xl border-2 border-[#B6CDA2] bg-[#FCF9F0] text-stone-900 space-y-4 shadow-xl"
          >
            <div>
              <h3 className="text-sm font-semibold text-stone-900">
                مكتبة قارئي المفضل (ملفات مرفوعة)
              </h3>
              <p className="text-[10px] text-stone-500">
                Favourite Reciter Library (Local Uploads & Audio URLs)
              </p>
              <p className="text-xs text-stone-600 mt-1">
                ارفع التسجيلات المتوفرة لديك على جهازك (MP3 / WAV / M4A) لإدراجها في أي نطاق آيات ثم الانتقال تلقائياً لأي قارئ آخر.
              </p>
            </div>

            <div className="space-y-2.5">
              <input
                type="text"
                placeholder="اسم المقطع (مثال: تلاوة نادرة — البقرة ١٢٢–١٣٠)"
                value={customLabelInput}
                onChange={(e) => setCustomLabelInput(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#B6CDA2] bg-white text-stone-900"
              />

              <input
                ref={libraryFileInputRef}
                type="file"
                accept="audio/*"
                onChange={(e) => handleUploadCustomFile(e, null)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => libraryFileInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-dashed border-emerald-700/60 bg-white text-emerald-900 hover:bg-emerald-50 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>رفع ملف صوتي للمكتبة (MP3 / WAV / M4A)</span>
              </button>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="url"
                  placeholder="أو الصق رابط ملف MP3 مباشر…"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[#B6CDA2] bg-white text-stone-900"
                />
                <button
                  type="button"
                  onClick={() => handleAddCustomUrl(null)}
                  disabled={!customUrlInput.trim()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#B6CDA2] text-black hover:bg-[#a3be8c] disabled:opacity-40"
                >
                  <LinkIcon className="w-3 h-3" />
                  <span>إضافة</span>
                </button>
              </div>
            </div>

            {customAudioSources.length > 0 && (
              <div className="pt-3 border-t border-[#B6CDA2]/40 space-y-2">
                {customAudioSources.map((src) => (
                  <div
                    key={src.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-[#B6CDA2]/40 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-stone-900 truncate">
                        {src.label}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {src.isLocalUpload ? `محفوظ محلياً (${src.fileName})` : src.url}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomSource(src)}
                      aria-label={`حذف ${src.label}`}
                      className="p-1 text-stone-500 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reciters & Collection Completeness Directory */}
          <div
            dir="rtl"
            className="p-5 rounded-2xl border-2 border-[#B6CDA2] bg-[#FCF9F0] text-stone-900 space-y-4 shadow-xl"
          >
            <div>
              <h3 className="text-sm font-semibold text-stone-900">
                دليل القراء وتوافر السور ({reciters.length} قارئاً)
              </h3>
              <p className="text-[10px] text-stone-500">
                Reciter Collection Completeness & Mujawwad Editions
              </p>
              <p className="text-xs text-stone-600 mt-1">
                يشمل عبد الباسط والمنشاوي والحصري بالمصحف المجود الأطول، مع القطامي والنفيس والعفاسي وإسلام صبحي.
              </p>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ابحث عن قارئ (عبد الباسط، المنشاوي، الحصري، القطامي)…"
                value={reciterSearch}
                onChange={(e) => setReciterSearch(e.target.value)}
                className="w-full pr-8 pl-3 py-2 text-xs rounded-lg border border-[#B6CDA2] bg-white text-stone-900"
              />
            </div>

            <div className="max-h-[420px] overflow-y-auto custom-scrollbar divide-y divide-[#B6CDA2]/30">
              {filteredCatalog.map((r) => {
                const availableInCurrentSurah = r.availableSurahs.includes(surah);
                return (
                  <div key={r.id} className="py-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-stone-900 truncate">
                          {r.arabicName || r.name}
                        </div>
                        <div className="text-[10px] text-stone-500 truncate">
                          {r.name} · {r.rewaya}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-mono-tabular font-semibold whitespace-nowrap shrink-0 ${
                          r.isComplete ? 'text-emerald-800' : 'text-amber-700'
                        }`}
                      >
                        {r.surahTotal}/114
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-stone-600">
                        {r.hasExactAyahTiming
                          ? 'توقيت دقيق بالآية · Exact Timings'
                          : 'ملف سورة متصلة · Surah MP3'}
                      </span>
                      <span
                        className={
                          availableInCurrentSurah
                            ? 'text-emerald-800'
                            : 'text-amber-700 font-medium'
                        }
                      >
                        {availableInCurrentSurah
                          ? `متوفر في سورة ${selectedChapter?.name_arabic || surah}`
                          : `غير متوفر في سورة ${selectedChapter?.name_arabic || surah}`}
                      </span>
                    </div>

                    {!r.isComplete && r.missingSurahs.length <= 10 && (
                      <div className="text-[11px] text-stone-600 flex items-center gap-1">
                        <Volume2 className="w-3 h-3 shrink-0" />
                        <span>السور الناقصة: {r.missingSurahs.join('، ')}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
