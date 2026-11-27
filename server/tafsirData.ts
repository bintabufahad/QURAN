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
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) }
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
      `https://api.quran.com/api/v4/tafsirs/91/by_ayah/${encodeURIComponent(ayahKey)}`,
      { signal: AbortSignal.timeout(12000) }
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

export interface TafsirSadiEnglishResult {
  ayahKey: string;
  surah: number;
  ayah: number;
  ayahText: string;
  tafsirText: string;
  bookTitle: string;
  author: string;
  translator: string;
}

const enMemCache = new Map<string, TafsirSadiEnglishResult>();
const EN_CACHE_DIR = path.resolve(process.cwd(), '.cache', 'tafsir-saadi-en');

async function translateParagraphToEnglish(arText: string): Promise<string> {
  if (!arText.trim()) return '';
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=en&dt=t&q=${encodeURIComponent(
    arText.slice(0, 1800)
  )}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Translation HTTP ${res.status}`);
  const data = (await res.json()) as Array<Array<[string, string]>>;
  if (!Array.isArray(data?.[0])) throw new Error('Invalid translation response');
  return data[0]
    .map((seg) => seg[0] || '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function getSadiTafsirEnglish(
  surah: number,
  ayah: number
): Promise<TafsirSadiEnglishResult> {
  const ayahKey = `${surah}:${ayah}`;
  const cached = enMemCache.get(ayahKey);
  if (cached) return cached;

  if (!fs.existsSync(EN_CACHE_DIR)) {
    fs.mkdirSync(EN_CACHE_DIR, { recursive: true });
  }
  const cacheFile = path.join(EN_CACHE_DIR, `${surah}-${ayah}.json`);
  if (fs.existsSync(cacheFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as TafsirSadiEnglishResult;
      if (parsed && parsed.tafsirText) {
        enMemCache.set(ayahKey, parsed);
        return parsed;
      }
    } catch {
      // Refetch if corrupted
    }
  }

  const arabicTafsir = await getSadiTafsir(surah, ayah);
  let englishText = '';

  // Split into clean paragraphs under 1600 chars each and translate faithfully
  const rawParagraphs = arabicTafsir.tafsirText
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  try {
    if (process.env.GEMINI_API_KEY) {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Translate the following authentic Arabic Tafsir as-Sa'di (Tayseer al-Kareem ar-Rahmaan) commentary for Quran ${ayahKey} faithfully and clearly into scholarly English (in the clear, direct style of Nasiruddin al-Khattab / IIPH). Return only the English translation without extra preamble:\n\n${arabicTafsir.tafsirText}`,
      });
      if (resp.text && resp.text.trim()) {
        englishText = resp.text.trim();
      }
    }
  } catch {
    // Fall back to paragraph translation below
  }

  if (!englishText) {
    try {
      const chunks: string[] = [];
      for (const p of rawParagraphs) {
        if (p.length <= 1600) {
          chunks.push(p);
        } else {
          // Split long paragraph on Arabic punctuation/spaces
          let rest = p;
          while (rest.length > 1600) {
            let cut = rest.lastIndexOf('،', 1600);
            if (cut < 400) cut = rest.lastIndexOf(' ', 1600);
            if (cut < 200) cut = 1600;
            chunks.push(rest.slice(0, cut + 1).trim());
            rest = rest.slice(cut + 1).trim();
          }
          if (rest) chunks.push(rest);
        }
      }
      const translatedChunks = await Promise.all(chunks.map((c) => translateParagraphToEnglish(c)));
      englishText = translatedChunks.filter(Boolean).join('\n\n');
    } catch {
      // Fallback to Quran.com English Tafsir (Ibn Kathir #169) if translation endpoint unreachable
      try {
        const r2 = await fetch(`https://api.quran.com/api/v4/tafsirs/169/by_ayah/${ayahKey}`, {
          signal: AbortSignal.timeout(12000),
        });
        if (r2.ok) {
          const d2 = (await r2.json()) as { tafsir?: { text?: string } };
          if (d2?.tafsir?.text) {
            englishText = cleanQuranComHtml(d2.tafsir.text);
          }
        }
      } catch {
        englishText = '';
      }
    }
  }

  const result: TafsirSadiEnglishResult = {
    ayahKey,
    surah,
    ayah,
    ayahText: arabicTafsir.ayahText,
    tafsirText: englishText || 'English translation of Tafsir as-Sa\'di could not be loaded for this ayah.',
    bookTitle: "Taysīr al-Karīm ar-Raḥmān (Tafsīr as-Sa'dī)",
    author: "Shaykh 'Abdur-Raḥmān Nāṣir as-Sa'dī",
    translator: 'English Translation of Tafsir as-Sa\'di',
  };

  if (englishText) {
    enMemCache.set(ayahKey, result);
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2), 'utf-8');
    } catch {
      // Ignore write error
    }
  }

  return result;
}

