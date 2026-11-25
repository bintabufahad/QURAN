import fs from 'fs';
import path from 'path';
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

interface QuranLinguisticsStore {
  ready: boolean;
  loadingPromise: Promise<void> | null;
  morphologyByAyah: Map<string, WordMorphology[]>;
  tokenList: Array<{ surah: number; ayah: number; wordIndex: number; location: string }>;
  syntaxByAyah: Map<string, ParsedSyntaxGraph[]>;
  eqtbByAyah: Map<string, ParsedSyntaxGraph[]>;
  irabByAyah: Map<string, IrabEntry[]>;
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
  morphologyByAyah: new Map(),
  tokenList: [],
  syntaxByAyah: new Map(),
  eqtbByAyah: new Map(),
  irabByAyah: new Map(),
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

async function fetchWithCache(url: string, filename: string): Promise<string> {
  ensureCacheDir();
  const filePath = path.join(CACHE_DIR, filename);
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    if (stat.size > 10000) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const text = await res.text();
  fs.writeFileSync(filePath, text, 'utf-8');
  return text;
}

async function fetchEqtbCsvWithCache(): Promise<string> {
  ensureCacheDir();
  const csvPath = path.join(CACHE_DIR, 'Quranic.csv');
  if (fs.existsSync(csvPath)) {
    const stat = fs.statSync(csvPath);
    if (stat.size > 10_000_000) {
      return fs.readFileSync(csvPath, 'utf-8');
    }
  }

  const rarPath = path.join(CACHE_DIR, 'Quranic.rar');
  let rarBuffer: Buffer;
  if (fs.existsSync(rarPath) && fs.statSync(rarPath).size > 1_000_000) {
    rarBuffer = fs.readFileSync(rarPath);
  } else {
    const res = await fetch(EQTB_RAR_URL);
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

  // NoorBayan Quranic.csv is UTF-16LE encoded; convert once and cache UTF-8 for fast restarts
  const utf8Text = Buffer.from(fileEntry.extraction).toString('utf16le');
  fs.writeFileSync(csvPath, utf8Text, 'utf-8');
  return utf8Text;
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

  // Exact corpus.quran.com English description formatter
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
  } else if (txt === 'ى' || txt === 'ي' || txt === 'نِى' || seg.person === '1' && seg.number === 'S') {
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
  // Refine PRON descriptions with contextual role (possessive vs object vs subject)
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
          ? (seg.arabic.includes('و') || seg.arabic === 'ا' || seg.arabic.startsWith('ت') || seg.arabic === 'نَ'
              ? 'subject pronoun'
              : 'object pronoun')
          : 'personal pronoun';
      seg.englishDescription = [...pgnParts, roleWord].filter(Boolean).join(' ');
    }
  });

  // Build corpus.quran.com concise green Arabic syntax & morphology line
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

function parseMorphologyFile(rawText: string): void {
  const lines = rawText.split('\n');
  let lastWordKey = '';
  let currentWord: WordMorphology | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const cols = line.split('\t');
    if (cols.length < 4) continue;

    const [loc, arabic, tag, featStr] = cols;
    const locParts = loc.split(':');
    if (locParts.length !== 4) continue;
    const surah = Number(locParts[0]);
    const ayah = Number(locParts[1]);
    const wordIndex = Number(locParts[2]);
    const segmentIndex = Number(locParts[3]);
    const ayahKey = `${surah}:${ayah}`;
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

    store.totalMorphSegments++;

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
      if (!store.morphologyByAyah.has(ayahKey)) {
        store.morphologyByAyah.set(ayahKey, []);
      }
      store.morphologyByAyah.get(ayahKey)!.push(currentWord);
      store.tokenList.push({ surah, ayah, wordIndex, location: wordKey });
      store.totalMorphWords++;
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
}

function parseIrabFile(rawText: string): void {
  const lines = rawText.split('\n');
  let cursor = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const tabIdx = line.indexOf('\t');
    if (tabIdx === -1) continue;
    const spanCount = parseInt(line.slice(0, tabIdx), 10);
    const irabText = line.slice(tabIdx + 1).replace(/\\n/g, '\n').trim();
    if (isNaN(spanCount) || spanCount <= 0) continue;

    const startToken = store.tokenList[cursor];
    const endToken = store.tokenList[Math.min(cursor + spanCount - 1, store.tokenList.length - 1)];
    if (startToken && endToken) {
      const ayahKey = `${startToken.surah}:${startToken.ayah}`;
      if (!store.irabByAyah.has(ayahKey)) {
        store.irabByAyah.set(ayahKey, []);
      }
      store.irabByAyah.get(ayahKey)!.push({
        wordStart: startToken.wordIndex,
        wordEnd:
          endToken.surah === startToken.surah && endToken.ayah === startToken.ayah
            ? endToken.wordIndex
            : startToken.wordIndex,
        text: irabText,
      });
    }
    cursor += spanCount;
  }
}

function parseSyntaxFile(rawText: string): void {
  const blocks = rawText.split(/\r?\ngo\r?\n/);
  const ayahGraphCounts = new Map<string, number>();

  for (const block of blocks) {
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('--'));
    if (lines.length === 0) continue;

    const nodes: SyntaxNode[] = [];
    const edges: SyntaxEdge[] = [];
    let primaryAyahKey = '';
    let wordGroupSeq = 0;

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
          if (tag === 'word' && !primaryAyahKey) {
            primaryAyahKey = ayahKey;
          }
          const morphWords = store.morphologyByAyah.get(ayahKey);
          const wordMorph = morphWords?.find((w) => w.wordIndex === wordIdx);

          // In QAC syntax.txt, DET ('ال') has no standalone nodeId, so align non-DET segments 1:1
          const syntaxSegments =
            wordMorph?.segments.filter((s) => s.pos !== 'DET') || [];
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

    if (!primaryAyahKey) continue;
    const count = (ayahGraphCounts.get(primaryAyahKey) || 0) + 1;
    ayahGraphCounts.set(primaryAyahKey, count);

    const sNum = Number(primaryAyahKey.split(':')[0]);
    store.goldSurahs.add(sNum);

    if (!store.syntaxByAyah.has(primaryAyahKey)) {
      store.syntaxByAyah.set(primaryAyahKey, []);
      store.goldAyahCount++;
    }
    store.syntaxByAyah.get(primaryAyahKey)!.push({
      graphNumber: count,
      ayahKey: primaryAyahKey,
      source: 'qac-gold-treebank',
      nodes,
      edges,
    });
  }
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
  wordId: number;
  tokId: number;
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

function parseEqtbCsv(rawText: string): void {
  const lines = rawText.split(/\r?\n/);
  if (lines.length < 2) return;

  const headers = lines[0].split('\t').map((h) => h.replace(/^\uFEFF/, '').trim());
  const idx = (name: string) => headers.indexOf(name);

  const iSid = idx('sentence_id');
  const iTid = idx('token_id');
  const iLoc = idx('location');
  const iCh = idx('chapter_id');
  const iVr = idx('verse_id');
  const iWd = idx('word_id');
  const iTk = idx('tok_id');
  const iTok = idx('uthmani_token');
  const iPhon = idx('phonetic');
  const iTrans = idx('trans');
  const iPos = idx('pos');
  const iPosAr = idx('pos_ar');
  const iRel = idx('rel_label');
  const iRelAr = idx('rel_label_ar');
  const iRef = idx('ref_token_id');
  const iIsConst = idx('is_constituent');
  const iConstLoc = idx('constituents_loc');
  const iConstLbl = idx('constituent_label');
  const iDepRel = idx('depend_rel');
  const iHeadRel = idx('head_rel');

  const sentences = new Map<string, EqtbRow[]>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const c = line.split('\t');
    if (c.length <= iHeadRel) continue;

    const chapterId = Number(c[iCh]);
    const verseId = Number(c[iVr]);
    if (!chapterId || !verseId) continue;

    const ayahKey = `${chapterId}:${verseId}`;
    // Keep QAC v2.0 Gold Treebank as authoritative for its 2,436 ayahs
    if (store.syntaxByAyah.has(ayahKey)) continue;

    const sentenceId = c[iSid];
    const row: EqtbRow = {
      sentenceId,
      tokenId: Number(c[iTid]),
      location: c[iLoc],
      chapterId,
      verseId,
      wordId: Number(c[iWd]),
      tokId: Number(c[iTk]),
      uthmaniToken: c[iTok],
      phonetic: c[iPhon],
      trans: c[iTrans],
      pos: c[iPos],
      posAr: c[iPosAr],
      relLabel: c[iRel],
      relLabelAr: c[iRelAr],
      refTokenId: c[iRef] === '_' || c[iRef] === '-1' ? -1 : Number(c[iRef]),
      isConstituent: c[iIsConst],
      constituentsLoc: c[iConstLoc],
      constituentLabel: c[iConstLbl],
      dependRel: c[iDepRel],
      headRel: c[iHeadRel],
    };

    if (!sentences.has(sentenceId)) {
      sentences.set(sentenceId, []);
    }
    sentences.get(sentenceId)!.push(row);
  }

  const ayahGraphCounts = new Map<string, number>();

  for (const [, rows] of sentences) {
    rows.sort((a, b) => a.tokenId - b.tokenId);

    const nodes: SyntaxNode[] = [];
    const edges: SyntaxEdge[] = [];
    const tokenToNodeIdx = new Map<number, number>();
    const rowToPhraseNodeIdx = new Map<number, number>();
    const phraseSpanCache = new Map<string, number>();
    const ayahKeysInSentence = new Set<string>();

    // Pass 1: Build word & elided token nodes in exact token_id order, folding DET into word displaySegments
    const wordGroupSeen = new Set<string>();
    const skippedDetTids: number[] = [];

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
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
          ayahKeysInSentence.add(locAyahKey);
          wordNum = w;
          segIdx0 = seg - 1;
          shortLoc = `${s}:${a}:${w}`;
          wordMorphRef = store.morphologyByAyah.get(locAyahKey)?.find((wm) => wm.wordIndex === w);
          const segMorph = wordMorphRef?.segments[segIdx0];
          if (segMorph?.arabic) {
            canonicalArabic = segMorph.arabic;
          }
        }
      } else {
        ayahKeysInSentence.add(`${row.chapterId}:${row.verseId}`);
      }

      const posCode = row.pos || 'N';
      const posMeta = POS_INFO[posCode] || { en: posCode, ar: row.posAr || posCode };
      const nodeIdx = nodes.length;
      tokenToNodeIdx.set(row.tokenId, nodeIdx);

      // Map any preceding folded DET tokenIds (e.g. constituent boundary '[0-2]') to this node
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

    // Pass 2: Build phrase nodes (PP, VS, NS, CS, SC, S) from is_constituent / constituents_loc
    for (const row of rows) {
      if (
        (row.isConstituent === '1' || row.dependRel === '1') &&
        row.constituentsLoc &&
        row.constituentsLoc !== '_' &&
        PHRASE_INFO[row.constituentLabel]
      ) {
        const m = row.constituentsLoc.match(/^\[(\d+)-(\d+)\]$/);
        if (!m) continue;
        const sTid = Number(m[1]);
        const eTid = Number(m[2]);
        const sNode = tokenToNodeIdx.get(sTid);
        const eNode = tokenToNodeIdx.get(eTid);
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

    // Pass 3: Build dependency edges per nho.py (depend_rel / head_rel semantics)
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

    // Register this EQTB sentence graph for every uncovered ayah present in the sentence
    for (const ayahKey of ayahKeysInSentence) {
      if (store.syntaxByAyah.has(ayahKey)) continue;
      const count = (ayahGraphCounts.get(ayahKey) || 0) + 1;
      ayahGraphCounts.set(ayahKey, count);

      const sNum = Number(ayahKey.split(':')[0]);
      store.eqtbSurahs.add(sNum);

      if (!store.eqtbByAyah.has(ayahKey)) {
        store.eqtbByAyah.set(ayahKey, []);
        store.eqtbAyahCount++;
      }
      store.eqtbByAyah.get(ayahKey)!.push({
        graphNumber: count,
        ayahKey,
        source: 'eqtb-noorbayan',
        nodes,
        edges,
      });
    }
  }
}

export async function ensureQuranLinguisticsLoaded(): Promise<void> {
  if (store.ready) return;
  if (store.loadingPromise) return store.loadingPromise;

  store.loadingPromise = (async () => {
    const [morphText, syntaxText, irabText, eqtbText] = await Promise.all([
      fetchWithCache(MORPHOLOGY_URL, 'quran-morphology.txt'),
      fetchWithCache(SYNTAX_URL, 'syntax.txt'),
      fetchWithCache(IRAB_URL, 'irab.tsv'),
      fetchEqtbCsvWithCache(),
    ]);

    parseMorphologyFile(morphText);
    parseSyntaxFile(syntaxText);
    parseIrabFile(irabText);
    parseEqtbCsv(eqtbText);
    store.ready = true;
    console.log(
      `[QuranData] Loaded ${store.totalMorphWords} words (${store.totalMorphSegments} segments), ${store.goldAyahCount} QAC Gold ayahs + ${store.eqtbAyahCount} NoorBayan EQTB ayahs (${store.goldAyahCount + store.eqtbAyahCount}/6236 total), ${store.irabByAyah.size} irab ayahs.`
    );
  })();

  return store.loadingPromise;
}

export async function getAyahLinguistics(surah: number, ayah: number) {
  await ensureQuranLinguisticsLoaded();
  const ayahKey = `${surah}:${ayah}`;
  const words = store.morphologyByAyah.get(ayahKey) || [];
  const goldGraphs = store.syntaxByAyah.get(ayahKey);
  const eqtbGraphs = store.eqtbByAyah.get(ayahKey);
  const hasGoldTreebank = Boolean(goldGraphs && goldGraphs.length > 0);
  const graphs = hasGoldTreebank ? goldGraphs! : eqtbGraphs || [];
  const irab = store.irabByAyah.get(ayahKey) || [];

  return {
    ayahKey,
    surah,
    ayah,
    hasGoldTreebank,
    graphSource: (hasGoldTreebank ? 'qac-gold-treebank' : 'eqtb-noorbayan') as GraphDatasetSource,
    words,
    graphs,
    irab,
  };
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
