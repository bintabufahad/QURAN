import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.resolve(process.cwd(), '.cache');

export interface ReciterProfile {
  id: string;
  mp3quranReciterId: number;
  moshafId: number;
  name: string;
  arabicName?: string;
  rewaya: string;
  serverUrl: string;
  surahTotal: number;
  availableSurahs: number[];
  missingSurahs: number[];
  isComplete: boolean;
  hasExactAyahTiming: boolean;
  timingReadId?: number;
  featured: boolean;
  notes?: string;
}

interface Mp3QuranMoshaf {
  id: number;
  name: string;
  server: string;
  surah_total: number;
  surah_list: string;
}

interface Mp3QuranReciter {
  id: number;
  name: string;
  moshaf: Mp3QuranMoshaf[];
}

interface TimingReadItem {
  id: number;
  name: string;
  rewaya: string;
  folder_url: string;
  soar_count: number;
}

export interface AyahTiming {
  ayah: number;
  startTimeMs: number;
  endTimeMs: number;
  precision: 'exact-ms' | 'proportional';
}

const FEATURED_PRIORITY: Record<
  number,
  { order: number; nameEn: string; arabicName: string; notes: string }
> = {
  86: {
    order: 1,
    nameEn: 'Nasser Al-Qatami',
    arabicName: 'الشيخ ناصر القطامي',
    notes: 'كامل المصحف ١١٤ سورة · توقيت آيات دقيق · Complete 114 Surahs',
  },
  259: {
    order: 2,
    nameEn: 'Ahmad Al-Nafis',
    arabicName: 'الشيخ أحمد النفيس',
    notes: 'كامل المصحف ١١٤ سورة · توقيت آيات دقيق · Complete 114 Surahs',
  },
  253: {
    order: 3,
    nameEn: 'Islam Sobhi',
    arabicName: 'الشيخ إسلام صبحي',
    notes: 'مجموعة غير مكتملة (١٠٩/١١٤ سورة · تنقص ٣٧، ٣٩، ٤٠، ٤٥، ٦٥) · Incomplete 109/114',
  },
  123: {
    order: 4,
    nameEn: 'Mishary Rashid Alafasy',
    arabicName: 'الشيخ مشاري راشد العفاسي',
    notes: 'كامل المصحف ١١٤ سورة · توقيت آيات دقيق · Complete 114 Surahs',
  },
  51: {
    order: 5,
    nameEn: 'Abdulbasit Abdulsamad (Mujawwad)',
    arabicName: 'الشيخ عبد الباسط عبد الصمد (المصحف المجود)',
    notes: 'المصحف المجود الكامل ١١٤ سورة (النسخة الأطول) · Mujawwad Complete 114/114',
  },
  113: {
    order: 6,
    nameEn: 'Mohammed Siddiq Al-Minshawi (Mujawwad)',
    arabicName: 'الشيخ محمد صديق المنشاوي (المصحف المجود)',
    notes: 'المصحف المجود الكامل ١١٤ سورة (النسخة الأطول) · Mujawwad Complete 114/114',
  },
  119: {
    order: 7,
    nameEn: 'Mahmoud Khalil Al-Husary (Mujawwad)',
    arabicName: 'الشيخ محمود خليل الحصري (المصحف المجود)',
    notes: 'المصحف المجود الكامل ١١٤ سورة (النسخة الأطول) · Mujawwad Complete 114/114',
  },
  92: {
    order: 8,
    nameEn: 'Yasser Al-Dosari',
    arabicName: 'الشيخ ياسر الدوسري',
    notes: 'كامل المصحف ١١٤ سورة · توقيت آيات دقيق · Complete 114 Surahs',
  },
};

let cachedReciters: ReciterProfile[] | null = null;
const timingCache = new Map<string, AyahTiming[]>();

function computeMissingSurahs(available: number[]): number[] {
  const set = new Set(available);
  const missing: number[] = [];
  for (let s = 1; s <= 114; s++) {
    if (!set.has(s)) missing.push(s);
  }
  return missing;
}

export async function getRecitersCatalog(): Promise<ReciterProfile[]> {
  if (cachedReciters) return cachedReciters;

  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  const catalogCachePath = path.join(CACHE_DIR, 'mp3quran-catalog.json');
  if (fs.existsSync(catalogCachePath)) {
    const stat = fs.statSync(catalogCachePath);
    if (Date.now() - stat.mtimeMs < 1000 * 60 * 60 * 24) {
      try {
        cachedReciters = JSON.parse(fs.readFileSync(catalogCachePath, 'utf-8'));
        if (cachedReciters && cachedReciters.length > 0) return cachedReciters;
      } catch {
        // Refetch on corrupt cache
      }
    }
  }

  const [recRes, readsRes] = await Promise.all([
    fetch('https://www.mp3quran.net/api/v3/reciters?language=en', {
      signal: AbortSignal.timeout(12000),
    }).then((r) => r.json()) as Promise<{
      reciters: Mp3QuranReciter[];
    }>,
    fetch('https://www.mp3quran.net/api/v3/ayat_timing/reads', {
      signal: AbortSignal.timeout(12000),
    }).then((r) => r.json()) as Promise<TimingReadItem[]>,
  ]);

  const timingByMoshafId = new Map<number, TimingReadItem>();
  for (const item of readsRes) {
    timingByMoshafId.set(item.id, item);
  }

  const profiles: ReciterProfile[] = [];

  for (const rec of recRes.reciters || []) {
    for (const m of rec.moshaf || []) {
      const available = m.surah_list
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n) && n >= 1 && n <= 114);
      const missing = computeMissingSurahs(available);

      const featMeta = FEATURED_PRIORITY[m.id];
      const isFeatured = Boolean(featMeta);
      const timingItem = timingByMoshafId.get(m.id);

      // Skip secondary riwayat unless explicitly featured (e.g., Mujawwad moshafs 51, 113, 119)
      if (!isFeatured && rec.moshaf[0]?.id !== m.id) continue;

      const displayName = featMeta?.nameEn || rec.name;
      const arabicName = featMeta?.arabicName || timingItem?.name;
      const notes =
        featMeta?.notes ||
        (available.length === 114
          ? 'كامل المصحف ١١٤ سورة · Complete 114 Surahs'
          : `مجموعة غير مكتملة (${available.length}/١١٤) · Incomplete (${available.length}/114)`);

      profiles.push({
        id: `mp3q-${m.id}`,
        mp3quranReciterId: rec.id,
        moshafId: m.id,
        name: displayName,
        arabicName,
        rewaya: m.name,
        serverUrl: m.server.endsWith('/') ? m.server : `${m.server}/`,
        surahTotal: available.length,
        availableSurahs: available,
        missingSurahs: missing,
        isComplete: available.length === 114,
        hasExactAyahTiming: Boolean(timingItem),
        timingReadId: timingItem?.id,
        featured: isFeatured,
        notes,
      });
    }
  }

  // Ensure Ahmad Al-Nafis (259) is explicitly present if MP3Quran didn't include him in EN endpoint
  if (!profiles.some((p) => p.moshafId === 259)) {
    const timing259 = timingByMoshafId.get(259);
    if (timing259) {
      const all114 = Array.from({ length: 114 }, (_, i) => i + 1);
      profiles.push({
        id: 'mp3q-259',
        mp3quranReciterId: 259,
        moshafId: 259,
        name: 'Ahmad Al-Nafis',
        arabicName: 'الشيخ أحمد النفيس',
        rewaya: "Rewayat Hafs A'n Assem - Murattal",
        serverUrl: timing259.folder_url.endsWith('/') ? timing259.folder_url : `${timing259.folder_url}/`,
        surahTotal: 114,
        availableSurahs: all114,
        missingSurahs: [],
        isComplete: true,
        hasExactAyahTiming: true,
        timingReadId: 259,
        featured: true,
        notes: FEATURED_PRIORITY[259].notes,
      });
    }
  }

  // Sort: featured first by priority order, then exact timing reciters, then alphabetical
  profiles.sort((a, b) => {
    const fa = FEATURED_PRIORITY[a.moshafId]?.order ?? (a.featured ? 50 : 999);
    const fb = FEATURED_PRIORITY[b.moshafId]?.order ?? (b.featured ? 50 : 999);
    if (fa !== fb) return fa - fb;
    if (a.hasExactAyahTiming !== b.hasExactAyahTiming) return a.hasExactAyahTiming ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  cachedReciters = profiles;
  fs.writeFileSync(catalogCachePath, JSON.stringify(profiles), 'utf-8');
  return profiles;
}

export async function getSurahAyahTimings(readId: number, surah: number): Promise<AyahTiming[]> {
  const key = `${readId}:${surah}`;
  if (timingCache.has(key)) return timingCache.get(key)!;

  const url = `https://www.mp3quran.net/api/v3/ayat_timing?surah=${surah}&read=${readId}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) return [];

  const data = (await res.json()) as Array<{
    ayah: number;
    start_time: number;
    end_time: number;
  }>;

  if (!Array.isArray(data)) return [];

  const timings: AyahTiming[] = data
    .filter((d) => d.ayah >= 1)
    .map((d) => ({
      ayah: Number(d.ayah),
      startTimeMs: Number(d.start_time),
      endTimeMs: Number(d.end_time),
      precision: 'exact-ms' as const,
    }))
    .sort((a, b) => a.ayah - b.ayah);

  timingCache.set(key, timings);
  return timings;
}
