export interface Chapter {
  id: number;
  revelation_place: string;
  revelation_order: number;
  bismillah_pre: boolean;
  name_simple: string;
  name_complex: string;
  name_arabic: string;
  verses_count: number;
  pages: [number, number];
}

export interface QuranWord {
  id: number;
  position: number;
  audio_url: string | null;
  char_type_name: 'word' | 'end' | string;
  text_uthmani: string;
  text_uthmani_tajweed?: string;
  code_v2?: string;
  v2_page?: number;
  line_number: number;
  location: string;
  page_number: number;
  translation?: {
    text: string;
    language_name: string;
  };
  transliteration?: {
    text: string | null;
    language_name: string;
  };
}

export interface QuranVerse {
  id: number;
  verse_number: number;
  verse_key: string;
  hizb_number: number;
  rub_el_hizb_number: number;
  page_number: number;
  juz_number: number;
  text_uthmani?: string;
  words: QuranWord[];
  translations?: Array<{
    id: number;
    resource_id: number;
    text: string;
    resource_name?: string;
  }>;
}

export interface MorphSegment {
  location: string;
  wordIndex: number;
  segmentIndex: number;
  arabic: string;
  pos: string;
  posLabel: string;
  posArabic: string;
  role: 'PREFIX' | 'STEM' | 'SUFFIX';
  root?: string;
  lemma?: string;
  fam?: string;
  features: string[];
  grammarTags: string[];
  englishDescription?: string;
  arabicDescription?: string;
  caseState?: 'NOM' | 'ACC' | 'GEN';
  mood?: 'IND' | 'SUBJ' | 'JUS';
  voice?: 'ACT' | 'PASS';
  verbForm?: string;
  gender?: 'M' | 'F';
  number?: 'S' | 'D' | 'P';
  person?: '1' | '2' | '3';
  rawFeatures: string;
}

export interface WordMorphology {
  surah: number;
  ayah: number;
  wordIndex: number;
  location: string;
  arabicFull: string;
  segments: MorphSegment[];
  primaryPos: string;
  primaryPosLabel: string;
  root?: string;
  lemma?: string;
  corpusArabicLine?: string;
  wbwTranslation?: string;
  transliteration?: string;
  wordAudioUrl?: string | null;
  textTajweed?: string;
}

export interface WordDisplaySegment {
  arabic: string;
  pos: string;
  posArabic: string;
  isDet?: boolean;
}

export interface SyntaxNode {
  nodeIndex: number;
  nodeId: string;
  kind: 'word' | 'reference' | 'elided' | 'phrase';
  location?: string;
  segmentIndex?: number;
  arabic?: string;
  phonetic?: string;
  translation?: string;
  pos?: string;
  posArabic?: string;
  fam?: string;
  wordGroupId?: string;
  displaySegments?: WordDisplaySegment[];
  phraseType?: string;
  phraseLabel?: string;
  phraseArabic?: string;
  startNode?: number;
  endNode?: number;
  wordStart?: number;
  wordEnd?: number;
}

export interface SyntaxEdge {
  fromNode: number;
  toNode: number;
  tag: string;
  arabicLabel: string;
  englishLabel: string;
  description: string;
}

export type GraphDatasetSource = 'qac-gold-treebank' | 'eqtb-noorbayan';

export interface ParsedSyntaxGraph {
  graphNumber: number;
  ayahKey: string;
  source: GraphDatasetSource;
  nodes: SyntaxNode[];
  edges: SyntaxEdge[];
}

export interface IrabEntry {
  wordStart: number;
  wordEnd: number;
  text: string;
}

export interface AyahLinguisticsResponse {
  ayahKey: string;
  surah: number;
  ayah: number;
  hasGoldTreebank: boolean;
  graphSource: GraphDatasetSource;
  verseTextUthmani: string;
  verseTranslation: string;
  words: WordMorphology[];
  graphs: ParsedSyntaxGraph[];
  irab: IrabEntry[];
}

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

export interface AyahTiming {
  ayah: number;
  startTimeMs: number;
  endTimeMs: number;
  precision: 'exact-ms' | 'proportional';
}

export interface CustomAudioSource {
  id: string;
  label: string;
  fileName?: string;
  url?: string;
  isLocalUpload: boolean;
  startOffsetSec?: number;
  endOffsetSec?: number;
}

export interface RecitationSegment {
  id: string;
  surah: number;
  startAyah: number;
  endAyah: number;
  reciterId: string;
  fallbackReciterId?: string;
  customAudioId?: string;
  customLabel?: string;
}

export interface CustomRecitationConfig {
  id: string;
  name: string;
  description?: string;
  surah: number;
  autoFallback: boolean;
  defaultFallbackReciterId: string;
  segments: RecitationSegment[];
  updatedAt?: string;
}

export interface CoverageSummary {
  totalQuranSurahs: number;
  totalQuranAyahs: number;
  totalQuranWords: number;
  totalMorphSegments: number;
  goldTreebankAyahs: number;
  goldTreebankSurahs: number;
  goldTreebankCoveragePct: number;
  eqtbAyahs: number;
  eqtbSurahs: number;
  eqtbCoveragePct: number;
  goldCoveredRanges: Array<{ range: string; status: string; ayahs: number; source: string }>;
  irabCoveredAyahs: number;
}

export interface TafsirSadiResponse {
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

