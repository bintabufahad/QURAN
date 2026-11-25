import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  ensureQuranLinguisticsLoaded,
  getAyahLinguistics,
  getCoverageSummary,
} from './server/quranData.ts';
import { getRecitersCatalog, getSurahAyahTimings } from './server/recitersData.ts';
import { getSadiTafsir } from './server/tafsirData.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const CACHE_DIR = path.resolve(process.cwd(), '.cache');
const PLAYLISTS_FILE = path.join(CACHE_DIR, 'custom-recitations.json');

interface ChapterCache {
  chapters: unknown[];
}

let chaptersCache: ChapterCache | null = null;
const mushafPageCache = new Map<number, unknown>();
const surahVersesCache = new Map<number, unknown>();

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function loadSavedPlaylists(): unknown[] {
  ensureCacheDir();
  if (!fs.existsSync(PLAYLISTS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(PLAYLISTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePlaylists(list: unknown[]): void {
  ensureCacheDir();
  fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

async function fetchQuranComJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Quran.com API error ${res.status}: ${url}`);
  }
  return res.json();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Add instant health check route for Render
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/chapters', async (_req, res) => {
    try {
      if (!chaptersCache) {
        const data = await fetchQuranComJson('https://api.quran.com/api/v4/chapters?language=en');
        chaptersCache = data;
      }
      res.json(chaptersCache);
    } catch (err: any) {
      res.status(502).json({ error: err?.message || 'Failed to load chapters' });
    }
  });

  app.get('/api/mushaf/page/:pageNumber', async (req, res) => {
    const page = Number(req.params.pageNumber);
    if (!Number.isInteger(page) || page < 1 || page > 604) {
      res.status(400).json({ error: 'Page number must be between 1 and 604' });
      return;
    }

    try {
      if (!mushafPageCache.has(page)) {
        const url = `https://api.quran.com/api/v4/verses/by_page/${page}?words=true&word_fields=code_v2,v2_page,text_uthmani,text_uthmani_tajweed,line_number,page_number,location&translations=131&translation_fields=text,resource_name&per_page=50`;
        const data = await fetchQuranComJson(url);
        mushafPageCache.set(page, data);
      }
      res.json(mushafPageCache.get(page));
    } catch (err: any) {
      res.status(502).json({ error: err?.message || 'Failed to load Mushaf page' });
    }
  });

  app.get('/api/fonts/qbsml.woff2', async (_req, res) => {
    try {
      ensureCacheDir();
      const fontPath = path.join(CACHE_DIR, 'QCF4_QBSML.woff2');
      let buf: Buffer;
      if (fs.existsSync(fontPath) && fs.statSync(fontPath).size > 100000) {
        buf = fs.readFileSync(fontPath);
      } else {
        const fontRes = await fetch(
          'https://huggingface.co/datasets/MohamadHajjRabee/quran-qcf4/resolve/main/fonts-woff2/QCF4_QBSML.woff2'
        );
        if (!fontRes.ok) {
          throw new Error(`Failed to fetch QCF4_QBSML.woff2: ${fontRes.status}`);
        }
        buf = Buffer.from(await fontRes.arrayBuffer());
        fs.writeFileSync(fontPath, buf);
      }
      res.setHeader('Content-Type', 'font/woff2');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(buf);
    } catch (err: any) {
      res.status(502).json({ error: err?.message || 'Failed to load QCF4 Surah header font' });
    }
  });

  app.get('/api/surah/:surahNumber/verses', async (req, res) => {
    const surah = Number(req.params.surahNumber);
    if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
      res.status(400).json({ error: 'Surah number must be between 1 and 114' });
      return;
    }

    try {
      if (!surahVersesCache.has(surah)) {
        const allVerses: any[] = [];
        let page = 1;
        let totalPages = 1;
        while (page <= totalPages) {
          const url = `https://api.quran.com/api/v4/verses/by_chapter/${surah}?words=true&word_fields=code_v2,v2_page,text_uthmani,text_uthmani_tajweed,line_number,page_number,location&translations=131&translation_fields=text&per_page=50&page=${page}`;
          const data = await fetchQuranComJson(url);
          if (Array.isArray(data.verses)) {
            allVerses.push(...data.verses);
          }
          totalPages = data.pagination?.total_pages || 1;
          page++;
        }
        surahVersesCache.set(surah, { surah, verses: allVerses });
      }
      res.json(surahVersesCache.get(surah));
    } catch (err: any) {
      res.status(502).json({ error: err?.message || 'Failed to load Surah verses' });
    }
  });

  app.get('/api/linguistics/ayah/:surah/:ayah', async (req, res) => {
    const surah = Number(req.params.surah);
    const ayah = Number(req.params.ayah);
    if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1) {
      res.status(400).json({ error: 'Invalid surah or ayah coordinate' });
      return;
    }

    try {
      const [ling, quranVerseRes] = await Promise.all([
        getAyahLinguistics(surah, ayah),
        fetchQuranComJson(
          `https://api.quran.com/api/v4/verses/by_key/${surah}:${ayah}?words=true&word_fields=text_uthmani,text_uthmani_tajweed,location&translations=131&translation_fields=text`
        ).catch(() => null),
      ]);

      const verseData = quranVerseRes?.verse || null;
      const wbwTranslations: Record<number, { translation: string; transliteration: string; audioUrl: string | null; textTajweed: string }> = {};
      if (verseData?.words) {
        for (const w of verseData.words) {
          if (w.char_type_name === 'word') {
            wbwTranslations[w.position] = {
              translation: w.translation?.text || '',
              transliteration: w.transliteration?.text || '',
              audioUrl: w.audio_url ? `https://audio.qurancdn.com/${w.audio_url}` : null,
              textTajweed: w.text_uthmani_tajweed || w.text_uthmani || '',
            };
          }
        }
      }

      const enrichedWords = ling.words.map((w) => ({
        ...w,
        wbwTranslation: wbwTranslations[w.wordIndex]?.translation || '',
        transliteration: wbwTranslations[w.wordIndex]?.transliteration || '',
        wordAudioUrl: wbwTranslations[w.wordIndex]?.audioUrl || null,
        textTajweed: wbwTranslations[w.wordIndex]?.textTajweed || w.arabicFull,
      }));

      // Enrich graph word nodes with phonetic + WBW translation for corpus.quran.com header rows
      const enrichedGraphs = ling.graphs.map((g) => ({
        ...g,
        nodes: g.nodes.map((node) => {
          if (
            (node.kind === 'word' || node.kind === 'reference') &&
            node.location &&
            (node.displaySegments !== undefined || node.segmentIndex === 0)
          ) {
            const locParts = node.location.split(':').map(Number);
            if (locParts[0] === surah && locParts[1] === ayah) {
              const wbw = wbwTranslations[locParts[2]];
              if (wbw) {
                return {
                  ...node,
                  phonetic: node.phonetic || wbw.transliteration || undefined,
                  translation: node.translation || wbw.translation || undefined,
                };
              }
            }
          }
          return node;
        }),
      }));

      res.json({
        ...ling,
        graphs: enrichedGraphs,
        verseTextUthmani: verseData?.text_uthmani || enrichedWords.map((w) => w.arabicFull).join(' '),
        verseTranslation: verseData?.translations?.[0]?.text || '',
        words: enrichedWords,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to compute ayah linguistics' });
    }
  });

  app.get('/api/linguistics/coverage', async (_req, res) => {
    try {
      const summary = await getCoverageSummary();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to read coverage summary' });
    }
  });

  app.get('/api/tafsir/sadi/:surah/:ayah', async (req, res) => {
    const surah = Number(req.params.surah);
    const ayah = Number(req.params.ayah);
    if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1) {
      res.status(400).json({ error: 'Invalid surah or ayah coordinate' });
      return;
    }
    try {
      const tafsir = await getSadiTafsir(surah, ayah);
      res.json(tafsir);
    } catch (err: any) {
      res.status(502).json({ error: err?.message || "Failed to load Tafsir as-Sa'di" });
    }
  });

  app.get('/api/reciters', async (req, res) => {
    try {
      const catalog = await getRecitersCatalog();
      const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
      const featuredOnly = req.query.featured === 'true';

      let result = catalog;
      if (featuredOnly) {
        result = result.filter((r) => r.featured);
      } else if (query) {
        result = result.filter(
          (r) =>
            r.name.toLowerCase().includes(query) ||
            (r.arabicName && r.arabicName.includes(query)) ||
            r.rewaya.toLowerCase().includes(query)
        );
      }
      res.json({ reciters: result, total: catalog.length });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || 'Failed to load reciters catalog' });
    }
  });

  app.get('/api/recitations/timing/:readId/:surah', async (req, res) => {
    const readId = Number(req.params.readId);
    const surah = Number(req.params.surah);
    if (!Number.isInteger(readId) || !Number.isInteger(surah) || surah < 1 || surah > 114) {
      res.status(400).json({ error: 'Invalid readId or surah number' });
      return;
    }

    try {
      const timings = await getSurahAyahTimings(readId, surah);
      res.json({ readId, surah, timings });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || 'Failed to load ayah timings' });
    }
  });

  app.get('/api/recitations/playlists', (_req, res) => {
    res.json({ playlists: loadSavedPlaylists() });
  });

  app.post('/api/recitations/playlists', (req, res) => {
    const body = req.body;
    if (!body || typeof body.name !== 'string' || !Array.isArray(body.segments)) {
      res.status(400).json({ error: 'Invalid recitation configuration payload' });
      return;
    }
    const existing = loadSavedPlaylists() as Array<{ id: string }>;
    const id = typeof body.id === 'string' && body.id ? body.id : `rec-${Date.now()}`;
    const item = {
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };
    const filtered = existing.filter((p) => p.id !== id);
    filtered.unshift(item);
    savePlaylists(filtered);
    res.json({ playlist: item, playlists: filtered });
  });

  app.delete('/api/recitations/playlists/:id', (req, res) => {
    const id = req.params.id;
    const existing = loadSavedPlaylists() as Array<{ id: string }>;
    const filtered = existing.filter((p) => p.id !== id);
    savePlaylists(filtered);
    res.json({ playlists: filtered });
  });

  // Vite dev middleware OR production static files
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bayan Al-Mushaf server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
