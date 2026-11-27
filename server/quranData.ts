import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { createExtractorFromData } from 'node-unrar-js';

const CACHE_DIR = path.resolve(process.cwd(), '.cache');

const MORPHOLOGY_URL =
  'https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt';
const SYNTAX_URL =
  'https://raw.githubusercontent.com/kaisdukes/quranic-corpus-api/main/src/main/resources/data/syntax.txt';
const IRAB_URL =
  'https://raw.githubusercontent.com/kaisdukes/quranic-corpus-api/main/src/main/resources/data/irab.tsv';
const EQTB_RAR_URL =
  'https://raw.githubusercontent.com/NoorBayan/Quranic/main/corpus/Quranic.rar';

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

export const POS_INFO: Record<string, { en: string; ar: string; color: string }> = {
  N: { en: 'Noun', ar: 'اسم', color: '#0369A1' },
  PN: { en: 'Proper Noun', ar: 'اسم علم', color: '#0F6E54' },
  ADJ: { en: 'Adjective', ar: 'صفة', color: '#0D9488' },
  PRON: { en: 'Pronoun', ar: 'ضمير', color: '#7C3AED' },
  DEM: { en: 'Demonstrative', ar: 'اسم إشارة', color: '#6D28D9' },
  REL: { en: 'Relative Pronoun', ar: 'اسم موصول', color: '#6D28D9' },
  V: { en: 'Verb', ar: 'فعل', color: '#B91C1C' },
  P: { en: 'Preposition', ar: 'حرف جر', color: '#B91C1C' },
  CONJ: { en: 'Conjunction', ar: 'حرف عطف', color: '#92400E' },
  DET: { en: 'Determiner (Al-)', ar: 'أل التعريف', color: '#6B7280' },
  NEG: { en: 'Negative Particle', ar: 'حرف نفي', color: '#DC2626' },
  REM: { en: 'Resumption Particle', ar: 'حرف استئناف', color: '#78716C' },
  EMPH: { en: 'Emphatic Particle', ar: 'لام التوكيد', color: '#B45309' },
  INTG: { en: 'Interrogative', ar: 'حرف استفهام', color: '#9333EA' },
  COND: { en: 'Conditional', ar: 'أداة شرط', color: '#C2410C' },
  RES: { en: 'Restriction Particle', ar: 'أداة حصر', color: '#9333EA' },
  SUB: { en: 'Subordinating Conj.', ar: 'حرف مصدري', color: '#78716C' },
  ACC: { en: 'Accusative Particle', ar: 'حرف نصب', color: '#B45309' },
  VOC: { en: 'Vocative Particle', ar: 'حرف نداء', color: '#0F6E54' },
  LOC: { en: 'Location Adverb', ar: 'ظرف مكان', color: '#0369A1' },
  T: { en: 'Time Adverb', ar: 'ظرف زمان', color: '#0369A1' },
  CERT: { en: 'Particle of Certainty', ar: 'حرف تحقيق', color: '#B45309' },
  FUT: { en: 'Future Particle', ar: 'حرف استقبال', color: '#B45309' },
  PRO: { en: 'Prohibition Particle', ar: 'حرف نهي', color: '#DC2626' },
  INC: { en: 'Inceptive Particle', ar: 'حرف ابتداء', color: '#78716C' },
  IMPV: { en: 'Imperative Prefix', ar: 'لام الأمر', color: '#B91C1C' },
  INL: { en: 'Quranic Initials', ar: 'حروف مقطعة', color: '#B58833' },
  SUP: { en: 'Supplemental Particle', ar: 'حرف زائد', color: '#78716C' },
  EXP: { en: 'Exceptive Particle', ar: 'أداة استثناء', color: '#9333EA' },
  RET: { en: 'Retraction Particle', ar: 'حرف إضراب', color: '#92400E' },
  EXH: { en: 'Exhortation Particle', ar: 'حرف تحضيض', color: '#B45309' },
  RSLT: { en: 'Result Particle', ar: 'رابط لجواب الشرط', color: '#78716C' },
  SUR: { en: 'Surprise Particle', ar: 'حرف فجاءة', color: '#B45309' },
  ANS: { en: 'Answer Particle', ar: 'حرف جواب', color: '#0F6E54' },
  PREV: { en: 'Preventive Particle', ar: 'كافة', color: '#78716C' },
  AVR: { en: 'Aversion Particle', ar: 'حرف ردع', color: '#DC2626' },
  CAUS: { en: 'Particle of Cause', ar: 'حرف سببية', color: '#B45309' },
  AMD: { en: 'Amendment Particle', ar: 'حرف استدراك', color: '#92400E' },
  COM: { en: 'Comitative Particle', ar: 'واو المعية', color: '#92400E' },
  EQ: { en: 'Equalization Particle', ar: 'حرف تسوية', color: '#78716C' },
  EXL: { en: 'Explanation Particle', ar: 'حرف تفصيل', color: '#78716C' },
  INT: { en: 'Interpretation Particle', ar: 'حرف تفسير', color: '#78716C' },
  CIRC: { en: 'Circumstantial Particle', ar: 'واو الحال', color: '#92400E' },
};

export const RELATION_INFO: Record<string, { ar: string; en: string; desc: string }> = {
  subj: { ar: 'فاعل', en: 'Subject', desc: 'Doer/subject of a verbal clause (marfuʿ)' },
  obj: { ar: 'مفعول به', en: 'Direct Object', desc: 'Direct object receiving the verb action (mansub)' },
  poss: { ar: 'مضاف إليه', en: 'Possessive (Idafa)', desc: 'Genitive noun completing a construct phrase (idafa)' },
  gen: { ar: 'مجرور', en: 'Genitive Object', desc: 'Noun governed in genitive case by a preposition' },
  adj: { ar: 'صفة', en: 'Adjective (Naʿt)', desc: 'Attributive adjective agreeing with modified noun' },
  conj: { ar: 'معطوف', en: 'Conjunction', desc: 'Coordinated element linked by a conjunction' },
  link: { ar: 'متعلق', en: 'Prepositional Link', desc: 'Prepositional phrase (jar wa majrur) attached to verb/noun' },
  pred: { ar: 'خبر', en: 'Predicate', desc: 'Predicate completing a nominal sentence (khabar)' },
  app: { ar: 'بدل', en: 'Apposition (Badal)', desc: 'Appositive clarifying or substituting an antecedent' },
  sub: { ar: 'صلة', en: 'Subordinate / Relative', desc: 'Clause completing a relative pronoun or subordinator' },
  pass: { ar: 'نائب فاعل', en: 'Passive Subject', desc: 'Deputy subject of a passive verb' },
  subjx: { ar: 'اسم', en: 'Special Subject', desc: 'Subject of inna/kana or sister particle' },
  predx: { ar: 'خبر', en: 'Special Predicate', desc: 'Predicate of inna/kana or sister particle' },
  circ: { ar: 'حال', en: 'Circumstantial (Hal)', desc: 'Accusative state/manner modifier' },
  state: { ar: 'حال', en: 'Circumstantial (Hal)', desc: 'Accusative state/manner modifier' },
  voc: { ar: 'منادى', en: 'Vocative', desc: 'Addressed noun after a vocative particle' },
  exp: { ar: 'مستثنى', en: 'Exceptive', desc: 'Exception governed by illa or similar' },
  cog: { ar: 'مفعول مطلق', en: 'Cognate Accusative', desc: 'Verbal noun emphasizing or specifying the verb' },
  spec: { ar: 'تمييز', en: 'Specification (Tamyiz)', desc: 'Accusative noun clarifying ambiguity' },
  prp: { ar: 'مفعول لأجله', en: 'Purpose / Reason', desc: 'Accusative noun stating motive/purpose' },
  fut: { ar: 'استقبال', en: 'Future Marker', desc: 'Future prefix attached to imperfect verb' },
  intg: { ar: 'استفهام', en: 'Interrogative', desc: 'Interrogative particle marking a question' },
  emph: { ar: 'توكيد', en: 'Emphasis', desc: 'Emphatic particle or corroborative element' },
  neg: { ar: 'نفي', en: 'Negation', desc: 'Negation particle governing verb or noun' },
  pro: { ar: 'نهي', en: 'Prohibition', desc: 'Prohibitive particle governing jussive verb' },
  cpnd: { ar: 'مركب', en: 'Compound', desc: 'Compound lexical structure' },
  cond: { ar: 'شرط', en: 'Condition', desc: 'Protasis (condition) clause of a conditional sentence' },
  rslt: { ar: 'جواب شرط', en: 'Conditional Result', desc: 'Apodosis (result) clause of a conditional sentence' },
  imrs: { ar: 'جواب أمر', en: 'Imperative Result', desc: 'Result clause following an imperative' },
  impv: { ar: 'أمر', en: 'Imperative Marker', desc: 'Lam of command governing a jussive verb' },
  cert: { ar: 'تحقيق', en: 'Certainty', desc: 'Particle of certainty (qad + perfect)' },
  ans: { ar: 'جواب', en: 'Answer', desc: 'Response/answer clause' },
  res: { ar: 'حصر', en: 'Restriction', desc: 'Restrictive relation (only/except)' },
  sur: { ar: 'فجاءة', en: 'Surprise', desc: 'Suddenness particle' },
  ret: { ar: 'إضراب', en: 'Retraction', desc: 'Retraction/correction particle (bal)' },
  exl: { ar: 'تفصيل', en: 'Explanation', desc: 'Elaboration/detailing relation' },
  prev: { ar: 'كاف', en: 'Preventive', desc: 'Preventive ma blocking government' },
  avr: { ar: 'ردع', en: 'Aversion', desc: 'Rebuke/aversion particle (kalla)' },
  inc: { ar: 'ابتداء', en: 'Inceptive', desc: 'Inceptive particle' },
  exh: { ar: 'تحضيض', en: 'Exhortation', desc: 'Urging/exhortation particle' },
  eq: { ar: 'تسوية', en: 'Equalization', desc: 'Equalization clause' },
  caus: { ar: 'سببية', en: 'Cause', desc: 'Causal particle or clause' },
  amd: { ar: 'استدراك', en: 'Amendment', desc: 'Amendment particle (lakinna / lakin)' },
  sup: { ar: 'زائد', en: 'Supplemental', desc: 'Rhetorical/supplemental particle' },
  int: { ar: 'تفسير', en: 'Interpretation', desc: 'Explanatory particle (ay / an)' },
  com: { ar: 'مفعول معه', en: 'Comitative', desc: 'Accompaniment noun after waw al-maʿiyyah' },
};

export const PHRASE_INFO: Record<string, { en: string; ar: string }> = {
  S: { en: 'Sentence', ar: 'جملة' },
  NS: { en: 'Nominal Sentence', ar: 'جملة اسمية' },
  VS: { en: 'Verbal Sentence', ar: 'جملة فعلية' },
  CS: { en: 'Conditional Sentence', ar: 'جملة شرطية' },
  PP: { en: 'Prepositional Phrase', ar: 'شبه جملة' },
  SC: { en: 'Subordinate Clause', ar: 'جملة فرعية' },
};

interface CachedAyahPayload {
  ayahKey: string;
  surah: number;
  ayah: number;
  hasGoldTreebank: boolean;
  graphSource: GraphDatasetSource;
  words: WordMorphology[];
  graphs: ParsedSyntaxGraph[];
  irab: IrabEntry[];
}

interface QuranLinguisticsStore {
  ready: boolean;
  loadingPromise: Promise<void> | null;
  // Compact raw-text indices kept in memory (~19 MB total instead of ~480 MB inflated AST objects!)
  rawMorphByAyah: Map<string, string[]>;
  rawSyntaxByAyah: Map<string, string[]>;
  eqtbSentenceBlocks: string[];
  rawEqtbByAyah: Map<string, number[]>;
  eqtbHeaderIdx: Record<string, number>;
  irabByAyah: Map<string, IrabEntry[]>;
  ayahLruCache: Map<string, CachedAyahPayload>;
  goldSurahs: Set<number>;
  goldAyahCount: number;
  eqtbSurahs: Set<number>;
  eqtbAyahCount: number;
  totalMorphWords: number;
  totalMorphSegments: number;
}

const store: QuranLinguisticsStore = {
  ready: false,
  loadingPromise: null,
  rawMorphByAyah: new Map(),
  rawSyntaxByAyah: new Map(),
  eqtbSentenceBlocks: [],
  rawEqtbByAyah: new Map(),
  eqtbHeaderIdx: {},
  irabByAyah: new Map(),
  ayahLruCache: new Map(),
  goldSurahs: new Set(),
  goldAyahCount: 0,
  eqtbSurahs: new Set(),
  eqtbAyahCount: 0,
  totalMorphWords: 0,
  totalMorphSegments: 0,
};

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

async function fetchToCacheFile(url: string, filename: string): Promise<string> {
  ensureCacheDir();
  const filePath = path.join(CACHE_DIR, filename);
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    if (stat.size > 10000) {
      return filePath;
    }
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const text = await res.text();
  fs.writeFileSync(filePath, text, 'utf-8');
  return filePath;
}

async function ensureEqtbCsvFile(): Promise<string> {
  ensureCacheDir();
  const csvPath = path.join(CACHE_DIR, 'Quranic.csv');
  if (fs.existsSync(csvPath)) {
    const stat = fs.statSync(csvPath);
    if (stat.size > 10_000_000) {
      return csvPath;
    }
  }

  const rarPath = path.join(CACHE_DIR, 'Quranic.rar');
  let rarBuffer: Buffer;
  if (fs.existsSync(rarPath) && fs.statSync(rarPath).size > 1_000_000) {
    rarBuffer = fs.readFileSync(rarPath);
  } else {
    const res = await fetch(EQTB_RAR_URL, { signal: AbortSignal.timeout(45000) });
    if (!res.ok) {
      throw new Error(`Failed to fetch EQTB archive: ${res.status}`);
    }
    const ab = await res.arrayBuffer();
    rarBuffer = Buffer.from(ab);
    fs.writeFileSync(rarPath, rarBuffer);
  }

  const arrayBuffer: ArrayBuffer = Uint8Array.from(rarBuffer).buffer;
  const extractor = await createExtractorFromData({ data: arrayBuffer });
  const extracted = extractor.extract({ files: ['Quranic.csv'] });
  const extractedFiles = [...extracted.files];
  const fileEntry = extractedFiles.find((f) => f.fileHeader.name.endsWith('Quranic.csv'));
  if (!fileEntry || !fileEntry.extraction) {
    throw new Error('Quranic.csv not found inside EQTB archive');
  }

  // Stream UTF-16LE -> UTF-8 in 1 MB chunks (even byte count) to avoid giant string heap spike
  const rawBuf = Buffer.from(
    fileEntry.extraction.buffer,
    fileEntry.extraction.byteOffset,
    fileEntry.extraction.byteLength
  );
  const tmpPath = `${csvPath}.tmp`;
  const fd = fs.openSync(tmpPath, 'w');
  try {
    const chunkSize = 1024 * 1024; // multiple of 2 for UTF-16LE
    for (let offset = 0; offset < rawBuf.length; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, rawBuf.length);
      const utf8Chunk = rawBuf.subarray(offset, end).toString('utf16le');
      fs.writeSync(fd, utf8Chunk, undefined, 'utf-8');
    }
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, csvPath);
  return csvPath;
}

function parseMorphFeatures(tag: string, raw: string): {
  pos: string;
  role: 'PREFIX' | 'STEM' | 'SUFFIX';
  root?: string;
  lemma?: string;
  fam?: string;
  grammarTags: string[];
  englishDescription: string;
  caseState?: 'NOM' | 'ACC' | 'GEN';
  mood?: 'IND' | 'SUBJ' | 'JUS';
  voice?: 'ACT' | 'PASS';
  verbForm?: string;
  gender?: 'M' | 'F';
  number?: 'S' | 'D' | 'P';
  person?: '1' | '2' | '3';
  rawFeatures: string;
} {
  const parts = raw.split('|').filter(Boolean);
  let role: 'PREFIX' | 'STEM' | 'SUFFIX' = 'STEM';
  let pos = tag;
  let root: string | undefined;
  let lemma: string | undefined;
  let fam: string | undefined;
  const grammarTags: string[] = [];
  let caseState: 'NOM' | 'ACC' | 'GEN' | undefined;
  let mood: 'IND' | 'SUBJ' | 'JUS' | undefined;
  let voice: 'ACT' | 'PASS' | undefined;
  let verbForm: string | undefined;
  let gender: 'M' | 'F' | undefined;
  let number: 'S' | 'D' | 'P' | undefined;
  let person: '1' | '2' | '3' | undefined;
  let aspect: 'PERF' | 'IMPF' | 'IMPV' | undefined;
  let derivation: 'ACT_PCPL' | 'PASS_PCPL' | 'VN' | undefined;
  let definiteness: 'DEF' | 'INDEF' | undefined;
  let pronFeature: string | undefined;

  for (const p of parts) {
    if (p === 'PREF') {
      role = 'PREFIX';
    } else if (p === 'SUFF') {
      role = 'SUFFIX';
    } else if (p.startsWith('ROOT:')) {
      root = p.slice(5);
    } else if (p.startsWith('LEM:')) {
      lemma = p.slice(4);
    } else if (p.startsWith('FAM:')) {
      fam = p.slice(4);
    } else if (p.startsWith('VF:')) {
      verbForm = p.slice(3);
      grammarTags.push(`Form ${verbForm}`);
    } else if (p === 'ACC' && tag === 'P') {
      pos = 'ACC';
    } else if (p === 'NOM' || p === 'ACC' || p === 'GEN') {
      caseState = p;
      grammarTags.push(
        p === 'NOM' ? 'Nominative (مرفوع)' : p === 'ACC' ? 'Accusative (منصوب)' : 'Genitive (مجرور)'
      );
    } else if (p === 'IND' || p === 'SUBJ' || p === 'JUS') {
      mood = p;
      grammarTags.push(p === 'IND' ? 'Indicative' : p === 'SUBJ' ? 'Subjunctive' : 'Jussive');
    } else if (p === 'PASS') {
      voice = 'PASS';
      grammarTags.push('Passive (مبني للمجهول)');
    } else if (p === 'ACT') {
      voice = 'ACT';
      grammarTags.push('Active');
    } else if (p === 'PERF' || p === 'IMPF' || p === 'IMPV') {
      aspect = p;
      grammarTags.push(
        p === 'PERF'
          ? 'Perfect Verb (ماضٍ)'
          : p === 'IMPF'
          ? 'Imperfect Verb (مضارع)'
          : 'Imperative (أمر)'
      );
    } else if (p === 'ACT_PCPL' || p === 'PASS_PCPL' || p === 'VN') {
      derivation = p;
      grammarTags.push(
        p === 'ACT_PCPL'
          ? 'Active Participle (اسم فاعل)'
          : p === 'PASS_PCPL'
          ? 'Passive Participle (اسم مفعول)'
          : 'Verbal Noun (مصدر)'
      );
    } else if (p === 'INDEF' || p === 'DEF') {
      definiteness = p;
      grammarTags.push(p === 'INDEF' ? 'Indefinite (نكرة)' : 'Definite (معرفة)');
    } else if (/^[123]?[MF]?[SDP]?$/.test(p) && p.length <= 3 && /[MFSDP123]/.test(p)) {
      if (p.includes('1')) person = '1';
      if (p.includes('2')) person = '2';
      if (p.includes('3')) person = '3';
      if (p.includes('M')) gender = 'M';
      if (p.includes('F')) gender = 'F';
      if (p.includes('S')) number = 'S';
      if (p.includes('D')) number = 'D';
      if (p.includes('P')) number = 'P';
      const personLabel = person === '1' ? '1st person' : person === '2' ? '2nd person' : person === '3' ? '3rd person' : '';
      const genderLabel = gender === 'M' ? 'masculine' : gender === 'F' ? 'feminine' : '';
      const numLabel = number === 'S' ? 'singular' : number === 'D' ? 'dual' : number === 'P' ? 'plural' : '';
      const combined = [personLabel, genderLabel, numLabel].filter(Boolean).join(' ');
      if (combined) grammarTags.push(combined);
    } else if (POS_INFO[p]) {
      pos = p;
    } else if (p.startsWith('PRON:')) {
      pos = 'PRON';
      role = 'SUFFIX';
      pronFeature = p.slice(5);
      if (pronFeature.includes('1')) person = '1';
      if (pronFeature.includes('2')) person = '2';
      if (pronFeature.includes('3')) person = '3';
      if (pronFeature.includes('M')) gender = 'M';
      if (pronFeature.includes('F')) gender = 'F';
      if (pronFeature.includes('S')) number = 'S';
      if (pronFeature.includes('D')) number = 'D';
      if (pronFeature.includes('P')) number = 'P';
      grammarTags.push(`Pronoun (${pronFeature})`);
    } else if (p === 'DET') {
      pos = 'DET';
      role = 'PREFIX';
    } else if (p === 'ADJ' || p === 'PN' || p === 'LOC' || p === 'T' || p === 'DEM' || p === 'REL') {
      pos = p;
    }
  }

  const pgnParts = [
    person === '1' ? '1st person' : person === '2' ? '2nd person' : person === '3' ? '3rd person' : '',
    gender === 'M' ? 'masculine' : gender === 'F' ? 'feminine' : '',
    number === 'S' ? 'singular' : number === 'D' ? 'dual' : number === 'P' ? 'plural' : '',
  ].filter(Boolean);

  const formRoman: Record<string, string> = {
    '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI',
    '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X', '11': 'XI', '12': 'XII',
  };

  let englishDescription = '';
  if (pos === 'V') {
    const bits: string[] = [];
    if (pgnParts.length) bits.push(pgnParts.join(' '));
    if (verbForm && Number(verbForm) > 1) bits.push(`(form ${formRoman[verbForm] || verbForm})`);
    if (voice === 'PASS') bits.push('passive');
    if (aspect === 'PERF') bits.push('perfect');
    else if (aspect === 'IMPF') bits.push('imperfect');
    else if (aspect === 'IMPV') bits.push('imperative');
    bits.push('verb');
    englishDescription = bits.join(' ');
  } else if (pos === 'N' || pos === 'PN' || pos === 'ADJ') {
    const bits: string[] = [];
    if (caseState === 'NOM') bits.push('nominative');
    else if (caseState === 'ACC') bits.push('accusative');
    else if (caseState === 'GEN') bits.push('genitive');
    if (definiteness === 'INDEF') bits.push('indefinite');
    if (gender === 'M') bits.push('masculine');
    else if (gender === 'F') bits.push('feminine');
    if (number === 'S') bits.push('singular');
    else if (number === 'D') bits.push('dual');
    else if (number === 'P') bits.push('plural');
    if (verbForm && Number(verbForm) > 1) bits.push(`(form ${formRoman[verbForm] || verbForm})`);
    if (voice === 'PASS' && !derivation) bits.push('passive');
    if (derivation === 'ACT_PCPL') bits.push('active participle');
    else if (derivation === 'PASS_PCPL') bits.push('passive participle');
    else if (derivation === 'VN') bits.push('verbal noun');
    else if (pos === 'PN') bits.push('proper noun');
    else if (pos === 'ADJ') bits.push('adjective');
    else bits.push('noun');
    englishDescription = bits.join(' ');
  } else if (pos === 'LOC' || pos === 'T') {
    const bits: string[] = [];
    if (caseState === 'ACC') bits.push('accusative');
    else if (caseState === 'GEN') bits.push('genitive');
    bits.push(pos === 'LOC' ? 'location adverb' : 'time adverb');
    englishDescription = bits.join(' ');
  } else if (pos === 'PRON') {
    const bits = [...pgnParts];
    bits.push('pronoun');
    englishDescription = bits.join(' ');
  } else if (pos === 'REL' || pos === 'DEM') {
    const bits = [...pgnParts];
    bits.push(pos === 'REL' ? 'relative pronoun' : 'demonstrative pronoun');
    englishDescription = bits.join(' ');
  } else {
    const basePosLabel = POS_INFO[pos]?.en?.toLowerCase() || pos.toLowerCase();
    englishDescription = basePosLabel;
  }

  return {
    pos,
    role,
    root,
    lemma,
    fam,
    grammarTags,
    englishDescription,
    caseState,
    mood,
    voice,
    verbForm,
    gender,
    number,
    person,
    rawFeatures: raw,
  };
}

function buildSuffixPronounArabic(seg: MorphSegment, prevNonDet: MorphSegment | undefined): string {
  const txt = seg.arabic;
  let pronName = 'الضمير';
  if (txt === 'كَ' || txt === 'كِ' || txt === 'كُمْ' || txt === 'كُمَا' || txt === 'كُنَّ' || seg.person === '2') {
    pronName = 'والكاف ضمير متصل';
  } else if (txt === 'هُ' || txt === 'هِ' || txt === 'هَا' || txt === 'هُمْ' || txt === 'هِمْ' || txt === 'هُمَا' || txt === 'هُنَّ' || txt === 'هِنَّ') {
    pronName = 'والهاء ضمير متصل';
  } else if (txt === 'ى' || txt === 'ي' || txt === 'نِى' || (seg.person === '1' && seg.number === 'S')) {
    pronName = 'والياء ضمير متصل';
  } else if (txt === 'نَا' || txt === 'نَا۟') {
    pronName = 'و«نا» ضمير متصل';
  } else if (txt.includes('و') && prevNonDet?.pos === 'V') {
    pronName = 'والواو ضمير متصل';
  } else if (txt.includes('ت') && prevNonDet?.pos === 'V') {
    pronName = 'والتاء ضمير متصل';
  } else if (txt === 'ا' && prevNonDet?.pos === 'V') {
    pronName = 'والألف ضمير متصل';
  } else if (txt.includes('ن') && prevNonDet?.pos === 'V') {
    pronName = 'والنون ضمير متصل';
  }

  if (prevNonDet?.pos === 'ACC') {
    const famLabel = prevNonDet.fam === 'إِنّ' || prevNonDet.lemma === 'أَنّ' || prevNonDet.lemma === 'إِنّ' ? '«ان»' : '';
    return `${pronName} في محل نصب اسم ${famLabel}`.trim();
  }
  if (prevNonDet?.pos === 'P') {
    return `${pronName} في محل جر بحرف الجر`;
  }
  if (prevNonDet?.pos === 'V') {
    const isSubject =
      txt.includes('و') || txt === 'ا' || txt === 'تُ' || txt === 'تَ' || txt === 'تِ' || txt === 'تُمْ' || txt === 'نَ' || (txt === 'نَا' && prevNonDet.rawFeatures.includes('PERF'));
    return isSubject
      ? `${pronName} في محل رفع فاعل`
      : `${pronName} في محل نصب مفعول به`;
  }
  return `${pronName} في محل جر بالاضافة`;
}

function finalizeWordMorphology(word: WordMorphology): void {
  const nonDet = word.segments.filter((s) => s.pos !== 'DET');
  nonDet.forEach((seg, idx) => {
    if (seg.pos === 'PRON' && seg.role === 'SUFFIX') {
      const prev = idx > 0 ? nonDet[idx - 1] : undefined;
      const pgnParts = [
        seg.person === '1' ? '1st person' : seg.person === '2' ? '2nd person' : seg.person === '3' ? '3rd person' : '',
        seg.gender === 'M' ? 'masculine' : seg.gender === 'F' ? 'feminine' : '',
        seg.number === 'S' ? 'singular' : seg.number === 'D' ? 'dual' : seg.number === 'P' ? 'plural' : '',
      ].filter(Boolean);
      const roleWord =
        prev && (prev.pos === 'N' || prev.pos === 'PN' || prev.pos === 'ADJ' || prev.pos === 'LOC' || prev.pos === 'T')
          ? 'possessive pronoun'
          : prev && (prev.pos === 'ACC' || prev.pos === 'P')
          ? 'object pronoun'
          : prev && prev.pos === 'V'
          ? (seg.arabic.includes('و') || seg.arabic === 'ا' || seg.arabic.startsWith('ت') || seg.arabic.startsWith('نَ')
              ? 'subject pronoun'
              : 'object pronoun')
          : 'personal pronoun';
      seg.englishDescription = [...pgnParts, roleWord].filter(Boolean).join(' ');
    }
  });

  const arParts: string[] = [];
  nonDet.forEach((seg, idx) => {
    const prev = idx > 0 ? nonDet[idx - 1] : undefined;
    if (seg.pos === 'PRON' && seg.role === 'SUFFIX' && prev) {
      arParts.push(buildSuffixPronounArabic(seg, prev));
      return;
    }

    if (seg.pos === 'N' || seg.pos === 'PN' || seg.pos === 'ADJ') {
      const base = seg.pos === 'PN' ? 'اسم علم' : seg.pos === 'ADJ' ? 'نعت' : 'اسم';
      const irab =
        seg.caseState === 'NOM' ? 'مرفوع' : seg.caseState === 'ACC' ? 'منصوب' : seg.caseState === 'GEN' ? 'مجرور' : '';
      arParts.push([base, irab].filter(Boolean).join(' '));
    } else if (seg.pos === 'V') {
      const aspect = seg.rawFeatures.includes('PERF')
        ? 'فعل ماض'
        : seg.rawFeatures.includes('IMPF')
        ? 'فعل مضارع'
        : seg.rawFeatures.includes('IMPV')
        ? 'فعل أمر'
        : 'فعل';
      const moodAr = seg.mood === 'JUS' ? 'مجزوم' : seg.mood === 'SUBJ' ? 'منصوب' : '';
      const passAr = seg.voice === 'PASS' ? 'مبني للمجهول' : '';
      arParts.push([aspect, passAr, moodAr].filter(Boolean).join(' '));
    } else if (seg.pos === 'LOC' || seg.pos === 'T') {
      const base = seg.pos === 'LOC' ? 'ظرف مكان' : 'ظرف زمان';
      const irab = seg.caseState === 'ACC' ? 'منصوب' : seg.caseState === 'GEN' ? 'مجرور' : '';
      arParts.push([base, irab].filter(Boolean).join(' '));
    } else if (seg.pos === 'ACC' && (seg.fam === 'إِنّ' || seg.lemma === 'أَنّ' || seg.lemma === 'إِنّ')) {
      arParts.push('حرف نصب من اخوات «ان»');
    } else if (seg.pos === 'P' && seg.role === 'PREFIX') {
      if (seg.arabic.startsWith('ب')) arParts.push('الباء حرف جر');
      else if (seg.arabic.startsWith('ل')) arParts.push('اللام حرف جر');
      else if (seg.arabic.startsWith('ك')) arParts.push('الكاف حرف جر');
      else if (seg.arabic.startsWith('و')) arParts.push('واو القسم');
      else if (seg.arabic.startsWith('ت')) arParts.push('تاء القسم');
      else arParts.push('حرف جر');
    } else if (seg.pos === 'CONJ') {
      arParts.push(
        seg.arabic.startsWith('و')
          ? 'الواو عاطفة'
          : seg.arabic.startsWith('ف')
          ? 'الفاء عاطفة'
          : 'حرف عطف'
      );
    } else if (seg.pos === 'REM') {
      arParts.push(
        seg.arabic.startsWith('ف')
          ? 'الفاء استئنافية'
          : seg.arabic.startsWith('و')
          ? 'الواو استئنافية'
          : 'حرف استئناف'
      );
    } else if (seg.pos === 'FUT') {
      arParts.push(seg.arabic.startsWith('س') ? 'السين حرف استقبال' : 'حرف استقبال');
    } else if (seg.pos === 'EMPH') {
      arParts.push(seg.arabic.startsWith('ل') ? 'اللام للتوكيد' : 'حرف توكيد');
    } else if (seg.pos === 'INTG') {
      arParts.push(seg.arabic === 'أَ' ? 'الهمزة للاستفهام' : 'حرف استفهام');
    } else {
      arParts.push(POS_INFO[seg.pos]?.ar || seg.posArabic);
    }
  });

  word.corpusArabicLine = arParts.filter(Boolean).join(' ').replace(/\s+و/g, ' و');
}

function parseAyahMorphologyOnDemand(ayahKey: string): WordMorphology[] {
  const lines = store.rawMorphByAyah.get(ayahKey);
  if (!lines || lines.length === 0) return [];

  const result: WordMorphology[] = [];
  let lastWordKey = '';
  let currentWord: WordMorphology | null = null;

  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length < 4) continue;

    const [loc, arabic, tag, featStr] = cols;
    const locParts = loc.split(':');
    if (locParts.length !== 4) continue;
    const surah = Number(locParts[0]);
    const ayah = Number(locParts[1]);
    const wordIndex = Number(locParts[2]);
    const segmentIndex = Number(locParts[3]);
    const wordKey = `${surah}:${ayah}:${wordIndex}`;

    const parsed = parseMorphFeatures(tag, featStr);
    const posMeta = POS_INFO[parsed.pos] || { en: parsed.pos, ar: parsed.pos, color: '#64748B' };

    const seg: MorphSegment = {
      location: loc,
      wordIndex,
      segmentIndex,
      arabic,
      pos: parsed.pos,
      posLabel: posMeta.en,
      posArabic: posMeta.ar,
      role: parsed.role,
      root: parsed.root,
      lemma: parsed.lemma,
      fam: parsed.fam,
      features: featStr.split('|'),
      grammarTags: parsed.grammarTags,
      englishDescription: parsed.englishDescription,
      arabicDescription: posMeta.ar,
      caseState: parsed.caseState,
      mood: parsed.mood,
      voice: parsed.voice,
      verbForm: parsed.verbForm,
      gender: parsed.gender,
      number: parsed.number,
      person: parsed.person,
      rawFeatures: featStr,
    };

    if (wordKey !== lastWordKey) {
      if (currentWord) finalizeWordMorphology(currentWord);
      lastWordKey = wordKey;
      currentWord = {
        surah,
        ayah,
        wordIndex,
        location: wordKey,
        arabicFull: arabic,
        segments: [seg],
        primaryPos: parsed.pos,
        primaryPosLabel: posMeta.en,
        root: parsed.root,
        lemma: parsed.lemma,
      };
      result.push(currentWord);
    } else if (currentWord) {
      currentWord.arabicFull += arabic;
      currentWord.segments.push(seg);
      if (parsed.role === 'STEM') {
        currentWord.primaryPos = parsed.pos;
        currentWord.primaryPosLabel = posMeta.en;
      }
      if (!currentWord.root && parsed.root) currentWord.root = parsed.root;
      if (!currentWord.lemma && parsed.lemma) currentWord.lemma = parsed.lemma;
    }
  }
  if (currentWord) finalizeWordMorphology(currentWord);
  return result;
}

function parseSyntaxBlockOnDemand(
  blockText: string,
  graphNumber: number,
  primaryAyahKey: string,
  morphLookupCache: Map<string, WordMorphology[]>
): ParsedSyntaxGraph {
  const lines = blockText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('--'));

  const nodes: SyntaxNode[] = [];
  const edges: SyntaxEdge[] = [];
  let wordGroupSeq = 0;

  const getMorphForAyah = (key: string): WordMorphology[] => {
    let m = morphLookupCache.get(key);
    if (!m) {
      m = parseAyahMorphologyOnDemand(key);
      morphLookupCache.set(key, m);
    }
    return m;
  };

  for (const line of lines) {
    const eqIdx = line.indexOf(' = ');
    if (eqIdx >= 0) {
      const namesRaw = line.slice(0, eqIdx).split(',').map((s) => s.trim());
      const def = line.slice(eqIdx + 3).trim();
      const parenIdx = def.indexOf('(');
      if (parenIdx === -1) continue;
      const tag = def.slice(0, parenIdx).trim();
      const value = def.slice(parenIdx + 1, def.length - 1).trim();

      if (tag === 'word' || tag === 'reference') {
        const locParts = value.split(':');
        const surah = Number(locParts[0]);
        const ayah = Number(locParts[1]);
        const wordIdx = Number(locParts[2]);
        const ayahKey = `${surah}:${ayah}`;
        const morphWords = getMorphForAyah(ayahKey);
        const wordMorph = morphWords.find((w) => w.wordIndex === wordIdx);

        const syntaxSegments = wordMorph?.segments.filter((s) => s.pos !== 'DET') || [];
        const matchedSegments =
          syntaxSegments.length === namesRaw.length
            ? syntaxSegments
            : wordMorph?.segments || [];

        wordGroupSeq++;
        const wordGroupId = `${tag}-${value}-${wordGroupSeq}`;
        const displaySegments = (wordMorph?.segments || []).map((s) => ({
          arabic: s.arabic,
          pos: s.pos,
          posArabic: s.posArabic,
          isDet: s.pos === 'DET',
        }));

        namesRaw.forEach((nodeId, idx) => {
          const seg = matchedSegments[idx] || wordMorph?.segments[idx];
          const posCode = seg?.pos || wordMorph?.primaryPos || 'N';
          const posMeta = POS_INFO[posCode] || { en: posCode, ar: posCode };
          nodes.push({
            nodeIndex: nodes.length,
            nodeId,
            kind: tag === 'reference' ? 'reference' : 'word',
            location: value,
            segmentIndex: idx,
            arabic: seg?.arabic || wordMorph?.arabicFull || value,
            pos: posCode,
            posArabic: posMeta.ar,
            fam: seg?.fam,
            wordGroupId,
            displaySegments: idx === 0 ? displaySegments : undefined,
            wordStart: wordIdx,
            wordEnd: wordIdx,
          });
        });
      } else if (PHRASE_INFO[tag]) {
        const dashIdx = value.indexOf(' - ');
        if (dashIdx >= 0) {
          const sId = value.slice(0, dashIdx).trim();
          const eId = value.slice(dashIdx + 3).trim();
          const sNode = parseInt(sId.slice(1), 10) - 1;
          const eNode = parseInt(eId.slice(1), 10) - 1;
          nodes.push({
            nodeIndex: nodes.length,
            nodeId: namesRaw[0],
            kind: 'phrase',
            phraseType: tag,
            phraseLabel: PHRASE_INFO[tag].en,
            phraseArabic: PHRASE_INFO[tag].ar,
            startNode: sNode,
            endNode: eNode,
          });
        }
      } else {
        const posMeta = POS_INFO[tag] || { en: tag, ar: tag };
        wordGroupSeq++;
        nodes.push({
          nodeIndex: nodes.length,
          nodeId: namesRaw[0],
          kind: 'elided',
          arabic: value === '*' ? '(*)' : value,
          pos: tag,
          posArabic: posMeta.ar,
          wordGroupId: `elided-${wordGroupSeq}`,
        });
      }
    } else {
      const parenIdx = line.indexOf('(');
      if (parenIdx === -1) continue;
      const tag = line.slice(0, parenIdx).trim();
      const inner = line.slice(parenIdx + 1, line.length - 1).trim();
      const dashIdx = inner.indexOf(' - ');
      if (dashIdx === -1) continue;
      const fromId = inner.slice(0, dashIdx).trim();
      const toId = inner.slice(dashIdx + 3).trim();
      const fromNode = parseInt(fromId.slice(1), 10) - 1;
      const toNode = parseInt(toId.slice(1), 10) - 1;
      const rel = RELATION_INFO[tag] || { ar: tag, en: tag, desc: '' };

      let arabicLabel = rel.ar;
      if (tag === 'subjx' || tag === 'predx') {
        const headFam = nodes[toNode]?.fam || nodes[fromNode]?.fam;
        if (headFam === 'إِنّ') {
          arabicLabel = tag === 'subjx' ? 'اسم «ان»' : 'خبر «ان»';
        } else if (headFam === 'كَان') {
          arabicLabel = tag === 'subjx' ? 'اسم «كان»' : 'خبر «كان»';
        } else if (headFam === 'كَاد') {
          arabicLabel = tag === 'subjx' ? 'اسم «كاد»' : 'خبر «كاد»';
        }
      }

      edges.push({
        fromNode,
        toNode,
        tag,
        arabicLabel,
        englishLabel: rel.en,
        description: rel.desc,
      });
    }
  }

  return {
    graphNumber,
    ayahKey: primaryAyahKey,
    source: 'qac-gold-treebank',
    nodes,
    edges,
  };
}

function normalizeEqtbRelTag(rawRel: string): string {
  const cleaned = rawRel.trim();
  if (!cleaned) return '';
  if (cleaned.includes('<<')) {
    const prefix = cleaned.split('<<')[0].trim().toLowerCase();
    if (prefix === 'pred') return 'predx';
    if (prefix === 'subj') return 'subjx';
    return prefix;
  }
  return cleaned.toLowerCase();
}

function cleanEqtbGloss(raw: string): string | undefined {
  if (!raw || raw === '_' || raw === 'ـ') return undefined;
  const trimmed = raw.replace(/^"+|"+$/g, '').replace(/""/g, '"').trim();
  return trimmed && trimmed !== '_' ? trimmed : undefined;
}

interface EqtbRow {
  sentenceId: string;
  tokenId: number;
  location: string;
  chapterId: number;
  verseId: number;
  uthmaniToken: string;
  phonetic: string;
  trans: string;
  pos: string;
  posAr: string;
  relLabel: string;
  relLabelAr: string;
  refTokenId: number;
  isConstituent: string;
  constituentsLoc: string;
  constituentLabel: string;
  dependRel: string;
  headRel: string;
}

function parseEqtbSentenceOnDemand(
  sentenceBlock: string,
  graphNumber: number,
  primaryAyahKey: string,
  morphLookupCache: Map<string, WordMorphology[]>
): ParsedSyntaxGraph {
  const h = store.eqtbHeaderIdx;
  const rows: EqtbRow[] = [];

  for (const line of sentenceBlock.split('\n')) {
    if (!line) continue;
    const c = line.split('\t');
    rows.push({
      sentenceId: c[h.sentence_id],
      tokenId: Number(c[h.token_id]),
      location: c[h.location],
      chapterId: Number(c[h.chapter_id]),
      verseId: Number(c[h.verse_id]),
      uthmaniToken: c[h.uthmani_token],
      phonetic: c[h.phonetic],
      trans: c[h.trans],
      pos: c[h.pos],
      posAr: c[h.pos_ar],
      relLabel: c[h.rel_label],
      relLabelAr: c[h.rel_label_ar],
      refTokenId: c[h.ref_token_id] === '_' || c[h.ref_token_id] === '-1' ? -1 : Number(c[h.ref_token_id]),
      isConstituent: c[h.is_constituent],
      constituentsLoc: c[h.constituents_loc],
      constituentLabel: c[h.constituent_label],
      dependRel: c[h.depend_rel],
      headRel: c[h.head_rel],
    });
  }

  rows.sort((a, b) => a.tokenId - b.tokenId);

  const nodes: SyntaxNode[] = [];
  const edges: SyntaxEdge[] = [];
  const tokenToNodeIdx = new Map<number, number>();
  const rowToPhraseNodeIdx = new Map<number, number>();
  const phraseSpanCache = new Map<string, number>();

  const wordGroupSeen = new Set<string>();
  const skippedDetTids: number[] = [];

  const getMorphForAyah = (key: string): WordMorphology[] => {
    let m = morphLookupCache.get(key);
    if (!m) {
      m = parseAyahMorphologyOnDemand(key);
      morphLookupCache.set(key, m);
    }
    return m;
  };

  for (const row of rows) {
    const cleanLoc = row.location && row.location !== '_' ? row.location.replace(/[()]/g, '') : '';
    const isElided = !cleanLoc || row.uthmaniToken.startsWith('(');

    if (!isElided && row.pos === 'DET' && (row.relLabel === 'NonRel' || row.relLabel === '_')) {
      skippedDetTids.push(row.tokenId);
      continue;
    }

    let canonicalArabic = row.uthmaniToken;
    let wordNum: number | undefined;
    let segIdx0: number | undefined;
    let shortLoc: string | undefined;
    let wordMorphRef: WordMorphology | undefined;

    if (!isElided && cleanLoc) {
      const parts = cleanLoc.split(':').map(Number);
      if (parts.length === 4) {
        const [s, a, w, seg] = parts;
        const locAyahKey = `${s}:${a}`;
        wordNum = w;
        segIdx0 = seg - 1;
        shortLoc = `${s}:${a}:${w}`;
        wordMorphRef = getMorphForAyah(locAyahKey).find((wm) => wm.wordIndex === w);
        const segMorph = wordMorphRef?.segments[segIdx0];
        if (segMorph?.arabic) {
          canonicalArabic = segMorph.arabic;
        }
      }
    }

    const posCode = row.pos || 'N';
    const posMeta = POS_INFO[posCode] || { en: posCode, ar: row.posAr || posCode };
    const nodeIdx = nodes.length;
    tokenToNodeIdx.set(row.tokenId, nodeIdx);

    while (skippedDetTids.length > 0) {
      const detTid = skippedDetTids.shift()!;
      tokenToNodeIdx.set(detTid, nodeIdx);
    }

    const wgKey = isElided
      ? `elided-${row.sentenceId}-${row.tokenId}`
      : `word-${shortLoc || row.tokenId}-${row.sentenceId}`;
    const isFirstInWordGroup = !wordGroupSeen.has(wgKey);
    if (isFirstInWordGroup) {
      wordGroupSeen.add(wgKey);
    }

    const displaySegments =
      isFirstInWordGroup && !isElided && wordMorphRef
        ? wordMorphRef.segments.map((s) => ({
            arabic: s.arabic,
            pos: s.pos,
            posArabic: s.posArabic,
            isDet: s.pos === 'DET',
          }))
        : undefined;

    nodes.push({
      nodeIndex: nodeIdx,
      nodeId: `n${nodeIdx + 1}`,
      kind: isElided ? 'elided' : 'word',
      location: shortLoc,
      segmentIndex: segIdx0,
      arabic: canonicalArabic,
      phonetic: isFirstInWordGroup ? cleanEqtbGloss(row.phonetic) : undefined,
      translation: isFirstInWordGroup ? cleanEqtbGloss(row.trans) : undefined,
      pos: posCode,
      posArabic: row.posAr && row.posAr !== '_' ? row.posAr : posMeta.ar,
      wordGroupId: wgKey,
      displaySegments,
      wordStart: wordNum,
      wordEnd: wordNum,
    });
  }

  for (const row of rows) {
    if (
      (row.isConstituent === '1' || row.dependRel === '1') &&
      row.constituentsLoc &&
      row.constituentsLoc !== '_' &&
      PHRASE_INFO[row.constituentLabel]
    ) {
      const m = row.constituentsLoc.match(/^\[(\d+)-(\d+)\]$/);
      if (!m) continue;
      const sNode = tokenToNodeIdx.get(Number(m[1]));
      const eNode = tokenToNodeIdx.get(Number(m[2]));
      if (sNode === undefined || eNode === undefined) continue;

      const spanKey = `${row.constituentLabel}:${sNode}-${eNode}`;
      let phraseIdx = phraseSpanCache.get(spanKey);
      if (phraseIdx === undefined) {
        phraseIdx = nodes.length;
        phraseSpanCache.set(spanKey, phraseIdx);
        nodes.push({
          nodeIndex: phraseIdx,
          nodeId: `n${phraseIdx + 1}`,
          kind: 'phrase',
          phraseType: row.constituentLabel,
          phraseLabel: PHRASE_INFO[row.constituentLabel].en,
          phraseArabic: PHRASE_INFO[row.constituentLabel].ar,
          startNode: Math.min(sNode, eNode),
          endNode: Math.max(sNode, eNode),
        });
      }
      rowToPhraseNodeIdx.set(row.tokenId, phraseIdx);
    }
  }

  for (const row of rows) {
    if (
      !row.relLabel ||
      row.relLabel === 'NonRel' ||
      row.relLabel === 'root' ||
      row.relLabel === '_' ||
      row.refTokenId < 0 ||
      row.dependRel === '-1'
    ) {
      continue;
    }

    const fromNode =
      row.dependRel === '1'
        ? rowToPhraseNodeIdx.get(row.tokenId) ?? tokenToNodeIdx.get(row.tokenId)
        : tokenToNodeIdx.get(row.tokenId);

    const toNode =
      row.headRel === '1'
        ? rowToPhraseNodeIdx.get(row.refTokenId) ?? tokenToNodeIdx.get(row.refTokenId)
        : tokenToNodeIdx.get(row.refTokenId);

    if (fromNode === undefined || toNode === undefined || fromNode === toNode) continue;

    const normTag = normalizeEqtbRelTag(row.relLabel);
    const relMeta = RELATION_INFO[normTag];
    const arabicLabel =
      row.relLabelAr && row.relLabelAr !== '_' && row.relLabelAr !== 'ـ'
        ? row.relLabelAr
        : relMeta?.ar || normTag;

    edges.push({
      fromNode,
      toNode,
      tag: normTag,
      arabicLabel,
      englishLabel: relMeta?.en || row.relLabel,
      description: relMeta?.desc || `${row.relLabel} dependency relation`,
    });
  }

  return {
    graphNumber,
    ayahKey: primaryAyahKey,
    source: 'eqtb-noorbayan',
    nodes,
    edges,
  };
}

async function indexMorphologyStream(filePath: string): Promise<Array<[number, number, number]>> {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  const tokenCoords: Array<[number, number, number]> = [];
  let lastWordKey = '';

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const t1 = line.indexOf('\t');
    if (t1 === -1) continue;
    const loc = line.slice(0, t1);
    const p = loc.split(':');
    if (p.length !== 4) continue;
    const surah = Number(p[0]);
    const ayah = Number(p[1]);
    const wordIndex = Number(p[2]);
    const ayahKey = `${surah}:${ayah}`;
    const wordKey = `${ayahKey}:${wordIndex}`;

    store.totalMorphSegments++;
    if (wordKey !== lastWordKey) {
      lastWordKey = wordKey;
      store.totalMorphWords++;
      tokenCoords.push([surah, ayah, wordIndex]);
    }

    let arr = store.rawMorphByAyah.get(ayahKey);
    if (!arr) {
      arr = [];
      store.rawMorphByAyah.set(ayahKey, arr);
    }
    arr.push(line);
  }

  return tokenCoords;
}

async function indexIrabStream(
  filePath: string,
  tokenCoords: Array<[number, number, number]>
): Promise<void> {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let cursor = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const tabIdx = line.indexOf('\t');
    if (tabIdx === -1) continue;
    const spanCount = parseInt(line.slice(0, tabIdx), 10);
    const irabText = line.slice(tabIdx + 1).replace(/\\n/g, '\n').trim();
    if (isNaN(spanCount) || spanCount <= 0) continue;

    const startToken = tokenCoords[cursor];
    const endToken = tokenCoords[Math.min(cursor + spanCount - 1, tokenCoords.length - 1)];
    if (startToken && endToken) {
      const ayahKey = `${startToken[0]}:${startToken[1]}`;
      let arr = store.irabByAyah.get(ayahKey);
      if (!arr) {
        arr = [];
        store.irabByAyah.set(ayahKey, arr);
      }
      arr.push({
        wordStart: startToken[2],
        wordEnd:
          endToken[0] === startToken[0] && endToken[1] === startToken[1]
            ? endToken[2]
            : startToken[2],
        text: irabText,
      });
    }
    cursor += spanCount;
  }
}

async function indexSyntaxStream(filePath: string): Promise<void> {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let blockLines: string[] = [];

  const flushBlock = () => {
    if (blockLines.length === 0) return;
    let primaryAyahKey = '';
    for (const l of blockLines) {
      const eqIdx = l.indexOf(' = word(');
      if (eqIdx > 0) {
        const val = l.slice(eqIdx + 8, l.length - 1).trim();
        const parts = val.split(':');
        if (parts.length >= 2) {
          primaryAyahKey = `${Number(parts[0])}:${Number(parts[1])}`;
          break;
        }
      }
    }
    if (primaryAyahKey) {
      const sNum = Number(primaryAyahKey.split(':')[0]);
      store.goldSurahs.add(sNum);
      let arr = store.rawSyntaxByAyah.get(primaryAyahKey);
      if (!arr) {
        arr = [];
        store.rawSyntaxByAyah.set(primaryAyahKey, arr);
        store.goldAyahCount++;
      }
      arr.push(blockLines.join('\n'));
    }
    blockLines = [];
  };

  for await (const rawLine of rl) {
    const trimmed = rawLine.trim();
    if (trimmed === 'go') {
      flushBlock();
    } else if (trimmed.length > 0 && !trimmed.startsWith('--')) {
      blockLines.push(trimmed);
    }
  }
  flushBlock();
}

async function indexEqtbStream(csvPath: string): Promise<void> {
  const rl = readline.createInterface({
    input: fs.createReadStream(csvPath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let isHeader = true;
  let iSid = 0;
  let iCh = 0;
  let iVr = 0;
  let iLoc = 0;
  let iHeadRel = 0;

  const sentences = new Map<string, { lines: string[]; ayahKeys: Set<string> }>();

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      const headers = line.split('\t').map((h) => h.replace(/^\uFEFF/, '').trim());
      const names = [
        'sentence_id', 'token_id', 'location', 'chapter_id', 'verse_id',
        'uthmani_token', 'phonetic', 'trans', 'pos', 'pos_ar',
        'rel_label', 'rel_label_ar', 'ref_token_id', 'is_constituent',
        'constituents_loc', 'constituent_label', 'depend_rel', 'head_rel',
      ];
      for (const n of names) {
        store.eqtbHeaderIdx[n] = headers.indexOf(n);
      }
      iSid = store.eqtbHeaderIdx.sentence_id;
      iCh = store.eqtbHeaderIdx.chapter_id;
      iVr = store.eqtbHeaderIdx.verse_id;
      iLoc = store.eqtbHeaderIdx.location;
      iHeadRel = store.eqtbHeaderIdx.head_rel;
      continue;
    }

    if (!line) continue;
    const c = line.split('\t');
    if (c.length <= iHeadRel) continue;

    const chapterId = Number(c[iCh]);
    const verseId = Number(c[iVr]);
    if (!chapterId || !verseId) continue;

    const ayahKey = `${chapterId}:${verseId}`;
    if (store.rawSyntaxByAyah.has(ayahKey)) continue;

    const sid = c[iSid];
    let bucket = sentences.get(sid);
    if (!bucket) {
      bucket = { lines: [], ayahKeys: new Set() };
      sentences.set(sid, bucket);
    }
    bucket.lines.push(line);

    const locVal = c[iLoc];
    if (locVal && locVal !== '_') {
      const cleanLoc = locVal.replace(/[()]/g, '');
      const parts = cleanLoc.split(':');
      if (parts.length === 4) {
        bucket.ayahKeys.add(`${Number(parts[0])}:${Number(parts[1])}`);
      } else {
        bucket.ayahKeys.add(ayahKey);
      }
    } else {
      bucket.ayahKeys.add(ayahKey);
    }
  }

  for (const [, bucket] of sentences) {
    const blockIdx = store.eqtbSentenceBlocks.length;
    store.eqtbSentenceBlocks.push(bucket.lines.join('\n'));
    for (const ak of bucket.ayahKeys) {
      if (store.rawSyntaxByAyah.has(ak)) continue;
      const sNum = Number(ak.split(':')[0]);
      store.eqtbSurahs.add(sNum);
      let arr = store.rawEqtbByAyah.get(ak);
      if (!arr) {
        arr = [];
        store.rawEqtbByAyah.set(ak, arr);
        store.eqtbAyahCount++;
      }
      arr.push(blockIdx);
    }
  }
}

export async function ensureQuranLinguisticsLoaded(): Promise<void> {
  if (store.ready) return;
  if (store.loadingPromise) return store.loadingPromise;

  store.loadingPromise = (async () => {
    try {
      // Process sequentially to minimize peak memory on 512MB hosts (Render free tier)
      const morphPath = await fetchToCacheFile(MORPHOLOGY_URL, 'quran-morphology.txt');
      let tokenCoords: Array<[number, number, number]> | null = await indexMorphologyStream(morphPath);

      const irabPath = await fetchToCacheFile(IRAB_URL, 'irab.tsv');
      await indexIrabStream(irabPath, tokenCoords);
      tokenCoords = null; // Free transient token index immediately

      const syntaxPath = await fetchToCacheFile(SYNTAX_URL, 'syntax.txt');
      await indexSyntaxStream(syntaxPath);

      const eqtbCsvPath = await ensureEqtbCsvFile();
      await indexEqtbStream(eqtbCsvPath);

      store.ready = true;
      console.log(
        `[QuranData] Indexed ${store.totalMorphWords} words (${store.totalMorphSegments} segments), ${store.goldAyahCount} QAC Gold + ${store.eqtbAyahCount} EQTB (${store.goldAyahCount + store.eqtbAyahCount}/6236 ayahs), ${store.irabByAyah.size} irab ayahs.`
      );
    } catch (err) {
      store.loadingPromise = null;
      throw err;
    }
  })();

  return store.loadingPromise;
}

export async function getAyahLinguistics(surah: number, ayah: number) {
  await ensureQuranLinguisticsLoaded();
  const ayahKey = `${surah}:${ayah}`;

  const cached = store.ayahLruCache.get(ayahKey);
  if (cached) {
    store.ayahLruCache.delete(ayahKey);
    store.ayahLruCache.set(ayahKey, cached);
    return cached;
  }

  const words = parseAyahMorphologyOnDemand(ayahKey);
  const morphLookupCache = new Map<string, WordMorphology[]>([[ayahKey, words]]);

  const goldBlocks = store.rawSyntaxByAyah.get(ayahKey);
  const eqtbBlockIds = store.rawEqtbByAyah.get(ayahKey);
  const hasGoldTreebank = Boolean(goldBlocks && goldBlocks.length > 0);

  const graphs: ParsedSyntaxGraph[] = hasGoldTreebank
    ? goldBlocks!.map((blk, idx) =>
        parseSyntaxBlockOnDemand(blk, idx + 1, ayahKey, morphLookupCache)
      )
    : (eqtbBlockIds || []).map((blockIdx, idx) =>
        parseEqtbSentenceOnDemand(
          store.eqtbSentenceBlocks[blockIdx],
          idx + 1,
          ayahKey,
          morphLookupCache
        )
      );

  const irab = store.irabByAyah.get(ayahKey) || [];

  const payload: CachedAyahPayload = {
    ayahKey,
    surah,
    ayah,
    hasGoldTreebank,
    graphSource: hasGoldTreebank ? 'qac-gold-treebank' : 'eqtb-noorbayan',
    words,
    graphs,
    irab,
  };

  store.ayahLruCache.set(ayahKey, payload);
  if (store.ayahLruCache.size > 100) {
    const oldestKey = store.ayahLruCache.keys().next().value;
    if (oldestKey) store.ayahLruCache.delete(oldestKey);
  }

  return payload;
}

export async function getCoverageSummary() {
  await ensureQuranLinguisticsLoaded();
  const totalCovered = store.goldAyahCount + store.eqtbAyahCount;
  return {
    totalQuranSurahs: 114,
    totalQuranAyahs: 6236,
    totalQuranWords: store.totalMorphWords,
    totalMorphSegments: store.totalMorphSegments,
    goldTreebankAyahs: store.goldAyahCount,
    goldTreebankSurahs: store.goldSurahs.size,
    goldTreebankCoveragePct: Number(((store.goldAyahCount / 6236) * 100).toFixed(1)),
    eqtbAyahs: store.eqtbAyahCount,
    eqtbSurahs: store.eqtbSurahs.size,
    eqtbCoveragePct: Number(((store.eqtbAyahCount / 6236) * 100).toFixed(1)),
    goldCoveredRanges: [
      {
        range: 'Surahs 1–8',
        status: 'Quranic Arabic Corpus v2.0 (Gold Treebank)',
        ayahs: 1168,
        source: 'qac-gold-treebank',
      },
      {
        range: 'Surah 9 (1–91)',
        status: 'Quranic Arabic Corpus v2.0 (Gold Treebank)',
        ayahs: 91,
        source: 'qac-gold-treebank',
      },
      {
        range: 'Surah 9 (92–129) & Surahs 10–58',
        status: `Extended Quranic Treebank — NoorBayan EQTB (${totalCovered === 6236 ? '100%' : ''} Dataset-Backed)`,
        ayahs: store.eqtbAyahCount,
        source: 'eqtb-noorbayan',
      },
      {
        range: 'Surahs 59–114',
        status: 'Quranic Arabic Corpus v2.0 (Gold Treebank)',
        ayahs: 1177,
        source: 'qac-gold-treebank',
      },
    ],
    irabCoveredAyahs: store.irabByAyah.size,
  };
}
