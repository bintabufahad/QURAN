/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import {
  Chapter,
  CustomAudioSource,
  CustomRecitationConfig,
  ReciterProfile,
} from './types/quran';
import { MushafReader } from './components/MushafReader';
import { DependencyLabView } from './components/DependencyLabView';
import { RecitationBuilder } from './components/RecitationBuilder';
import { RecitationPlayerBar } from './components/RecitationPlayerBar';
import { ResearchMatrixView } from './components/ResearchMatrixView';
import { loadCustomAudioMeta } from './utils/customAudioStore';

type ActiveTab = 'mushaf' | 'dependency' | 'recitation' | 'sources';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('mushaf');
  const [darkMode, setDarkMode] = useState(false);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [reciters, setReciters] = useState<ReciterProfile[]>([]);
  const [savedPlaylists, setSavedPlaylists] = useState<CustomRecitationConfig[]>([]);
  const [customAudioSources, setCustomAudioSources] = useState<CustomAudioSource[]>(() =>
    loadCustomAudioMeta()
  );

  // Mushaf & Dependency Lab state
  const [mushafPage, setMushafPage] = useState<number>(1);
  const [labCoord, setLabCoord] = useState<{ surah: number; ayah: number }>({
    surah: 1,
    ayah: 1,
  });

  // Active Custom Recitation Audio Playback
  const [playingConfig, setPlayingConfig] = useState<CustomRecitationConfig | null>(null);
  const [playingStartIdx, setPlayingStartIdx] = useState<number>(0);
  const [activePlayingAyahKey, setActivePlayingAyahKey] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    fetch('/api/chapters')
      .then((r) => r.json())
      .then((d) => setChapters(d.chapters || []))
      .catch(() => {});

    fetch('/api/reciters')
      .then((r) => r.json())
      .then((d) => setReciters(d.reciters || []))
      .catch(() => {});

    fetch('/api/recitations/playlists')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.playlists)) {
          setSavedPlaylists(d.playlists);
        }
      })
      .catch(() => {});
  }, []);

  const handleSavePlaylist = async (config: CustomRecitationConfig) => {
    const res = await fetch('/api/recitations/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (res.ok) {
      const data = await res.json();
      setSavedPlaylists(data.playlists || []);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    const res = await fetch(`/api/recitations/playlists/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const data = await res.json();
      setSavedPlaylists(data.playlists || []);
    }
  };

  const handlePlayFromAyah = (surah: number, ayah: number) => {
    const ch = chapters.find((c) => c.id === surah);
    const maxAyah = ch?.verses_count || ayah;
    const quickConfig: CustomRecitationConfig = {
      id: `quick-${surah}-${ayah}`,
      name: `${ch?.name_simple || `Surah ${surah}`} (${ayah}–${maxAyah})`,
      surah,
      autoFallback: true,
      defaultFallbackReciterId: 'mp3q-86',
      segments: [
        {
          id: 'quick-seg-1',
          surah,
          startAyah: ayah,
          endAyah: maxAyah,
          reciterId: 'mp3q-86', // Nasser Al-Qatami default quick play
        },
      ],
    };
    setPlayingStartIdx(0);
    setPlayingConfig(quickConfig);
  };

  const handleOpenFullGraph = (surah: number, ayah: number) => {
    setLabCoord({ surah, ayah });
    setActiveTab('dependency');
  };

  const handleStartPlayback = (config: CustomRecitationConfig, startSegmentIdx = 0) => {
    setPlayingStartIdx(startSegmentIdx);
    setPlayingConfig({ ...config });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F3] dark:bg-[#0F1419] text-stone-900 dark:text-stone-100">
      {/* Strict 3-Zone Top Bar Contract — Bilingual (Arabic first, subtle English below) */}
      <header className="sticky top-0 z-30 border-b border-stone-200 dark:border-stone-800 bg-[#FAF8F3]/95 dark:bg-[#0F1419]/95 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#mushaf"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('mushaf');
            }}
            className="flex flex-col leading-tight whitespace-nowrap shrink-0"
          >
            <span className="font-ar text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
              بيان المصحف
            </span>
            <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400">
              Bayan Al-Mushaf
            </span>
          </a>

          {/* Zone 2: 4 Clean Bilingual Nav Links */}
          <nav className="flex items-center gap-4 sm:gap-7 overflow-x-auto text-xs font-medium">
            {(
              [
                { id: 'mushaf', ar: 'المصحف الشريف', en: 'Mushaf Reader' },
                { id: 'dependency', ar: 'مختبر الإعراب', en: 'Dependency Lab' },
                { id: 'recitation', ar: 'منشئ التلاوة', en: 'Recitation Builder' },
                { id: 'sources', ar: 'المصادر والتدقيق', en: 'Data & Sources' },
              ] as const
            ).map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 text-center leading-tight ${
                    isActive
                      ? 'border-emerald-800 dark:border-emerald-400 text-stone-900 dark:text-stone-100 font-semibold'
                      : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  <span className="block text-xs sm:text-[13px]">{item.ar}</span>
                  <span className="block text-[9.5px] opacity-70">{item.en}</span>
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('recitation')}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 transition-colors whitespace-nowrap shrink-0 text-center leading-tight"
            >
              <span className="block text-xs font-semibold">إنشاء تلاوة</span>
              <span className="block text-[9px] text-emerald-100">Create Recitation</span>
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Quiet Utility Bar below Header (Theme Toggle + Context) */}
      <div className="border-b border-stone-200/70 dark:border-stone-800/70 bg-stone-100/50 dark:bg-[#11161C]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-4 text-xs text-stone-600 dark:text-stone-400">
          <div className="flex items-center gap-2 truncate">
            <span className="font-medium text-stone-700 dark:text-stone-300">
              مصحف المدينة المنورة (١٤٤١هـ) · شجرة الإعراب الكاملة · تلاوة مخصصة متعدد القراء
            </span>
            <span className="hidden md:inline text-[10px] text-stone-400">
              (KFGQPC V4 Mushaf · Full Dependency Graphs · Multi-Reciter Studio)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{darkMode ? 'الورق الفاتح · Light' : 'الوضع الليلي · Night'}</span>
          </button>
        </div>
      </div>

      {/* Main Active Workspace */}
      <main className={`flex-1 ${playingConfig ? 'pb-24' : 'pb-12'}`}>
        {activeTab === 'mushaf' && (
          <MushafReader
            chapters={chapters}
            page={mushafPage}
            onChangePage={setMushafPage}
            activePlayingAyahKey={activePlayingAyahKey}
            onPlayFromAyah={handlePlayFromAyah}
            onOpenFullGraph={handleOpenFullGraph}
          />
        )}

        {activeTab === 'dependency' && (
          <DependencyLabView
            chapters={chapters}
            surah={labCoord.surah}
            ayah={labCoord.ayah}
            onChangeCoordinate={(s, a) => setLabCoord({ surah: s, ayah: a })}
            onPlayAyah={handlePlayFromAyah}
          />
        )}

        {activeTab === 'recitation' && (
          <RecitationBuilder
            chapters={chapters}
            reciters={reciters}
            customAudioSources={customAudioSources}
            onUpdateCustomAudioSources={setCustomAudioSources}
            savedPlaylists={savedPlaylists}
            onSavePlaylist={handleSavePlaylist}
            onDeletePlaylist={handleDeletePlaylist}
            onStartPlayback={handleStartPlayback}
            activeConfigId={playingConfig?.id}
          />
        )}

        {activeTab === 'sources' && (
          <ResearchMatrixView
            reciters={reciters}
            onNavigateToLab={(s, a) => {
              setLabCoord({ surah: s, ayah: a });
              setActiveTab('dependency');
            }}
          />
        )}
      </main>

      {/* Persistent Gapless Multi-Reciter Audio Player */}
      <RecitationPlayerBar
        config={playingConfig}
        startSegmentIdx={playingStartIdx}
        chapters={chapters}
        reciters={reciters}
        customAudioSources={customAudioSources}
        onActiveAyahChange={setActivePlayingAyahKey}
        onClose={() => setPlayingConfig(null)}
      />
    </div>
  );
}
