import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  PenTool,
  Highlighter,
  Eraser,
  EyeOff,
  MousePointer,
  BookOpen,
  Volume2,
  Loader2,
  Languages,
  Repeat,
  LayoutGrid,
} from 'lucide-react';
import {
  AyahLinguisticsResponse,
  AyahTiming,
  Chapter,
  QuranVerse,
  QuranWord,
  ReciterProfile,
} from '../types/quran';
import { DependencyGraphCanvas } from './DependencyGraphCanvas';
import { TafsirSadiCard } from './TafsirSadiCard';

export type DashboardLayoutMode = 'landscape' | 'portrait' | 'quarter';

interface MushafDashboardProps {
  chapters: Chapter[];
  reciters: ReciterProfile[];
  initialPage?: number;
  layoutMode?: DashboardLayoutMode;
  showExitQuarterButton?: boolean;
  onExitQuarterMode?: () => void;
  activePlayingAyahKey?: string | null;
  onOpenCreateRecitation: () => void;
}

type AnnotationTool = 'none' | 'pen' | 'highlighter' | 'hider' | 'eraser';

// Vibrant colors for Pen & Translucent Highlighter (no black here so Highlighter never turns black)
const TOOL_COLORS = [
  '#FACC15', // Classic Bright Yellow Highlighter
  '#B6CDA2', // Pistachio
  '#4ADE80', // Mint Green
  '#38BDF8', // Sky Blue
  '#F472B6', // Rose Pink
  '#FB923C', // Warm Orange
  '#C084FC', // Soft Violet
  '#DC2626', // Crimson Ink
];

const loadedFontPages = new Set<number>();
let qbsmlRegistered = false;

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

function cleanTranslationText(raw?: string): string {
  if (!raw) return '';
  return raw
    .replace(/<sup[^>]*>(\d+)<\/sup>/gi, ' [$1]')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSequentialWbwAudioUrl(surah: number, ayah: number, wordIdx: number): string {
  const sPad = String(surah).padStart(3, '0');
  const aPad = String(ayah).padStart(3, '0');
  const wPad = String(wordIdx).padStart(3, '0');
  return `https://audio.qurancdn.com/wbw/${sPad}_${aPad}_${wPad}.mp3`;
}

interface LineWordEntry {
  verse: QuranVerse;
  word: QuranWord;
  verseWordIndex: number;
}

interface EnglishTafsirState {
  ayahText: string;
  tafsirText: string;
  bookTitle: string;
  author: string;
  sourceLabel: string;
}

export const MushafDashboard: React.FC<MushafDashboardProps> = ({
  chapters,
  reciters,
  initialPage = 1,
  layoutMode = 'landscape',
  showExitQuarterButton = false,
  onExitQuarterMode,
  activePlayingAyahKey,
  onOpenCreateRecitation,
}) => {
  const [page, setPage] = useState<number>(initialPage);
  const [verses, setVerses] = useState<QuranVerse[]>([]);
  const [loading, setLoading] = useState(true);

  const [v4FontReady, setV4FontReady] = useState<boolean>(loadedFontPages.has(page));
  const [tajweedEnabled, setTajweedEnabled] = useState(true);
  const [wbwOnMushaf, setWbwOnMushaf] = useState(false);

  // Annotation Tool state (scoped strictly to Mushaf sheet)
  const [activeTool, setActiveTool] = useState<AnnotationTool>('none');
  const [penColor, setPenColor] = useState('#FACC15');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [sheetSize, setSheetSize] = useState<{ width: number; height: number }>({
    width: 520,
    height: 640,
  });
  const pageAnnotationsRef = useRef<Map<number, string>>(new Map());
  const prevPageRef = useRef<number>(page);

  // Selection, Dependency Graph & Tafsir state
  const [selectedAyahKey, setSelectedAyahKey] = useState<string>('1:1');
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [ayahLing, setAyahLing] = useState<AyahLinguisticsResponse | null>(null);
  const [loadingLing, setLoadingLing] = useState(false);
  const [graphMaximized, setGraphMaximized] = useState(false);
  const [activeTab, setActiveTab] = useState<'translations' | 'tafsir-ar' | 'tafsir-en' | 'wbw'>('translations');

  // English Tafsir state
  const [englishTafsir, setEnglishTafsir] = useState<EnglishTafsirState | null>(null);
  const [loadingEnglishTafsir, setLoadingEnglishTafsir] = useState(false);

  // Reciter Audio Player state (Default: Sheikh Ahmad Al-Nafis mp3q-259)
  const [selectedReciterId, setSelectedReciterId] = useState<string>('mp3q-259');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBufferingAudio, setIsBufferingAudio] = useState(false);
  const [audioStatusMsg, setAudioStatusMsg] = useState<string | null>(null);
  const [repeatMode, setRepeatMode] = useState<'off' | 'ayah' | 'surah'>('off');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wordAudioRef = useRef<HTMLAudioElement | null>(null);
  const timingsRef = useRef<AyahTiming[]>([]);
  const activePlayTargetRef = useRef<{ surah: number; ayah: number; reciterId: string } | null>(null);
  const repeatModeRef = useRef<'off' | 'ayah' | 'surah'>(repeatMode);
  const surahVersesCacheRef = useRef<Map<number, QuranVerse[]>>(new Map());
  const isPlayingRef = useRef(false);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (reciters.length > 0 && !reciters.some((r) => r.id === selectedReciterId)) {
      const nafis = reciters.find((r) => r.id === 'mp3q-259') || reciters[0];
      if (nafis) setSelectedReciterId(nafis.id);
    }
  }, [reciters, selectedReciterId]);

  useEffect(() => {
    if (activePlayingAyahKey) {
      setSelectedAyahKey(activePlayingAyahKey);
    }
  }, [activePlayingAyahKey]);

  useEffect(() => {
    if (activeTab !== 'tafsir-en' || layoutMode === 'quarter') return;
    let cancelled = false;
    const [s, a] = selectedAyahKey.split(':').map(Number);
    setLoadingEnglishTafsir(true);
    fetch(`/api/tafsir/english/${s || 1}/${a || 1}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setEnglishTafsir({
            ayahText: d.ayahText || '',
            tafsirText: d.tafsirText || 'English Tafsir not available for this ayah.',
            bookTitle: d.bookTitle || "Tafsir as-Sa'di (English)",
            author: d.author || "Shaykh 'Abdur-Rahman Nasir as-Sa'di",
            sourceLabel: d.sourceLabel || "Tafsir as-Sa'di",
          });
          setLoadingEnglishTafsir(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEnglishTafsir({
            ayahText: '',
            tafsirText: 'Failed to load English Tafsir.',
            bookTitle: "Tafsir as-Sa'di (English)",
            author: "Shaykh 'Abdur-Rahman Nasir as-Sa'di",
            sourceLabel: "Tafsir as-Sa'di",
          });
          setLoadingEnglishTafsir(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedAyahKey, layoutMode]);

  const activeChapter = chapters.find((c) => page >= c.pages[0] && page <= c.pages[1]) || chapters[0] || {
    id: 1,
    revelation_place: 'makkah',
    revelation_order: 5,
    bismillah_pre: true,
    name_simple: 'Al-Fatihah',
    name_complex: 'Al-Fatihah',
    name_arabic: 'الفاتحة',
    verses_count: 7,
    pages: [1, 1],
  };

  const [selectedSurahNum, selectedAyahNum] = selectedAyahKey.split(':').map(Number);
  const selectedSurahChapter =
    chapters.find((c) => c.id === (selectedSurahNum || 1)) || activeChapter;

  useEffect(() => {
    if (layoutMode === 'quarter') return;
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
          setV4FontReady(true);
        })
        .catch(() => {});

      document.fonts.load(`28px 'QCF4_QBSML'`).catch(() => {});
    }
  }, [page, layoutMode]);

  useEffect(() => {
    if (layoutMode === 'quarter') return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/mushaf/page/${page}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          const loadedVerses: QuranVerse[] = data.verses || [];
          setVerses(loadedVerses);
          setLoading(false);
          if (loadedVerses.length > 0 && !loadedVerses.some((v) => v.verse_key === selectedAyahKey)) {
            setSelectedAyahKey(loadedVerses[0].verse_key);
            setSelectedWordIndex(null);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, layoutMode]);

  useEffect(() => {
    let cancelled = false;
    const [s, a] = selectedAyahKey.split(':').map(Number);
    setLoadingLing(true);
    fetch(`/api/linguistics/ayah/${s || 1}/${a || 1}`)
      .then((r) => r.json())
      .then((json: AyahLinguisticsResponse) => {
        if (!cancelled) {
          setAyahLing(json);
          setLoadingLing(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingLing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAyahKey]);

  const currentMushafVerse = useMemo(
    () => verses.find((v) => v.verse_key === selectedAyahKey),
    [verses, selectedAyahKey]
  );

  const sahihTranslationText = useMemo(() => {
    if (ayahLing?.sahihTranslation) return ayahLing.sahihTranslation;
    const fromVerse = currentMushafVerse?.translations?.find((t) => t.resource_id === 20)?.text;
    if (fromVerse) return cleanTranslationText(fromVerse);
    return cleanTranslationText(ayahLing?.verseTranslation);
  }, [ayahLing, currentMushafVerse]);

  const muhsinKhanTranslationText = useMemo(() => {
    if (ayahLing?.muhsinKhanTranslation) return ayahLing.muhsinKhanTranslation;
    const fromVerse = currentMushafVerse?.translations?.find((t) => t.resource_id === 203)?.text;
    if (fromVerse) return cleanTranslationText(fromVerse);
    return '';
  }, [ayahLing, currentMushafVerse]);

  // Authentic 15-line Madani Mushaf rows with strict sequential spoken-word indices
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

      let wordCounter = 0;
      for (const w of v.words) {
        if (w.char_type_name === 'word') wordCounter++;
        const ln = w.line_number || 1;
        if (!byLine.has(ln)) byLine.set(ln, []);
        byLine.get(ln)!.push({
          verse: v,
          word: w,
          verseWordIndex: w.char_type_name === 'word' ? wordCounter : 0,
        });
      }
    }

    const lineNumbers = Array.from(
      new Set([...Array.from(byLine.keys()), ...Array.from(surahHeaderAtLine.keys())])
    ).sort((a, b) => a - b);

    return { byLine, surahHeaderAtLine, lineNumbers };
  }, [verses, chapters]);

  // Dynamically compute exact font size so ALL 15 lines + Surah banners fit inside the Mushaf box with ZERO scroll
  const mushafFontMetrics = useMemo(() => {
    let visualUnits = 0;
    let maxWordsInLine = 6;

    for (const ln of mushafLines.lineNumbers) {
      const header = mushafLines.surahHeaderAtLine.get(ln);
      if (header) {
        visualUnits += header.showBismillah ? 2.15 : 1.15;
      }
      const entries = mushafLines.byLine.get(ln) || [];
      if (entries.length > 0) {
        visualUnits += wbwOnMushaf ? 1.55 : 1.0;
        if (entries.length > maxWordsInLine) maxWordsInLine = entries.length;
      }
    }

    const units = Math.max(8, visualUnits);
    const availH = Math.max(200, sheetSize.height - 14);
    const availW = Math.max(200, sheetSize.width - 24);

    const perRowHeight = availH / units;
    const byHeight = Math.floor(perRowHeight * (wbwOnMushaf ? 0.44 : 0.6));
    const byWidth = Math.floor(availW / Math.max(15.5, maxWordsInLine * 1.48));

    const glyphPx = Math.max(11, Math.min(28, Math.min(byHeight, byWidth)));
    const headerPx = Math.max(11, Math.min(21, Math.floor(glyphPx * 0.85)));

    return { glyphPx, headerPx };
  }, [mushafLines, sheetSize, wbwOnMushaf]);

  // Restore & persist annotation canvas cleanly across page turns, layout mode switches & resizes
  const saveCurrentCanvas = useCallback((targetPage: number) => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    try {
      pageAnnotationsRef.current.set(targetPage, canvas.toDataURL('image/png'));
    } catch {
      // ignore
    }
  }, []);

  const restoreCanvasForPage = useCallback((targetPage: number) => {
    const canvas = canvasRef.current;
    const sheet = sheetRef.current;
    if (!canvas || !sheet) return;
    const w = sheet.clientWidth;
    const h = sheet.clientHeight;
    if (w <= 0 || h <= 0) return;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const saved = pageAnnotationsRef.current.get(targetPage);
    if (saved) {
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      };
      img.src = saved;
    }
  }, []);

  useEffect(() => {
    if (layoutMode === 'quarter') return;
    if (prevPageRef.current !== page) {
      saveCurrentCanvas(prevPageRef.current);
      prevPageRef.current = page;
    }
    restoreCanvasForPage(page);
  }, [page, layoutMode, saveCurrentCanvas, restoreCanvasForPage]);

  useEffect(() => {
    if (layoutMode === 'quarter') return;
    const sheet = sheetRef.current;
    if (!sheet || typeof ResizeObserver === 'undefined') return;
    const updateSize = () => {
      setSheetSize({
        width: sheet.clientWidth,
        height: sheet.clientHeight,
      });
      saveCurrentCanvas(prevPageRef.current);
      restoreCanvasForPage(prevPageRef.current);
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(sheet);
    return () => ro.disconnect();
  }, [layoutMode, saveCurrentCanvas, restoreCanvasForPage]);

  const getPointerCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width,
      y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);

    const { x, y } = getPointerCoords(e);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (activeTool === 'pen') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.strokeStyle = penColor;
      ctx.lineWidth = 3;
    } else if (activeTool === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.38;
      ctx.strokeStyle = penColor;
      ctx.lineWidth = 22;
    } else if (activeTool === 'hider') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 34;
    } else if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = 28;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeTool === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPointerCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.restore();
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      saveCurrentCanvas(page);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    pageAnnotationsRef.current.delete(page);
  };

  const playWordClip = (surah: number, ayah: number, wordIdx: number, fallbackUrl?: string | null) => {
    const url =
      surah > 0 && ayah > 0 && wordIdx > 0
        ? buildSequentialWbwAudioUrl(surah, ayah, wordIdx)
        : fallbackUrl;
    if (!url) return;
    if (wordAudioRef.current) {
      wordAudioRef.current.pause();
    }
    const audio = new Audio(url);
    wordAudioRef.current = audio;
    audio.play().catch(() => {});
  };

  const computeProportionalTimings = (
    surahNum: number,
    surahVerses: QuranVerse[],
    durationSec: number
  ): AyahTiming[] => {
    if (!surahVerses.length || !durationSec || isNaN(durationSec)) return [];
    const totalChars = surahVerses.reduce((sum, v) => {
      const txt = v.words.map((w) => w.text_uthmani).join(' ');
      return sum + Math.max(8, txt.length);
    }, 0);
    const introOffset = surahNum !== 1 && surahNum !== 9 ? Math.min(4, durationSec * 0.02) : 0;
    const usableDuration = Math.max(1, durationSec - introOffset);
    let cursor = introOffset;

    return surahVerses.map((v) => {
      const txtLen = Math.max(8, v.words.map((w) => w.text_uthmani).join(' ').length);
      const span = (txtLen / totalChars) * usableDuration;
      const startTimeMs = Math.round(cursor * 1000);
      cursor += span;
      const endTimeMs = Math.round(cursor * 1000);
      return {
        ayah: v.verse_number,
        startTimeMs,
        endTimeMs,
        precision: 'proportional',
      };
    });
  };

  const playSurahAyah = useCallback(
    async (s: number, a: number, reciterIdOverride?: string) => {
      const chosenId = reciterIdOverride || selectedReciterId;
      let reciter = reciters.find((r) => r.id === chosenId) || reciters[0];
      if (!reciter) {
        setAudioStatusMsg('Loading reciters…');
        return;
      }

      setAudioStatusMsg(null);

      if (!reciter.availableSurahs.includes(s)) {
        const fallback =
          reciters.find((r) => r.id === 'mp3q-259' && r.availableSurahs.includes(s)) ||
          reciters.find((r) => r.isComplete && r.availableSurahs.includes(s)) ||
          reciter;
        if (fallback && fallback.id !== reciter.id) {
          setAudioStatusMsg(
            `Surah ${s} unavailable for ${reciter.name}; playing ${fallback.name}.`
          );
          reciter = fallback;
        }
      }

      setIsBufferingAudio(true);
      const paddedSurah = String(s).padStart(3, '0');
      const cleanServer = reciter.serverUrl.replace(/\/+$/, '');
      const audioUrl = `${cleanServer}/${paddedSurah}.mp3`;

      const prevTarget = activePlayTargetRef.current;
      const existingAudio = audioRef.current;
      if (
        existingAudio &&
        prevTarget &&
        prevTarget.surah === s &&
        prevTarget.reciterId === reciter.id &&
        existingAudio.src === audioUrl &&
        timingsRef.current.length > 0 &&
        existingAudio.readyState >= 1
      ) {
        const entry = timingsRef.current.find((t) => t.ayah === a);
        if (entry) {
          existingAudio.currentTime = entry.startTimeMs / 1000;
        }
        activePlayTargetRef.current = { surah: s, ayah: a, reciterId: reciter.id };
        try {
          await existingAudio.play();
          setIsPlaying(true);
          setIsBufferingAudio(false);
          return;
        } catch {
          // continue to reload
        }
      }

      if (existingAudio) {
        existingAudio.pause();
        existingAudio.onloadedmetadata = null;
        existingAudio.ontimeupdate = null;
        existingAudio.onended = null;
        existingAudio.onerror = null;
      }

      try {
        const [timingRes, surahVerses] = await Promise.all([
          reciter.hasExactAyahTiming && reciter.timingReadId
            ? fetch(`/api/recitations/timing/${reciter.timingReadId}/${s}`)
                .then((r) => r.json())
                .catch(() => ({ timings: [] }))
            : Promise.resolve({ timings: [] }),
          surahVersesCacheRef.current.has(s)
            ? Promise.resolve(surahVersesCacheRef.current.get(s)!)
            : fetch(`/api/surah/${s}/verses`)
                .then((r) => r.json())
                .then((d) => {
                  const list: QuranVerse[] = d.verses || [];
                  surahVersesCacheRef.current.set(s, list);
                  return list;
                })
                .catch(() => [] as QuranVerse[]),
        ]);

        const loadedTimings: AyahTiming[] = Array.isArray(timingRes?.timings)
          ? timingRes.timings
          : [];
        timingsRef.current = loadedTimings;
        activePlayTargetRef.current = { surah: s, ayah: a, reciterId: reciter.id };

        const audio = new Audio(audioUrl);
        audio.preload = 'auto';
        audioRef.current = audio;

        audio.onloadedmetadata = () => {
          if (timingsRef.current.length === 0 && audio.duration) {
            timingsRef.current = computeProportionalTimings(s, surahVerses, audio.duration);
          }
          const target = activePlayTargetRef.current;
          if (target) {
            const entry = timingsRef.current.find((t) => t.ayah === target.ayah);
            if (entry) {
              audio.currentTime = entry.startTimeMs / 1000;
            }
          }
          setIsBufferingAudio(false);
          audio
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => {
              setIsPlaying(false);
              setAudioStatusMsg('Browser blocked playback — click Play again.');
            });
        };

        audio.ontimeupdate = () => {
          const target = activePlayTargetRef.current;
          if (!target || !timingsRef.current.length) return;
          const entry = timingsRef.current.find((t) => t.ayah === target.ayah);
          if (!entry) return;
          const currMs = audio.currentTime * 1000;

          if (currMs >= entry.endTimeMs - 100) {
            const mode = repeatModeRef.current;
            if (mode === 'ayah') {
              audio.currentTime = entry.startTimeMs / 1000;
            } else if (mode === 'surah') {
              const nextEntry = timingsRef.current.find((t) => t.ayah === target.ayah + 1);
              if (nextEntry) {
                activePlayTargetRef.current = { ...target, ayah: nextEntry.ayah };
                setSelectedAyahKey(`${target.surah}:${nextEntry.ayah}`);
              } else {
                audio.pause();
                setIsPlaying(false);
              }
            } else {
              audio.pause();
              setIsPlaying(false);
            }
          }
        };

        audio.onended = () => {
          setIsPlaying(false);
          setIsBufferingAudio(false);
        };

        audio.onerror = () => {
          setIsBufferingAudio(false);
          setIsPlaying(false);
          setAudioStatusMsg(`Unable to stream audio from ${reciter.name}.`);
        };
      } catch {
        setIsBufferingAudio(false);
        setIsPlaying(false);
        setAudioStatusMsg('Failed to initialize recitation audio.');
      }
    },
    [reciters, selectedReciterId]
  );

  const togglePlaySelectedAyah = () => {
    const s = selectedSurahNum || 1;
    const a = selectedAyahNum || 1;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      playSurahAyah(s, a);
    }
  };

  const handleReciterChange = (newReciterId: string) => {
    setSelectedReciterId(newReciterId);
    if (isPlayingRef.current) {
      playSurahAyah(selectedSurahNum || 1, selectedAyahNum || 1, newReciterId);
    }
  };

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      wordAudioRef.current?.pause();
    };
  }, []);

  const currentReciter = useMemo(
    () => reciters.find((r) => r.id === selectedReciterId) || reciters[0],
    [reciters, selectedReciterId]
  );

  // Reusable Panel: Full-Page KFGQPC V4 Mushaf Card
  const renderMushafCard = (compactHeader = false) => (
    <section className="min-w-0 w-full h-full min-h-0 relative rounded-2xl border-2 border-[#B6CDA2] bg-[#FCF9F0] p-2 sm:p-2.5 shadow-2xl flex flex-col overflow-hidden">
      {/* Fixed-Height Single-Line Mushaf Header Bar */}
      <div
        dir="rtl"
        className="h-[38px] shrink-0 flex items-center justify-between gap-1.5 pb-1.5 mb-1 border-b border-[#B6CDA2]/40 text-xs text-stone-900 overflow-hidden whitespace-nowrap"
      >
        <div className="flex items-center gap-1 min-w-0">
          <select
            aria-label="اختر السورة"
            value={activeChapter.id}
            onChange={(e) => {
              const ch = chapters.find((c) => c.id === Number(e.target.value));
              if (ch) setPage(ch.pages[0]);
            }}
            className={`${
              compactHeader ? 'w-[110px]' : 'w-[150px]'
            } truncate bg-white text-stone-900 border border-[#B6CDA2] rounded-lg px-1.5 py-1 text-[11px] font-bold focus:outline-none shrink-0`}
          >
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.id}. {ch.name_arabic}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setWbwOnMushaf((v) => !v)}
            title="إظهار الترجمة كلمة بكلمة أسفل كلمات المصحف · Toggle Word-to-Word under Mushaf"
            className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-lg border text-[10px] font-bold transition-colors shrink-0 ${
              wbwOnMushaf
                ? 'bg-[#B6CDA2] border-[#B6CDA2] text-black'
                : 'bg-white border-[#B6CDA2]/70 text-stone-800 hover:bg-[#B6CDA2]/20'
            }`}
          >
            <Languages className="w-3 h-3" />
            <span>WBW</span>
          </button>

          <button
            type="button"
            onClick={() => setTajweedEnabled((t) => !t)}
            className={`px-1.5 py-1 rounded-lg border text-[10px] font-bold transition-colors shrink-0 ${
              tajweedEnabled
                ? 'bg-emerald-800 border-emerald-800 text-white'
                : 'bg-white border-[#B6CDA2]/70 text-stone-700'
            }`}
          >
            تجويد
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0" dir="ltr">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="Previous Mushaf Page"
            className="p-1 rounded-lg border border-[#B6CDA2] bg-white text-stone-900 hover:bg-[#B6CDA2]/25 disabled:opacity-40"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono-tabular text-[11px] font-bold text-stone-900 w-[56px] text-center">
            {page}/604
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(604, p + 1))}
            disabled={page >= 604}
            aria-label="Next Mushaf Page"
            className="p-1 rounded-lg border border-[#B6CDA2] bg-white text-stone-900 hover:bg-[#B6CDA2]/25 disabled:opacity-40"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mushaf Sheet Frame — Fits Whole Page Without Scrolling */}
      <div
        ref={sheetRef}
        className="mushaf-sheet relative flex-1 min-h-0 w-full rounded-xl border border-[#B6CDA2]/60 bg-[#FCF9F0] px-2.5 sm:px-4 py-1 flex flex-col justify-between overflow-hidden"
      >
        {/* Scoped Mushaf Annotation Canvas Overlay */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`absolute inset-0 z-20 ${
            activeTool !== 'none'
              ? 'cursor-crosshair pointer-events-auto touch-none'
              : 'pointer-events-none'
          }`}
        />

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-stone-600">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
            <span className="text-xs font-medium">جاري تحميل صفحة المصحف…</span>
          </div>
        ) : (
          <div
            dir="rtl"
            className={`relative z-10 flex-1 min-h-0 flex flex-col ${
              page <= 2 ? 'justify-center gap-2' : 'justify-evenly'
            } ${tajweedEnabled ? 'tajweed-enabled' : ''}`}
          >
            {mushafLines.lineNumbers.map((lineNum) => {
              const headerMeta = mushafLines.surahHeaderAtLine.get(lineNum);
              const lineEntries = mushafLines.byLine.get(lineNum) || [];
              const isShortCenteredLine = page <= 2 || lineEntries.length <= 4;

              return (
                <React.Fragment key={lineNum}>
                  {headerMeta && (
                    <div className="shrink-0 space-y-0.5 my-0.5">
                      <div
                        style={{ fontSize: `${mushafFontMetrics.headerPx}px` }}
                        className="py-0.5 px-2.5 rounded-lg border border-[#B6CDA2] bg-[#EFE6CE] text-center font-quran font-bold text-stone-900 leading-snug"
                      >
                        سُورَةُ {headerMeta.chapter.name_arabic}
                      </div>
                      {headerMeta.showBismillah && (
                        <div
                          style={{ fontSize: `${mushafFontMetrics.headerPx}px` }}
                          className="text-center font-quran text-stone-900 leading-tight"
                        >
                          بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ
                        </div>
                      )}
                    </div>
                  )}

                  {lineEntries.length > 0 && (
                    <div
                      className={`flex flex-nowrap items-center ${
                        isShortCenteredLine
                          ? 'justify-center gap-x-[1.6cqw]'
                          : 'justify-between gap-x-[0.25cqw]'
                      } border-b border-stone-300/30 last:border-b-0 min-w-0`}
                    >
                      {lineEntries.map(({ verse, word, verseWordIndex }) => {
                        const isAyahSelected = selectedAyahKey === verse.verse_key;
                        const isWordSelected =
                          isAyahSelected &&
                          verseWordIndex > 0 &&
                          selectedWordIndex === verseWordIndex;
                        const wordPage = word.v2_page || page;
                        const canRenderV4Glyph =
                          tajweedEnabled && v4FontReady && Boolean(word.code_v2);

                        if (word.char_type_name === 'end') {
                          return (
                            <button
                              key={word.id}
                              type="button"
                              onClick={() => {
                                setSelectedAyahKey(verse.verse_key);
                                setSelectedWordIndex(null);
                              }}
                              className={`inline-flex items-center justify-center px-0.5 rounded-full shrink-0 transition-colors ${
                                isAyahSelected
                                  ? 'ring-2 ring-emerald-700 bg-[#B6CDA2]/45'
                                  : 'hover:bg-[#B6CDA2]/25'
                              }`}
                            >
                              {canRenderV4Glyph ? (
                                <span
                                  style={{
                                    fontFamily: `'QCF_V4_P${wordPage}', 'Amiri Quran', serif`,
                                    fontSize: `${mushafFontMetrics.glyphPx}px`,
                                  }}
                                  className="leading-[1.15] text-stone-900"
                                >
                                  {word.code_v2}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: `${Math.max(11, mushafFontMetrics.glyphPx - 3)}px`,
                                  }}
                                  className="font-quran text-[#8E651C]"
                                >
                                  ۝{verse.verse_number}
                                </span>
                              )}
                            </button>
                          );
                        }

                        const wbwText = word.translation?.text?.trim();
                        const [vSurah, vAyah] = verse.verse_key.split(':').map(Number);

                        return (
                          <button
                            key={word.id}
                            type="button"
                            onClick={() => {
                              setSelectedAyahKey(verse.verse_key);
                              setSelectedWordIndex(verseWordIndex || null);
                              if (wbwOnMushaf && verseWordIndex > 0) {
                                playWordClip(vSurah, vAyah, verseWordIndex);
                              }
                            }}
                            title={wbwText || word.text_uthmani}
                            className={`inline-flex flex-col items-center px-0.5 rounded transition-colors min-w-0 ${
                              isWordSelected
                                ? 'bg-[#B6CDA2] ring-1 ring-emerald-800'
                                : isAyahSelected
                                  ? 'bg-[#B6CDA2]/35'
                                  : 'hover:bg-stone-200/60'
                            }`}
                          >
                            {canRenderV4Glyph ? (
                              <span
                                style={{
                                  fontFamily: `'QCF_V4_P${wordPage}', 'Amiri Quran', serif`,
                                  fontSize: `${mushafFontMetrics.glyphPx}px`,
                                }}
                                className="leading-[1.2] text-stone-900 whitespace-nowrap"
                              >
                                {word.code_v2}
                              </span>
                            ) : (
                              <span
                                style={{ fontSize: `${mushafFontMetrics.glyphPx}px` }}
                                className="font-quran leading-[1.2] text-stone-900 whitespace-nowrap"
                              >
                                {word.text_uthmani}
                              </span>
                            )}
                            {wbwOnMushaf && wbwText && (
                              <span
                                dir="ltr"
                                className="text-[8px] leading-[1.05] font-sans font-semibold text-emerald-900 max-w-[54px] truncate"
                              >
                                {wbwText}
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
      </div>
    </section>
  );

  // Reusable Panel: Top Annotation & Create Recitation Toolbar
  const renderAnnotationToolbar = (compact = false) => (
    <div
      dir="rtl"
      className={`${
        compact ? 'h-[36px] px-1.5 mb-1.5' : 'h-[44px] px-2.5'
      } shrink-0 w-full min-w-0 flex items-center justify-between gap-1.5 rounded-xl border-2 border-[#B6CDA2] bg-[#FCF9F0] text-stone-900 shadow-lg overflow-x-auto custom-scrollbar whitespace-nowrap`}
    >
      <button
        type="button"
        onClick={onOpenCreateRecitation}
        className={`${
          compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
        } font-bold rounded-lg bg-[#B6CDA2] text-black hover:bg-[#a3be8c] transition-colors shadow-xs whitespace-nowrap shrink-0`}
      >
        {compact ? 'إنشاء تلاوة' : 'إنشاء تلاوة · Create Recitation'}
      </button>

      <div className="flex items-center gap-1 shrink-0">
        <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-[#B6CDA2]/60 shadow-2xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTool('none')}
            title="Select Ayah / Cursor Mode"
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors flex items-center gap-1 whitespace-nowrap ${
              activeTool === 'none'
                ? 'bg-[#B6CDA2] text-black'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            <MousePointer className="w-3 h-3" />
            {!compact && <span>Select</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'pen' ? 'none' : 'pen')}
            title="Ink Pen"
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors flex items-center gap-1 whitespace-nowrap ${
              activeTool === 'pen'
                ? 'bg-[#B6CDA2] text-black'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            <PenTool className="w-3 h-3" />
            {!compact && <span>Pen</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'highlighter' ? 'none' : 'highlighter')}
            title="Translucent Color Highlighter"
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors flex items-center gap-1 whitespace-nowrap ${
              activeTool === 'highlighter'
                ? 'bg-amber-300 text-black'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            <Highlighter className="w-3 h-3" />
            {!compact && <span>Highlighter</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'hider' ? 'none' : 'hider')}
            title="Solid Black Cover (Hide Ayah for Memorization)"
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors flex items-center gap-1 whitespace-nowrap ${
              activeTool === 'hider'
                ? 'bg-stone-900 text-white'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            <EyeOff className="w-3 h-3" />
            {!compact && <span>Hide Ayah</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'eraser' ? 'none' : 'eraser')}
            title="Eraser"
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors flex items-center gap-1 whitespace-nowrap ${
              activeTool === 'eraser'
                ? 'bg-[#B6CDA2] text-black'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            <Eraser className="w-3 h-3" />
            {!compact && <span>Eraser</span>}
          </button>

          <button
            type="button"
            onClick={clearCanvas}
            title="Clear Page Ink"
            className="p-0.5 rounded text-red-700 hover:bg-red-50 shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-1 bg-white px-1 py-0.5 rounded-lg border border-[#B6CDA2]/60 shrink-0">
          {TOOL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => setPenColor(c)}
              className={`w-3 h-3 rounded-full border transition-transform ${
                penColor === c
                  ? 'scale-125 border-stone-900 ring-1 ring-stone-900'
                  : 'border-stone-300'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  // Reusable Panel: Dependency Graph Card (supports Landscape, Portrait, and 1/4 Split modes)
  const renderDependencyGraphCard = (containerClassName: string, showQuickAyahNav = false) => (
    <div
      className={
        graphMaximized
          ? 'fixed inset-3 sm:inset-5 z-50 rounded-2xl border-2 border-[#B6CDA2] bg-[#FCF9F0] p-4 shadow-2xl flex flex-col overflow-hidden'
          : `${containerClassName} w-full min-w-0 rounded-2xl border-2 border-[#B6CDA2] bg-[#FCF9F0] p-2 shadow-xl flex flex-col overflow-hidden`
      }
    >
      <div className="h-[28px] shrink-0 flex items-center justify-between gap-2 pb-1 mb-1 border-b border-[#B6CDA2]/40 text-stone-900 overflow-hidden whitespace-nowrap">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
          <h3 className="text-xs font-bold text-stone-900 truncate">
            Dependency Graph ({selectedAyahKey})
          </h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* In 1/4 Split Mode, provide inline Surah & Ayah picker right on the graph bar */}
          {showQuickAyahNav && (
            <div className="flex items-center gap-1">
              <select
                aria-label="Select Surah"
                value={selectedSurahNum || 1}
                onChange={(e) => setSelectedAyahKey(`${Number(e.target.value)}:1`)}
                className="w-[105px] truncate bg-white text-stone-900 border border-[#B6CDA2] rounded px-1.5 py-0.5 text-[10px] font-bold"
              >
                {chapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.id}. {ch.name_simple}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  const prev = Math.max(1, (selectedAyahNum || 1) - 1);
                  setSelectedAyahKey(`${selectedSurahNum || 1}:${prev}`);
                }}
                disabled={(selectedAyahNum || 1) <= 1}
                className="p-0.5 rounded border border-[#B6CDA2] bg-white text-stone-800 disabled:opacity-40"
                title="Previous Ayah"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="font-mono-tabular text-[10px] font-bold text-stone-800 min-w-[30px] text-center">
                {selectedAyahNum || 1}/{selectedSurahChapter.verses_count || 7}
              </span>
              <button
                type="button"
                onClick={() => {
                  const maxA = selectedSurahChapter.verses_count || 7;
                  const next = Math.min(maxA, (selectedAyahNum || 1) + 1);
                  setSelectedAyahKey(`${selectedSurahNum || 1}:${next}`);
                }}
                disabled={(selectedAyahNum || 1) >= (selectedSurahChapter.verses_count || 7)}
                className="p-0.5 rounded border border-[#B6CDA2] bg-white text-stone-800 disabled:opacity-40"
                title="Next Ayah"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {showExitQuarterButton && onExitQuarterMode && (
            <button
              type="button"
              onClick={onExitQuarterMode}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[#B6CDA2] bg-[#B6CDA2] text-black text-[10px] font-bold shrink-0"
              title="Exit 1/4 Split Preview"
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Full View</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setGraphMaximized((m) => !m)}
            aria-label={graphMaximized ? 'Minimize graph' : 'Maximize graph'}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[#B6CDA2] bg-white text-stone-900 hover:bg-[#B6CDA2]/25 text-[11px] font-semibold shrink-0"
          >
            {graphMaximized ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>تصغير</span>
              </>
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full min-w-0 overflow-hidden">
        {loadingLing && !ayahLing ? (
          <div className="h-full flex items-center justify-center gap-2 text-stone-500 text-xs bg-white rounded-xl border border-[#B6CDA2]/40">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
            <span>Loading dependency graphs…</span>
          </div>
        ) : ayahLing ? (
          <DependencyGraphCanvas
            graphs={ayahLing.graphs}
            words={ayahLing.words}
            hasGoldTreebank={ayahLing.hasGoldTreebank}
            graphSource={ayahLing.graphSource}
            ayahKey={selectedAyahKey}
            selectedWordIndex={selectedWordIndex}
            onSelectWord={(idx) => setSelectedWordIndex(idx)}
          />
        ) : null}
      </div>
    </div>
  );

  // Reusable Panel: Translations, Tafsir (AR & EN) & Word-by-Word
  const renderTranslationsCard = (compactTabs = false) => (
    <div className="flex-1 min-h-0 w-full min-w-0 rounded-2xl border-2 border-[#B6CDA2] bg-[#FCF9F0] p-2 sm:p-2.5 shadow-xl flex flex-col overflow-hidden">
      <div className="h-[32px] shrink-0 flex items-center gap-1 pb-1.5 mb-1.5 border-b border-[#B6CDA2]/40 overflow-x-auto custom-scrollbar flex-nowrap text-[11px] whitespace-nowrap">
        <button
          type="button"
          onClick={() => setActiveTab('translations')}
          className={`px-2 py-0.5 rounded-lg font-bold whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'translations'
              ? 'bg-[#B6CDA2] text-black'
              : 'bg-white text-stone-700 border border-[#B6CDA2]/40 hover:bg-[#B6CDA2]/20'
          }`}
        >
          {compactTabs ? 'Translation' : 'Translation (Sahih & Khan)'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tafsir-ar')}
          className={`px-2 py-0.5 rounded-lg font-bold whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'tafsir-ar'
              ? 'bg-[#B6CDA2] text-black'
              : 'bg-white text-stone-700 border border-[#B6CDA2]/40 hover:bg-[#B6CDA2]/20'
          }`}
        >
          {compactTabs ? 'Tafsir AR' : "Tafsir Sa'di (Arabic)"}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tafsir-en')}
          className={`px-2 py-0.5 rounded-lg font-bold whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'tafsir-en'
              ? 'bg-[#B6CDA2] text-black'
              : 'bg-white text-stone-700 border border-[#B6CDA2]/40 hover:bg-[#B6CDA2]/20'
          }`}
        >
          {compactTabs ? 'Tafsir EN' : "Tafsir Sa'di (English)"}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('wbw')}
          className={`px-2 py-0.5 rounded-lg font-bold whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'wbw'
              ? 'bg-[#B6CDA2] text-black'
              : 'bg-white text-stone-700 border border-[#B6CDA2]/40 hover:bg-[#B6CDA2]/20'
          }`}
        >
          {compactTabs ? 'WBW' : 'Word-to-Word'}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-white rounded-xl p-2.5 sm:p-3 border border-[#B6CDA2]/40 text-stone-900 text-xs sm:text-sm leading-relaxed">
        {activeTab === 'translations' && (
          <div className="space-y-2.5">
            <div>
              <span className="font-bold text-emerald-900 text-[10px] uppercase tracking-wide block mb-0.5">
                Sahih International
              </span>
              <p className="text-stone-900 leading-relaxed font-sans text-xs sm:text-[13px]">
                {sahihTranslationText || 'Loading Sahih International translation…'}
              </p>
            </div>

            <div className="pt-2 border-t border-stone-200">
              <span className="font-bold text-amber-900 text-[10px] uppercase tracking-wide block mb-0.5">
                Al-Hilali & Muhsin Khan
              </span>
              <p className="text-stone-900 leading-relaxed font-sans text-xs sm:text-[13px]">
                {muhsinKhanTranslationText || 'Loading Al-Hilali & Muhsin Khan translation…'}
              </p>
            </div>

            {ayahLing?.words && ayahLing.words.length > 0 && (
              <div className="pt-2 border-t border-stone-200">
                <span className="font-bold text-emerald-900 text-[10px] block mb-1.5">
                  Word-to-Word (Click word for audio)
                </span>
                <div className="flex flex-wrap gap-1.5" dir="rtl">
                  {ayahLing.words.map((w, idx) => {
                    const spokenIdx = idx + 1;
                    return (
                      <button
                        key={`${w.location}-${idx}`}
                        type="button"
                        onClick={() => {
                          setSelectedWordIndex(w.wordIndex);
                          playWordClip(w.surah, w.ayah, spokenIdx, w.wordAudioUrl);
                        }}
                        className={`flex flex-col items-center rounded-lg p-1 min-w-[58px] border transition-colors ${
                          selectedWordIndex === w.wordIndex
                            ? 'bg-[#B6CDA2]/45 border-emerald-800'
                            : 'bg-[#FCF9F0] border-[#B6CDA2] hover:bg-[#B6CDA2]/20'
                        }`}
                      >
                        <span className="font-quran text-base text-stone-900 leading-snug">
                          {w.arabicFull}
                        </span>
                        {w.transliteration && (
                          <span dir="ltr" className="text-[9px] text-sky-800 font-mono">
                            {w.transliteration}
                          </span>
                        )}
                        <span
                          dir="ltr"
                          className="text-[10px] font-semibold text-emerald-900 text-center leading-tight"
                        >
                          {w.wbwTranslation || '—'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tafsir-ar' && (
          <TafsirSadiCard
            surah={selectedSurahNum || 1}
            ayah={selectedAyahNum || 1}
            compact
          />
        )}

        {activeTab === 'tafsir-en' && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-stone-200">
              <div>
                <h4 className="font-bold text-emerald-900 text-xs">
                  {englishTafsir?.bookTitle || "Tafsir as-Sa'di — English"}
                </h4>
                <p className="text-[10px] text-stone-500">
                  {englishTafsir?.author || "Shaykh 'Abdur-Rahman Nasir as-Sa'di"} · Ayah{' '}
                  {selectedAyahKey}
                </p>
              </div>
            </div>

            {loadingEnglishTafsir ? (
              <div className="py-6 flex items-center justify-center gap-2 text-stone-500 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                <span>Translating & loading Tafsir as-Sa'di in English…</span>
              </div>
            ) : (
              <div className="space-y-2">
                {englishTafsir?.ayahText && (
                  <div
                    dir="rtl"
                    className="p-2 rounded-lg bg-[#FCF9F0] border border-[#B6CDA2]/60 font-quran text-base text-stone-900"
                  >
                    {englishTafsir.ayahText}
                  </div>
                )}
                {(englishTafsir?.tafsirText || '')
                  .split(/\n{2,}/)
                  .filter(Boolean)
                  .map((para, i) => (
                    <p key={i} className="text-stone-800 leading-relaxed font-sans text-xs">
                      {para}
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'wbw' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-stone-200 pb-1">
              <span className="text-xs font-bold text-emerald-900">
                Word-by-Word — {selectedAyahKey}
              </span>
              <span className="text-[10px] text-stone-500">Tap word for audio</span>
            </div>

            {ayahLing?.words && ayahLing.words.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5" dir="rtl">
                {ayahLing.words.map((w, idx) => {
                  const spokenIdx = idx + 1;
                  return (
                    <button
                      key={`${w.location}-${idx}`}
                      type="button"
                      onClick={() => {
                        setSelectedWordIndex(w.wordIndex);
                        playWordClip(w.surah, w.ayah, spokenIdx, w.wordAudioUrl);
                      }}
                      className={`p-1.5 rounded-xl border text-center transition-colors flex flex-col items-center gap-0.5 ${
                        selectedWordIndex === w.wordIndex
                          ? 'bg-[#B6CDA2]/40 border-emerald-800'
                          : 'bg-[#FCF9F0] border-[#B6CDA2] hover:bg-[#B6CDA2]/20'
                      }`}
                    >
                      <span className="font-quran text-lg text-stone-900 leading-normal">
                        {w.arabicFull}
                      </span>
                      {w.transliteration && (
                        <span dir="ltr" className="text-[9.5px] font-mono text-sky-800">
                          {w.transliteration}
                        </span>
                      )}
                      <span dir="ltr" className="text-[11px] font-bold text-emerald-900 leading-snug">
                        {w.wbwTranslation || '—'}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-stone-500">Select an ayah to inspect word-by-word meanings.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Reusable Panel: Fixed-Height Surah Ayah Reciter Bar
  const renderReciterBar = (compact = false) => (
    <div
      className={`${
        compact ? 'h-[48px] px-2.5' : 'h-[56px] px-3'
      } shrink-0 w-full min-w-0 rounded-2xl border-2 border-[#B6CDA2] bg-[#FCF9F0] shadow-xl flex items-center justify-between gap-2 overflow-hidden whitespace-nowrap`}
    >
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        <Volume2 className="w-4 h-4 text-emerald-800 shrink-0" />
        <div className="min-w-0 overflow-hidden">
          <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
            <span className="truncate">{compact ? 'Surah Ayah' : 'Surah Ayah Reciter'}</span>
            <span className="font-mono-tabular text-emerald-900 bg-white px-1.5 py-0.5 rounded border border-[#B6CDA2] shrink-0 text-[11px]">
              {selectedAyahKey}
            </span>
          </div>
          {!compact && (
            <div className="text-[10px] text-stone-600 truncate">
              {audioStatusMsg ||
                (currentReciter
                  ? `${currentReciter.arabicName || currentReciter.name} (${currentReciter.rewaya})`
                  : 'Loading reciters…')}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <select
          aria-label="اختر القارئ · Select Reciter"
          value={selectedReciterId}
          onChange={(e) => handleReciterChange(e.target.value)}
          className={`${
            compact ? 'w-[140px] sm:w-[175px]' : 'w-[170px] sm:w-[210px]'
          } truncate bg-white text-stone-900 border border-[#B6CDA2] rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none`}
        >
          {reciters.map((r) => (
            <option key={r.id} value={r.id}>
              {r.arabicName || r.name}
            </option>
          ))}
        </select>

        {!compact && (
          <button
            type="button"
            onClick={() =>
              setRepeatMode((m) => (m === 'off' ? 'ayah' : m === 'ayah' ? 'surah' : 'off'))
            }
            title="Repeat Mode (Off / Ayah / Surah)"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-colors shrink-0 ${
              repeatMode !== 'off'
                ? 'bg-[#B6CDA2] border-[#B6CDA2] text-black'
                : 'bg-white border-[#B6CDA2]/70 text-stone-700 hover:bg-[#B6CDA2]/20'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>{repeatMode === 'off' ? 'Once' : repeatMode === 'ayah' ? 'Ayah' : 'Surah'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={togglePlaySelectedAyah}
          disabled={isBufferingAudio || reciters.length === 0}
          className={`inline-flex items-center gap-1 ${
            compact ? 'px-3 py-1' : 'px-3.5 py-1.5'
          } rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-900 disabled:opacity-60 transition-colors shadow-xs shrink-0`}
        >
          {isBufferingAudio ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          <span className="text-xs">
            {isBufferingAudio ? '…' : isPlaying ? 'Pause' : 'Play'}
          </span>
        </button>
      </div>
    </div>
  );

  // MODE 1: 1/4th Split-Screen Mode (Only Dependency Graph + Bottom Reciter Bar)
  if (layoutMode === 'quarter') {
    return (
      <div className="relative z-10 w-full h-screen overflow-hidden p-2 flex flex-col gap-2">
        {renderDependencyGraphCard('flex-1 min-h-0', true)}
        {renderReciterBar(true)}
      </div>
    );
  }

  // MODE 2: Tablet Portrait Mode (Top: Mushaf 62% + Tafsir/Translation 38%; Middle: Full-width Graph; Bottom: Reciter)
  if (layoutMode === 'portrait') {
    return (
      <div className="relative z-10 w-full max-w-[1100px] mx-auto px-2.5 sm:px-4 py-2 h-[calc(100vh-49px)] overflow-hidden flex flex-col gap-2.5">
        {/* Top Row: Mushaf (Left 62%) + Tafsir/Translation + Tools (Right 38%) */}
        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,62%)_minmax(0,38%)] gap-2.5">
          {renderMushafCard(true)}
          <div className="min-w-0 h-full min-h-0 flex flex-col overflow-hidden">
            {renderAnnotationToolbar(true)}
            {renderTranslationsCard(true)}
          </div>
        </div>

        {/* Middle Row: Full-Width Dependency Graph */}
        {renderDependencyGraphCard('h-[34%] min-h-[210px] max-h-[290px] shrink-0')}

        {/* Bottom Row: Full-Width Reciter */}
        {renderReciterBar(false)}
      </div>
    );
  }

  // MODE 3: Standard Landscape / Desktop Mode (Left 44%: Full-Height Mushaf; Right 56%: Toolbar + Graph + Tafsir + Reciter)
  return (
    <div className="relative z-10 w-full max-w-[1760px] mx-auto px-3 sm:px-5 py-2.5 h-[calc(100vh-49px)] overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)] gap-3.5 h-full min-h-0">
        {renderMushafCard(false)}

        <section className="min-w-0 w-full h-full min-h-0 flex flex-col gap-2.5 overflow-hidden">
          {renderAnnotationToolbar(false)}
          {renderDependencyGraphCard('h-[39%] min-h-[245px] shrink-0')}
          {renderTranslationsCard(false)}
          {renderReciterBar(false)}
        </section>
      </div>
    </div>
  );
};
