import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.resolve(process.cwd(), '.cache', 'tafsir-saadi');

export interface TafsirSadiResult {
  ayahKey: string;
  surah: number;
  ayah: number;
  ayahText: string;
  tafsirText: string;
  bookTitle: string;
  author: string;
  sourceLabel: string;
  tashkeelPolicy: string;
}

const memCache = new Map<string, TafsirSadiResult>();

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanTafsirAppText(raw: string): string {
  return decodeHtmlEntities(raw)
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanQuranComHtml(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function getSadiTafsir(surah: number, ayah: number): Promise<TafsirSadiResult> {
  const ayahKey = `${surah}:${ayah}`;
  const cachedMem = memCache.get(ayahKey);
  if (cachedMem) return cachedMem;

  ensureCacheDir();
  const cacheFile = path.join(CACHE_DIR, `${surah}-${ayah}.json`);
  if (fs.existsSync(cacheFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as TafsirSadiResult;
      if (parsed && parsed.tafsirText) {
        memCache.set(ayahKey, parsed);
        return parsed;
      }
    } catch {
      // Re-fetch if corrupted
    }
  }

  let ayahText = '';
  let tafsirText = '';
  let sourceLabel = 'مركز تفسير للدراسات القرآنية (tafsir.app)';

  // 1. Primary authentic scholarly source: tafsir.app (Markaz Tafsir)
  try {
    const res = await fetch(
      `https://tafsir.app/get.php?src=saadi&s=${encodeURIComponent(String(surah))}&a=${encodeURIComponent(String(ayah))}`,
      { headers: { Accept: 'application/json' } }
    );
    if (res.ok) {
      const json = (await res.json()) as { ayah?: string; data?: string };
      if (json?.data && json.data.trim().length > 0) {
        ayahText = cleanTafsirAppText(json.ayah || '');
        tafsirText = cleanTafsirAppText(json.data);
      }
    }
  } catch {
    // Fall back to Quran.com #91 below
  }

  // 2. Verified fallback source: Quran.com v4 Tafsir #91 (Tafseer Al-Saddi)
  if (!tafsirText) {
    const qRes = await fetch(
      `https://api.quran.com/api/v4/tafsirs/91/by_ayah/${encodeURIComponent(ayahKey)}`
    );
    if (!qRes.ok) {
      throw new Error(`Failed to fetch Tafsir as-Sa'di for ${ayahKey}: ${qRes.status}`);
    }
    const qJson = (await qRes.json()) as { tafsir?: { text?: string } };
    const rawHtml = qJson?.tafsir?.text || '';
    if (!rawHtml.trim()) {
      throw new Error(`Empty Tafsir as-Sa'di response for ${ayahKey}`);
    }
    tafsirText = cleanQuranComHtml(rawHtml);
    sourceLabel = 'مؤسسة القرآن الكريم (Quran.com Tafsir #91)';
  }

  const result: TafsirSadiResult = {
    ayahKey,
    surah,
    ayah,
    ayahText,
    tafsirText,
    bookTitle: 'تيسير الكريم الرحمن في تفسير كلام المنان (تفسير السعدي)',
    author: 'الشيخ عبد الرحمن بن ناصر السعدي (ت ١٣٧٦ هـ)',
    sourceLabel,
    tashkeelPolicy:
      'النص العلمي المعتمد كما نشره مركز تفسير للدراسات القرآنية: الآيات القرآنية مضبوطة بالشكل الكامل، مع ضبط الكلمات المحتملة للالتباس دون توليد تشكيل آلي.',
  };

  memCache.set(ayahKey, result);
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2), 'utf-8');
  } catch {
    // Ignore disk cache write errors in read-only scenarios
  }

  return result;
}
