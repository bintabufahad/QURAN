/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useMemo, useState } from 'react';
import { Chapter, CustomAudioSource, CustomRecitationConfig, ReciterProfile } from './types/quran';
import { MushafDashboard, DashboardLayoutMode } from './components/MushafDashboard';
import { RecitationBuilder } from './components/RecitationBuilder';
import { RecitationPlayerBar } from './components/RecitationPlayerBar';
import { ResearchMatrixView } from './components/ResearchMatrixView';
import { PistachioParticles } from './components/PistachioParticles';
import { loadCustomAudioMeta } from './utils/customAudioStore';

type ActiveView = 'dashboard' | 'recitation-builder' | 'sources';
type LayoutPreference = 'auto' | DashboardLayoutMode;

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [reciters, setReciters] = useState<ReciterProfile[]>([]);
  const [savedPlaylists, setSavedPlaylists] = useState<CustomRecitationConfig[]>([]);
  const [customAudioSources, setCustomAudioSources] = useState<CustomAudioSource[]>(() =>
    loadCustomAudioMeta()
  );
  const [activeRecitationConfig, setActiveRecitationConfig] =
    useState<CustomRecitationConfig | null>(null);
  const [activeSegmentIdx, setActiveSegmentIdx] = useState<number>(0);
  const [activePlayingAyahKey, setActivePlayingAyahKey] = useState<string | null>(null);

  const [layoutPref, setLayoutPref] = useState<LayoutPreference>('auto');
  const [viewport, setViewport] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    const onResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const effectiveLayout: DashboardLayoutMode = useMemo(() => {
    if (layoutPref !== 'auto') return layoutPref;
    // Quarter-screen / split-mode compact strip (e.g. 1/4th bottom split while Focus Timer uses top 3/4)
    if (viewport.height <= 460 || (viewport.width <= 380 && viewport.height <= 540)) {
      return 'quarter';
    }
    if (viewport.height > viewport.width) {
      return 'portrait';
    }
    return 'landscape';
  }, [layoutPref, viewport]);

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

  const handleStartCustomPlayback = (config: CustomRecitationConfig, startSegmentIdx = 0) => {
    setActiveRecitationConfig(config);
    setActiveSegmentIdx(startSegmentIdx);
    setActiveView('dashboard');
  };

  const hideTopHeader = activeView === 'dashboard' && effectiveLayout === 'quarter';

  return (
    <div className="min-h-screen flex flex-col bg-black text-stone-900 relative overflow-x-hidden">
      {/* Pistachio Green (#B6CDA2) Reference Background with Water Reflections & Glitter */}
      <PistachioParticles />

      {/* Slim Top Navigation Bar (hidden automatically in 1/4th Split Mode to maximize space) */}
      {!hideTopHeader && (
        <header className="sticky top-0 z-40 border-b border-[#B6CDA2]/25 bg-black/80 backdrop-blur-md">
          <div className="max-w-[1720px] mx-auto px-3 sm:px-6 h-12 flex items-center justify-between gap-3 overflow-x-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className="font-ar text-sm sm:text-base font-bold text-[#B6CDA2] whitespace-nowrap shrink-0"
            >
              بيان المصحف · Bayan Al-Mushaf
            </button>

            <div className="flex items-center gap-3 shrink-0">
              {activeView === 'dashboard' && (
                <div className="hidden sm:flex items-center gap-1 bg-stone-950/80 border border-[#B6CDA2]/35 rounded-lg p-0.5 text-[11px]">
                  {(
                    [
                      { id: 'auto', label: 'Auto' },
                      { id: 'landscape', label: 'Landscape' },
                      { id: 'portrait', label: 'Portrait' },
                      { id: 'quarter', label: '1/4 Split' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setLayoutPref(opt.id)}
                      className={`px-2 py-0.5 rounded font-semibold transition-colors whitespace-nowrap ${
                        layoutPref === opt.id
                          ? 'bg-[#B6CDA2] text-black'
                          : 'text-stone-300 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              <nav className="flex items-center gap-2 sm:gap-3 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveView('dashboard')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                    activeView === 'dashboard'
                      ? 'bg-[#B6CDA2] text-black font-bold'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  المصحف
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('recitation-builder')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                    activeView === 'recitation-builder'
                      ? 'bg-[#B6CDA2] text-black font-bold'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  إنشاء تلاوة
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('sources')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                    activeView === 'sources'
                      ? 'bg-[#B6CDA2] text-black font-bold'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  المصادر
                </button>
              </nav>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={`flex-1 relative z-10 ${activeRecitationConfig ? 'pb-20' : ''}`}>
        {activeView === 'dashboard' && (
          <MushafDashboard
            chapters={chapters}
            reciters={reciters}
            layoutMode={effectiveLayout}
            showExitQuarterButton={layoutPref === 'quarter'}
            onExitQuarterMode={() => setLayoutPref('auto')}
            activePlayingAyahKey={activePlayingAyahKey}
            onOpenCreateRecitation={() => setActiveView('recitation-builder')}
          />
        )}

        {activeView === 'recitation-builder' && (
          <div className="max-w-[1440px] mx-auto px-4 py-4">
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className="mb-3 px-3.5 py-1.5 text-xs rounded-lg bg-[#FCF9F0] border-2 border-[#B6CDA2] text-stone-900 font-semibold hover:bg-[#B6CDA2]/20 transition-colors"
            >
              ← العودة للمصحف · Back to Mushaf
            </button>
            <RecitationBuilder
              chapters={chapters}
              reciters={reciters}
              customAudioSources={customAudioSources}
              onUpdateCustomAudioSources={setCustomAudioSources}
              savedPlaylists={savedPlaylists}
              onSavePlaylist={handleSavePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onStartPlayback={handleStartCustomPlayback}
              activeConfigId={activeRecitationConfig?.id}
            />
          </div>
        )}

        {activeView === 'sources' && (
          <div className="max-w-[1440px] mx-auto px-4 py-4">
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className="mb-3 px-3.5 py-1.5 text-xs rounded-lg bg-[#FCF9F0] border-2 border-[#B6CDA2] text-stone-900 font-semibold hover:bg-[#B6CDA2]/20 transition-colors"
            >
              ← العودة للمصحف · Back to Mushaf
            </button>
            <ResearchMatrixView
              reciters={reciters}
              onNavigateToLab={() => setActiveView('dashboard')}
            />
          </div>
        )}
      </main>

      {/* Active Custom Multi-Reciter Playback Bar */}
      {activeRecitationConfig && (
        <RecitationPlayerBar
          config={activeRecitationConfig}
          startSegmentIdx={activeSegmentIdx}
          chapters={chapters}
          reciters={reciters}
          customAudioSources={customAudioSources}
          onActiveAyahChange={setActivePlayingAyahKey}
          onClose={() => {
            setActiveRecitationConfig(null);
            setActivePlayingAyahKey(null);
          }}
        />
      )}
    </div>
  );
}
