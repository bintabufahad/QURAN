import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  X,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  AyahTiming,
  Chapter,
  CustomAudioSource,
  CustomRecitationConfig,
  QuranVerse,
  ReciterProfile,
} from '../types/quran';
import { getAudioBlobUrl } from '../utils/customAudioStore';

interface RecitationPlayerBarProps {
  config: CustomRecitationConfig | null;
  startSegmentIdx: number;
  chapters: Chapter[];
  reciters: ReciterProfile[];
  customAudioSources: CustomAudioSource[];
  onActiveAyahChange: (ayahKey: string | null) => void;
  onClose: () => void;
}

interface ResolvedSegment {
  segmentIndex: number;
  surah: number;
  startAyah: number;
  endAyah: number;
  effectiveReciterName: string;
  effectiveReciterArabicName?: string;
  isFallbackApplied: boolean;
  originalReciterName?: string;
  originalReciterArabicName?: string;
  isCustomAudio: boolean;
  audioUrl: string;
  hasExactTiming: boolean;
  timingReadId?: number;
}

export const RecitationPlayerBar: React.FC<RecitationPlayerBarProps> = ({
  config,
  startSegmentIdx,
  chapters,
  reciters,
  customAudioSources,
  onActiveAyahChange,
  onClose,
}) => {
  const [segmentIdx, setSegmentIdx] = useState(startSegmentIdx);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentAyah, setCurrentAyah] = useState<number>(1);
  const [resolved, setResolved] = useState<ResolvedSegment | null>(null);
  const [timings, setTimings] = useState<AyahTiming[]>([]);
  const [verses, setVerses] = useState<QuranVerse[]>([]);
  const [progressPct, setProgressPct] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlToRevoke = useRef<string | null>(null);
  const pendingSeekSec = useRef<number | null>(null);

  const reciterMap = useMemo(() => {
    const m = new Map<string, ReciterProfile>();
    for (const r of reciters) m.set(r.id, r);
    return m;
  }, [reciters]);

  // Reset segmentIdx when a new config or explicit segment start arrives
  useEffect(() => {
    setSegmentIdx(startSegmentIdx);
  }, [config, startSegmentIdx]);

  // Resolve current segment audio source & timings
  useEffect(() => {
    if (!config || !config.segments[segmentIdx]) {
      setResolved(null);
      onActiveAyahChange(null);
      return;
    }

    let cancelled = false;
    const seg = config.segments[segmentIdx];
    setErrorMsg(null);
    setIsBuffering(true);
    setCurrentAyah(seg.startAyah);
    onActiveAyahChange(`${seg.surah}:${seg.startAyah}`);

    const resolveSegment = async () => {
      if (blobUrlToRevoke.current) {
        URL.revokeObjectURL(blobUrlToRevoke.current);
        blobUrlToRevoke.current = null;
      }

      // 1. Custom Audio Upload / URL
      if (seg.reciterId === 'custom-upload') {
        const src =
          customAudioSources.find((s) => s.id === seg.customAudioId) ||
          customAudioSources[0];

        if (src) {
          let url = src.url || '';
          if (src.isLocalUpload) {
            const objUrl = await getAudioBlobUrl(src.id);
            if (objUrl) {
              blobUrlToRevoke.current = objUrl;
              url = objUrl;
            }
          }
          if (url && !cancelled) {
            const surahData = await fetch(`/api/surah/${seg.surah}/verses`)
              .then((r) => r.json())
              .catch(() => ({ verses: [] }));
            if (cancelled) return;
            setVerses(surahData.verses || []);
            setTimings([]);
            setResolved({
              segmentIndex: segmentIdx,
              surah: seg.surah,
              startAyah: seg.startAyah,
              endAyah: seg.endAyah,
              effectiveReciterName: src.label,
              effectiveReciterArabicName: `تلاوة مخصصة: ${src.label}`,
              isFallbackApplied: false,
              isCustomAudio: true,
              audioUrl: url,
              hasExactTiming: false,
            });
            pendingSeekSec.current = 0;
            return;
          }
        }
      }

      // 2. MP3Quran Reciter + Incomplete Collection Fallback Check
      let rec = reciterMap.get(seg.reciterId);
      let isFallbackApplied = false;
      let originalReciterName: string | undefined;
      let originalReciterArabicName: string | undefined;

      if (rec && !rec.availableSurahs.includes(seg.surah)) {
        const fbId = seg.fallbackReciterId || config.defaultFallbackReciterId;
        const fbRec = reciterMap.get(fbId) || reciters.find((r) => r.isComplete);
        if (config.autoFallback && fbRec) {
          isFallbackApplied = true;
          originalReciterName = rec.name;
          originalReciterArabicName = rec.arabicName || rec.name;
          rec = fbRec;
        }
      }

      if (!rec) {
        rec = reciters[0];
      }
      if (!rec) {
        if (!cancelled) {
          setErrorMsg('لا يتوفر مصدر صوتي حالياً · No reciter audio available');
          setIsBuffering(false);
        }
        return;
      }

      const padded = String(seg.surah).padStart(3, '0');
      const audioUrl = `${rec.serverUrl}${padded}.mp3`;

      const [timingRes, surahRes] = await Promise.all([
        rec.hasExactAyahTiming && rec.timingReadId
          ? fetch(`/api/recitations/timing/${rec.timingReadId}/${seg.surah}`)
              .then((r) => r.json())
              .catch(() => ({ timings: [] }))
          : Promise.resolve({ timings: [] }),
        fetch(`/api/surah/${seg.surah}/verses`)
          .then((r) => r.json())
          .catch(() => ({ verses: [] })),
      ]);

      if (cancelled) return;

      const loadedTimings: AyahTiming[] = timingRes.timings || [];
      setTimings(loadedTimings);
      setVerses(surahRes.verses || []);

      const startEntry = loadedTimings.find((t) => t.ayah === seg.startAyah);
      pendingSeekSec.current = startEntry ? startEntry.startTimeMs / 1000 : null;

      setResolved({
        segmentIndex: segmentIdx,
        surah: seg.surah,
        startAyah: seg.startAyah,
        endAyah: seg.endAyah,
        effectiveReciterName: rec.name,
        effectiveReciterArabicName: rec.arabicName || rec.name,
        isFallbackApplied,
        originalReciterName,
        originalReciterArabicName,
        isCustomAudio: false,
        audioUrl,
        hasExactTiming: loadedTimings.length > 0,
        timingReadId: rec.timingReadId,
      });

      // Preload next segment MP3 if available
      const nextSeg = config.segments[segmentIdx + 1];
      if (nextSeg && nextSeg.reciterId !== 'custom-upload') {
        let nextRec = reciterMap.get(nextSeg.reciterId);
        if (nextRec && !nextRec.availableSurahs.includes(nextSeg.surah) && config.autoFallback) {
          nextRec = reciterMap.get(nextSeg.fallbackReciterId || config.defaultFallbackReciterId);
        }
        if (nextRec && preloadAudioRef.current) {
          const nextPadded = String(nextSeg.surah).padStart(3, '0');
          preloadAudioRef.current.src = `${nextRec.serverUrl}${nextPadded}.mp3`;
        }
      }
    };

    resolveSegment();

    return () => {
      cancelled = true;
    };
  }, [config, segmentIdx, reciterMap, reciters, customAudioSources]);

  // Compute proportional timings when exact millisecond timings are unavailable
  const computeProportionalTimings = (durationSec: number): AyahTiming[] => {
    if (!verses.length || !durationSec || isNaN(durationSec)) return [];
    const totalChars = verses.reduce((sum, v) => {
      const txt = v.words.map((w) => w.text_uthmani).join(' ');
      return sum + Math.max(8, txt.length);
    }, 0);
    const introOffset =
      resolved && resolved.surah !== 1 && resolved.surah !== 9 && !resolved.isCustomAudio
        ? Math.min(4, durationSec * 0.02)
        : 0;
    const usableDuration = Math.max(1, durationSec - introOffset);
    let cursor = introOffset;

    return verses.map((v) => {
      const txtLen = Math.max(8, v.words.map((w) => w.text_uthmani).join(' ').length);
      const span = (txtLen / totalChars) * usableDuration;
      const startMs = Math.round(cursor * 1000);
      cursor += span;
      const endMs = Math.round(cursor * 1000);
      return {
        ayah: v.verse_number,
        startTimeMs: startMs,
        endTimeMs: endMs,
        precision: 'proportional',
      };
    });
  };

  // Load audio element when resolved changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !resolved) return;

    audio.src = resolved.audioUrl;
    audio.load();

    const onLoadedMetadata = () => {
      let activeTimings = timings;
      if (activeTimings.length === 0 && !resolved.isCustomAudio && audio.duration) {
        activeTimings = computeProportionalTimings(audio.duration);
        setTimings(activeTimings);
      }

      if (pendingSeekSec.current !== null) {
        audio.currentTime = pendingSeekSec.current;
      } else if (activeTimings.length > 0 && !resolved.isCustomAudio) {
        const entry = activeTimings.find((t) => t.ayah === resolved.startAyah);
        if (entry) audio.currentTime = entry.startTimeMs / 1000;
      }

      setIsBuffering(false);
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    };

    const onError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
      setErrorMsg(
        `تعذر تشغيل الصوت من ${resolved.effectiveReciterArabicName || resolved.effectiveReciterName}`
      );
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
    };
  }, [resolved]);

  // Monitor playback progress, update active Ayah, and transition smoothly between segments
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !resolved || !config) return;

    const onTimeUpdate = () => {
      const currMs = audio.currentTime * 1000;

      if (resolved.isCustomAudio) {
        const dur = audio.duration || 1;
        setProgressPct(Math.min(100, (audio.currentTime / dur) * 100));
        return;
      }

      if (timings.length > 0) {
        const startEntry = timings.find((t) => t.ayah === resolved.startAyah);
        const endEntry = timings.find((t) => t.ayah === resolved.endAyah);
        const rangeStartMs = startEntry?.startTimeMs ?? 0;
        const rangeEndMs =
          endEntry?.endTimeMs ?? (audio.duration * 1000 || rangeStartMs + 1000);

        const pct = ((currMs - rangeStartMs) / Math.max(1, rangeEndMs - rangeStartMs)) * 100;
        setProgressPct(Math.max(0, Math.min(100, pct)));

        const matched = timings.find((t) => currMs >= t.startTimeMs && currMs <= t.endTimeMs);
        if (matched && matched.ayah !== currentAyah) {
          const clamped = Math.max(resolved.startAyah, Math.min(resolved.endAyah, matched.ayah));
          setCurrentAyah(clamped);
          onActiveAyahChange(`${resolved.surah}:${clamped}`);
        }

        // Smooth transition to next reciter segment when endAyah finishes
        if (endEntry && currMs >= endEntry.endTimeMs - 120) {
          if (segmentIdx < config.segments.length - 1) {
            setSegmentIdx((i) => i + 1);
          } else {
            audio.pause();
            setIsPlaying(false);
          }
        }
      }
    };

    const onEnded = () => {
      if (segmentIdx < config.segments.length - 1) {
        setSegmentIdx((i) => i + 1);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [resolved, timings, segmentIdx, config, currentAyah]);

  if (!config) return null;

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  const jumpToAyah = (targetAyah: number) => {
    if (!resolved) return;
    if (targetAyah < resolved.startAyah) {
      if (segmentIdx > 0) setSegmentIdx((i) => i - 1);
      return;
    }
    if (targetAyah > resolved.endAyah) {
      if (segmentIdx < config.segments.length - 1) setSegmentIdx((i) => i + 1);
      return;
    }
    const entry = timings.find((t) => t.ayah === targetAyah);
    if (entry && audioRef.current) {
      audioRef.current.currentTime = entry.startTimeMs / 1000;
      setCurrentAyah(targetAyah);
      onActiveAyahChange(`${resolved.surah}:${targetAyah}`);
    }
  };

  const activeChapter = chapters.find((c) => c.id === (resolved?.surah || config.surah));
  const activeVerseObj = verses.find((v) => v.verse_number === currentAyah);

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t-2 border-[#B6CDA2] bg-[#FCF9F0]/95 backdrop-blur-md shadow-xl">
      <audio ref={audioRef} preload="auto" />
      <audio ref={preloadAudioRef} preload="auto" className="hidden" />

      {/* Thin Continuous Progress Line */}
      <div className="h-1 w-full bg-[#B6CDA2]/30">
        <div
          className="h-full bg-emerald-800 transition-all duration-150"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Active Reciter & Segment Context (Arabic first, small English) */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-lg bg-emerald-800 text-white flex items-center justify-center shrink-0">
            {isBuffering ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div dir="rtl" className="flex items-center gap-2 text-xs font-semibold text-stone-900 truncate">
              <span className="truncate">
                {resolved?.effectiveReciterArabicName ||
                  resolved?.effectiveReciterName ||
                  'جارٍ تحميل التلاوة…'}
              </span>
              <span aria-hidden="true" className="text-stone-400">·</span>
              <span className="font-mono-tabular text-emerald-800 shrink-0">
                سورة {activeChapter?.name_arabic || resolved?.surah} ({resolved?.surah}:
                {currentAyah})
              </span>
              <span className="text-[10px] font-normal text-stone-500 hidden sm:inline">
                (النطاق {resolved?.startAyah}–{resolved?.endAyah} · مقطع {segmentIdx + 1}/
                {config.segments.length})
              </span>
            </div>

            {errorMsg ? (
              <div className="text-[11px] text-red-700 truncate">
                {errorMsg}
              </div>
            ) : resolved?.isFallbackApplied ? (
              <div dir="rtl" className="flex items-center gap-1 text-[11px] text-amber-800 truncate">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>
                  البديل التلقائي نشط ({resolved.originalReciterArabicName || resolved.originalReciterName} غير متوفر لسورة {activeChapter?.name_arabic || resolved.surah})
                </span>
              </div>
            ) : activeVerseObj ? (
              <div
                dir="rtl"
                className="font-quran text-sm text-stone-700 truncate max-w-md"
              >
                {activeVerseObj.words
                  .filter((w) => w.char_type_name === 'word')
                  .slice(0, 8)
                  .map((w) => w.text_uthmani)
                  .join(' ')}
              </div>
            ) : (
              <div className="text-[10px] text-stone-600 truncate">
                {resolved?.effectiveReciterName || config.name}
              </div>
            )}
          </div>
        </div>

        {/* Center: Playback Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => jumpToAyah(currentAyah - 1)}
            aria-label="الآية السابقة · Previous Ayah"
            className="p-2 rounded-lg text-stone-700 hover:bg-[#B6CDA2]/25 transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'إيقاف مؤقت · Pause' : 'تشغيل التلاوة · Play'}
            className="w-9 h-9 rounded-full bg-emerald-800 text-white hover:bg-emerald-900 flex items-center justify-center transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => jumpToAyah(currentAyah + 1)}
            aria-label="الآية التالية · Next Ayah"
            className="p-2 rounded-lg text-stone-700 hover:bg-[#B6CDA2]/25 transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Close Player */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              audioRef.current?.pause();
              onActiveAyahChange(null);
              onClose();
            }}
            aria-label="إغلاق المشغل · Close player"
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-[#B6CDA2]/25 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
