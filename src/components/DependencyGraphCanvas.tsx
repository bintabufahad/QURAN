import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, ZoomIn, ZoomOut, RotateCcw, Info, CheckCircle2, Database } from 'lucide-react';
import {
  GraphDatasetSource,
  ParsedSyntaxGraph,
  SyntaxEdge,
  SyntaxNode,
  WordMorphology,
} from '../types/quran';

interface DependencyGraphCanvasProps {
  graphs: ParsedSyntaxGraph[];
  words: WordMorphology[];
  hasGoldTreebank: boolean;
  graphSource?: GraphDatasetSource;
  ayahKey: string;
  selectedWordIndex: number | null;
  onSelectWord: (wordIndex: number) => void;
}

/** Exact corpus.quran.com Part-of-Speech color palette */
export const CORPUS_POS_COLOR: Record<string, string> = {
  T: '#D97706',     // Time adverb (orange)
  LOC: '#D97706',   // Location adverb (orange)
  V: '#16A34A',     // Verb (green)
  N: '#2563EB',     // Noun (blue)
  PN: '#0284C7',    // Proper noun (cobalt blue)
  ADJ: '#0D9488',   // Adjective (teal)
  PRON: '#64748B',  // Pronoun (slate grey)
  P: '#B91C1C',     // Preposition (crimson red)
  ACC: '#9D174D',   // Accusative particle (magenta)
  DET: '#9CA3AF',   // Determiner al- (light grey)
  CONJ: '#6B4F3B',  // Conjunction (warm umber)
  REM: '#6B4F3B',   // Resumption (warm umber)
  REL: '#7C3AED',   // Relative pronoun (violet)
  DEM: '#7C3AED',   // Demonstrative (violet)
  NEG: '#DC2626',   // Negative particle (red)
  PRO: '#DC2626',   // Prohibition particle (red)
  SUB: '#6D28D9',   // Subordinating conj (purple)
  COND: '#EA580C',  // Conditional (burnt orange)
  INTG: '#9333EA',  // Interrogative (purple)
  EMPH: '#B45309',  // Emphatic (amber-brown)
  CERT: '#B45309',  // Certainty (amber-brown)
  FUT: '#0F766E',   // Future (teal)
  IMPV: '#B91C1C',  // Imperative prefix (crimson)
  VOC: '#0F766E',   // Vocative (teal)
  RES: '#9333EA',   // Restriction (purple)
  EXP: '#9333EA',   // Exceptive (purple)
  INL: '#B58833',   // Quranic initials (gold)
};

export const CORPUS_PHRASE_COLOR: Record<string, string> = {
  PP: '#B91C1C',
  VS: '#16A34A',
  NS: '#0F766E',
  CS: '#D97706',
  SC: '#7C3AED',
  S: '#475569',
};

const CORPUS_EDGE_COLOR: Record<string, string> = {
  subj: '#4A80C4',
  poss: '#4A80C4',
  pass: '#4A80C4',
  gen: '#B91C1C',
  link: '#E17009',
  obj: '#5A768C',
  subjx: '#4A80C4',
  predx: '#5A768C',
  pred: '#5A768C',
  adj: '#0D9488',
  conj: '#6B4F3B',
  sub: '#7C3AED',
  neg: '#DC2626',
  cond: '#EA580C',
  rslt: '#EA580C',
  app: '#0F766E',
  circ: '#0D9488',
  state: '#0D9488',
};

const ARABIC_POS_FALLBACK: Record<string, string> = {
  N: 'اسم',
  PN: 'اسم علم',
  ADJ: 'صفة',
  PRON: 'ضمير',
  DEM: 'اسم إشارة',
  REL: 'اسم موصول',
  V: 'فعل',
  P: 'حرف جر',
  CONJ: 'حرف عطف',
  DET: 'أل التعريف',
  NEG: 'حرف نفي',
  REM: 'حرف استئناف',
  EMPH: 'لام التوكيد',
  INTG: 'حرف استفهام',
  COND: 'أداة شرط',
  RES: 'أداة حصر',
  SUB: 'حرف مصدري',
  ACC: 'حرف نصب',
  VOC: 'حرف نداء',
  LOC: 'ظرف مكان',
  T: 'ظرف زمان',
  CERT: 'حرف تحقيق',
  FUT: 'حرف استقبال',
  PRO: 'حرف نهي',
  INL: 'حروف مقطعة',
};

const ARABIC_PHRASE_FALLBACK: Record<string, string> = {
  S: 'جملة',
  NS: 'جملة اسمية',
  VS: 'جملة فعلية',
  CS: 'جملة شرطية',
  PP: 'شبه جملة',
  SC: 'جملة فرعية',
};

/**
 * 1D HeightMap modeled after kaisdukes/quranic-corpus SyntaxGraphVisualizer.
 */
class SpanHeightMap {
  private intervals: Array<{ x1: number; x2: number; y: number }> = [];

  constructor(private readonly baselineY: number) {}

  getHeight(x1: number, x2: number): number {
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    let maxY = this.baselineY;
    for (const iv of this.intervals) {
      if (!(right < iv.x1 || left > iv.x2)) {
        if (iv.y > maxY) maxY = iv.y;
      }
    }
    return maxY;
  }

  setHeight(x1: number, x2: number, y: number): void {
    this.intervals.push({
      x1: Math.min(x1, x2),
      x2: Math.max(x1, x2),
      y,
    });
  }
}

interface WordGroupLayout {
  groupId: string;
  centerX: number;
  width: number;
  repNode: SyntaxNode;
  nodes: SyntaxNode[];
}

export const DependencyGraphCanvas: React.FC<DependencyGraphCanvasProps> = ({
  graphs,
  hasGoldTreebank,
  graphSource,
  ayahKey,
  selectedWordIndex,
  onSelectWord,
}) => {
  const [activeGraphIdx, setActiveGraphIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [hoveredEdgeIdx, setHoveredEdgeIdx] = useState<number | null>(null);
  const [hoveredNodeIdx, setHoveredNodeIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const firstNonEmpty = graphs.findIndex((g) => g.edges.length > 0);
    setActiveGraphIdx(firstNonEmpty >= 0 ? firstNonEmpty : 0);
    setHoveredEdgeIdx(null);
    setHoveredNodeIdx(null);
  }, [ayahKey, graphs]);

  const safeIdx = activeGraphIdx < graphs.length ? activeGraphIdx : 0;
  const graph = graphs[safeIdx];
  const effectiveSource =
    graph?.source || graphSource || (hasGoldTreebank ? 'qac-gold-treebank' : 'eqtb-noorbayan');

  const layout = useMemo(() => {
    if (!graph) return null;

    const baseNodes = graph.nodes.filter((n) => n.kind !== 'phrase');
    const phraseNodes = graph.nodes.filter((n) => n.kind === 'phrase');

    // Group consecutive base nodes sharing wordGroupId (e.g., رَبُّكَ -> [N, PRON])
    const groups: Array<{ groupId: string; nodes: SyntaxNode[] }> = [];
    for (const node of baseNodes) {
      const gid = node.wordGroupId || node.location || `solo-${node.nodeIndex}`;
      const last = groups[groups.length - 1];
      if (last && last.groupId === gid && node.kind !== 'elided') {
        last.nodes.push(node);
      } else {
        groups.push({ groupId: gid, nodes: [node] });
      }
    }

    const paddingX = 56;
    const singleWordColWidth = 88;
    const multiSegSpan = 48; // tight segment column spacing under a single joined Arabic word

    const groupWidths = groups.map((g) => {
      const segCount = g.nodes.length;
      if (segCount <= 1) {
        return g.nodes[0]?.kind === 'elided' ? 68 : singleWordColWidth;
      }
      return Math.max(106, segCount * multiSegSpan + 16);
    });

    const totalGroupsWidth = groupWidths.reduce((s, w) => s + w, 0);
    const totalWidth = Math.max(640, totalGroupsWidth + paddingX * 2);

    // Exact corpus.quran.com Top-Down vertical stack
    const locationY = 20;
    const phoneticY = 36;
    const translationY = 52;
    const arabicY = 92;
    const dotY = 112;
    const posY = 128;
    const arcAnchorY = 136;

    const nodeX = new Map<number, number>();
    const nodeAnchorY = new Map<number, number>();
    const wordGroups: WordGroupLayout[] = [];

    // RTL placement: group 0 sits rightmost, advancing leftward
    let rightCursor = totalWidth - paddingX;
    groups.forEach((g, gi) => {
      const w = groupWidths[gi];
      const centerX = rightCursor - w / 2;
      rightCursor -= w;

      const count = g.nodes.length;
      if (count === 1) {
        nodeX.set(g.nodes[0].nodeIndex, centerX);
        nodeAnchorY.set(g.nodes[0].nodeIndex, arcAnchorY);
      } else {
        // Rightmost segment = suffix? No, Arabic reads RTL: segment 0 (prefix/stem) is RIGHT, suffix is LEFT!
        const step = Math.min(46, (w - 22) / count);
        g.nodes.forEach((n, si) => {
          const offsetFromCenter = ((count - 1) / 2 - si) * step;
          nodeX.set(n.nodeIndex, centerX + offsetFromCenter);
          nodeAnchorY.set(n.nodeIndex, arcAnchorY);
        });
      }

      wordGroups.push({
        groupId: g.groupId,
        centerX,
        width: w,
        repNode: g.nodes[0],
        nodes: g.nodes,
      });
    });

    const heightMap = new SpanHeightMap(arcAnchorY + 8);

    // Build lookup of every edge attached to each node so phrase brackets reserve space below dependent arcs!
    // In corpus.quran.com: inner token-to-token arcs sit ABOVE phrase brackets if they lie inside, OR phrase brackets sit cleanly above arcs that leave the phrase!
    // Specifically: sort internal token-level edges (short spans whose nodes are inside a phrase) vs phrase edges!
    const phraseLayouts: Array<{
      node: SyntaxNode;
      leftX: number;
      rightX: number;
      midX: number;
      barY: number;
      dotY: number;
      labelY: number;
      anchorY: number;
    }> = [];

    // Compute pixel spans of all phrases
    const sortedPhrases = [...phraseNodes]
      .map((pn) => {
        const s = pn.startNode ?? 0;
        const e = pn.endNode ?? s;
        const xs: number[] = [];
        for (let k = Math.min(s, e); k <= Math.max(s, e); k++) {
          const vx = nodeX.get(k);
          if (vx !== undefined) xs.push(vx);
        }
        const leftX = (xs.length > 0 ? Math.min(...xs) : paddingX) - 24;
        const rightX = (xs.length > 0 ? Math.max(...xs) : paddingX + 56) + 24;
        return { pn, s: Math.min(s, e), e: Math.max(s, e), leftX, rightX, span: rightX - leftX };
      })
      .sort((a, b) => a.span - b.span);

    // Check which edges are token-to-token vs phrase-involved
    const tokenEdges: Array<{
      edge: SyntaxEdge;
      idx: number;
      xFrom: number;
      xTo: number;
      span: number;
    }> = [];
    const phraseEdges: Array<{
      edge: SyntaxEdge;
      idx: number;
      xFrom: number;
      xTo: number;
      span: number;
    }> = [];

    const phraseNodeSet = new Set(phraseNodes.map((p) => p.nodeIndex));

    // Reserve phrase anchor positions after internal token arcs draw cleanly above them!
    // First pass: identify edges whose both endpoints are non-phrase nodes AND strictly contained within the smallest phrase spanning them
    const deferredCrossPhraseEdges: typeof tokenEdges = [];

    graph.edges.forEach((edge, idx) => {
      if (phraseNodeSet.has(edge.fromNode) || phraseNodeSet.has(edge.toNode)) {
        phraseEdges.push({
          edge,
          idx,
          xFrom: 0,
          xTo: 0,
          span: 0,
        });
      } else {
        const xFrom = nodeX.get(edge.fromNode) ?? paddingX;
        const xTo = nodeX.get(edge.toNode) ?? paddingX;
        const span = Math.abs(xFrom - xTo);
        // Does a phrase contain one endpoint and NOT the other, OR does a phrase sit below?
        const fromPhrases = sortedPhrases.filter((p) => edge.fromNode >= p.s && edge.fromNode <= p.e);
        const toPhrases = sortedPhrases.filter((p) => edge.toNode >= p.s && edge.toNode <= p.e);
        // If edge crosses out of an inner PP/NS into an outer word, draw it AFTER phrase brackets? Actually internal edges inside same phrase ALWAYS sit above the phrase line!
        const sameSmallestPhrase =
          fromPhrases.length === toPhrases.length &&
          fromPhrases.every((p, i) => p.pn.nodeIndex === toPhrases[i]?.pn.nodeIndex);
        if (sameSmallestPhrase || span <= 170) {
          tokenEdges.push({ edge, idx, xFrom, xTo, span });
        } else {
          deferredCrossPhraseEdges.push({ edge, idx, xFrom, xTo, span });
        }
      }
    });

    tokenEdges.sort((a, b) => a.span - b.span);

    const edgeLayouts: Array<{
      edge: SyntaxEdge;
      idx: number;
      xFrom: number;
      xTo: number;
      yFrom: number;
      yTo: number;
      apexX: number;
      apexY: number;
      ctrlY: number;
      pointsRight: boolean;
      color: string;
    }> = [];

    const layoutEdge = (edge: SyntaxEdge, idx: number, xFrom: number, xTo: number) => {
      const yFrom = nodeAnchorY.get(edge.fromNode) ?? arcAnchorY;
      const yTo = nodeAnchorY.get(edge.toNode) ?? arcAnchorY;
      const leftX = Math.min(xFrom, xTo);
      const rightX = Math.max(xFrom, xTo);
      const span = Math.abs(xFrom - xTo);
      const maxEndpointY = Math.max(yFrom, yTo);

      const floorY = heightMap.getHeight(leftX + 6, rightX - 6);
      const depthBoost = Math.min(34, span * 0.08);
      const apexY = Math.max(maxEndpointY + 26 + depthBoost, floorY + 22);

      // Compute exact cubic Bezier control Y so curve midpoint hits apexY cleanly
      const ctrlY = (apexY - 0.125 * (yFrom + yTo)) / 0.75;
      const apexX = (xFrom + xTo) / 2;

      heightMap.setHeight(leftX + 4, rightX - 4, apexY + 24);

      edgeLayouts.push({
        edge,
        idx,
        xFrom,
        xTo,
        yFrom,
        yTo,
        apexX,
        apexY,
        ctrlY,
        pointsRight: xTo > xFrom,
        color: CORPUS_EDGE_COLOR[edge.tag] || '#5A768C',
      });
    };

    // 1. Token-level inner dependency arcs first
    for (const item of tokenEdges) {
      layoutEdge(item.edge, item.idx, item.xFrom, item.xTo);
    }

    // 2. Phrase horizontal bars (shortest phrase first) directly under internal arcs
    for (const item of sortedPhrases) {
      const midX = (item.leftX + item.rightX) / 2;
      const floorY = heightMap.getHeight(item.leftX, item.rightX);
      const barY = floorY + 14;
      const pDotY = barY + 11;
      const pLabelY = barY + 27;
      const pAnchorY = barY + 34;
      heightMap.setHeight(item.leftX, item.rightX, pAnchorY + 6);

      nodeX.set(item.pn.nodeIndex, midX);
      nodeAnchorY.set(item.pn.nodeIndex, pAnchorY);

      phraseLayouts.push({
        node: item.pn,
        leftX: item.leftX,
        rightX: item.rightX,
        midX,
        barY,
        dotY: pDotY,
        labelY: pLabelY,
        anchorY: pAnchorY,
      });
    }

    // 3. Phrase-to-head arcs + long cross-phrase edges (sorted shortest span first)
    const remainingEdges = [
      ...phraseEdges.map((pe) => {
        const xFrom = nodeX.get(pe.edge.fromNode) ?? paddingX;
        const xTo = nodeX.get(pe.edge.toNode) ?? paddingX;
        return { ...pe, xFrom, xTo, span: Math.abs(xFrom - xTo) };
      }),
      ...deferredCrossPhraseEdges,
    ].sort((a, b) => a.span - b.span);

    for (const item of remainingEdges) {
      layoutEdge(item.edge, item.idx, item.xFrom, item.xTo);
    }

    const bottomExtent = heightMap.getHeight(0, totalWidth);
    const totalHeight = Math.max(240, bottomExtent + 28);

    return {
      totalWidth,
      totalHeight,
      locationY,
      phoneticY,
      translationY,
      arabicY,
      dotY,
      posY,
      arcAnchorY,
      wordGroups,
      baseNodes,
      phraseLayouts,
      nodeX,
      nodeAnchorY,
      edgeLayouts,
    };
  }, [graph]);

  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgRef.current);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ayah-${ayahKey.replace(':', '-')}-quran-corpus-graph.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!graph || !layout) {
    return (
      <div className="p-8 text-center text-sm text-stone-600 bg-[#FCF9F0]">
        <div className="font-semibold">لا تتوفر بيانات إضافية لهذه الآية ({ayahKey})</div>
        <div className="text-[11px] mt-0.5">
          No dependency graph data available for Ayah {ayahKey}.
        </div>
      </div>
    );
  }

  const activeEdge =
    hoveredEdgeIdx !== null
      ? layout.edgeLayouts.find((e) => e.idx === hoveredEdgeIdx) || null
      : null;
  const activeNode = hoveredNodeIdx !== null ? graph.nodes[hoveredNodeIdx] : null;

  return (
    <div className="h-full w-full min-w-0 flex flex-col border border-[#B6CDA2]/60 rounded-xl bg-[#FCF9F0] overflow-hidden">
      {/* Fixed-Height Single-Line Toolbar */}
      <div className="h-[34px] shrink-0 flex items-center justify-between gap-2 px-2.5 border-b border-[#B6CDA2]/40 bg-[#F4F0E4] overflow-hidden">
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          {effectiveSource === 'qac-gold-treebank' ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-900 truncate">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
              <span className="font-semibold truncate">QAC v2.0 Gold Treebank</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-900 truncate">
              <Database className="w-3.5 h-3.5 shrink-0 text-sky-700" />
              <span className="font-semibold truncate">NoorBayan EQTB</span>
            </span>
          )}
          <span aria-hidden="true" className="text-stone-400 shrink-0">
            ·
          </span>
          <span className="text-[11px] font-mono-tabular text-stone-600 whitespace-nowrap shrink-0">
            {layout.wordGroups.length} words · {layout.edgeLayouts.length} arcs
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.55, Number((z - 0.15).toFixed(2))))}
            aria-label="تصغير الرسم / Zoom out"
            className="p-1 rounded border border-[#B6CDA2] bg-white text-stone-700 hover:bg-[#B6CDA2]/20 transition-colors"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <span className="text-[11px] font-mono-tabular w-9 text-center text-stone-700">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
            aria-label="تكبير الرسم / Zoom in"
            className="p-1 rounded border border-[#B6CDA2] bg-white text-stone-700 hover:bg-[#B6CDA2]/20 transition-colors"
          >
            <ZoomIn className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            aria-label="إعادة الحجم / Reset zoom"
            className="p-1 rounded border border-[#B6CDA2] bg-white text-stone-700 hover:bg-[#B6CDA2]/20 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleExportSvg}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border border-[#B6CDA2] bg-white text-stone-800 hover:bg-[#B6CDA2]/20 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3 h-3" />
            <span>SVG</span>
          </button>
        </div>
      </div>

      {/* Fixed-Height Graph Switcher Bar (Always 32px tall; horizontal scroll for many graphs) */}
      <div className="h-[32px] shrink-0 flex items-center gap-1.5 px-2.5 border-b border-[#B6CDA2]/30 bg-[#FAF6EB] overflow-x-auto custom-scrollbar whitespace-nowrap">
        <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider shrink-0 mr-1">
          Graphs ({graphs.length}):
        </span>
        {graphs.map((g, idx) => (
          <button
            key={g.graphNumber}
            type="button"
            onClick={() => setActiveGraphIdx(idx)}
            className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              safeIdx === idx
                ? 'bg-[#B6CDA2] text-black shadow-2xs'
                : 'bg-white text-stone-700 border border-[#B6CDA2]/40 hover:bg-[#B6CDA2]/20'
            }`}
          >
            Graph {idx + 1}
          </button>
        ))}
      </div>

      {/* Exact corpus.quran.com Dependency Graph SVG Canvas (Scrollable X & Y inside fixed box) */}
      <div className="flex-1 min-h-0 w-full overflow-x-auto overflow-y-auto custom-scrollbar bg-[#FCF9F0]">
        <div
          style={{
            width: `${Math.max(1, layout.totalWidth * zoom)}px`,
            minWidth: '100%',
            display: 'flex',
            justifyContent: 'center',
          }}
          className="py-2.5 px-3"
        >
          <svg
            ref={svgRef}
            width={layout.totalWidth * zoom}
            height={layout.totalHeight * zoom}
            viewBox={`0 0 ${layout.totalWidth} ${layout.totalHeight}`}
            className="select-none overflow-visible shrink-0"
            role="img"
            aria-label={`مخطط الإعراب النحوي للآية ${ayahKey}`}
          >
            {/* 1. Word Headers & Unified Multi-Segment Color-Coded Arabic Words */}
            {layout.wordGroups.map((wg) => {
              const rep = wg.repNode;
              const isElided = rep.kind === 'elided';
              const isSelectedWord =
                selectedWordIndex !== null && rep.wordStart === selectedWordIndex;
              const isGroupHovered = wg.nodes.some((n) => hoveredNodeIdx === n.nodeIndex);
              const isEdgeLinked =
                activeEdge &&
                wg.nodes.some(
                  (n) =>
                    activeEdge.edge.fromNode === n.nodeIndex ||
                    activeEdge.edge.toNode === n.nodeIndex
                );

              const headerHighlight = isSelectedWord || isGroupHovered || isEdgeLinked;

              const locStr = rep.location
                ? rep.kind === 'reference'
                  ? `[(${rep.location})]`
                  : `(${rep.location})`
                : '';

              return (
                <g
                  key={wg.groupId}
                  onClick={() => {
                    if (rep.wordStart !== undefined) {
                      onSelectWord(rep.wordStart);
                    }
                  }}
                  className="cursor-pointer"
                >
                  {/* Subtle highlight only when selected or hovered — crisp clean white canvas by default */}
                  {headerHighlight && (
                    <rect
                      x={wg.centerX - wg.width / 2 + 4}
                      y={4}
                      width={wg.width - 8}
                      height={layout.arcAnchorY - 4}
                      rx={6}
                      fill="rgba(16, 185, 129, 0.06)"
                      stroke="rgba(16, 185, 129, 0.35)"
                      strokeWidth={1}
                    />
                  )}

                  {/* Row 1: Location (8:12:1) */}
                  {!isElided && locStr && (
                    <text
                      x={wg.centerX}
                      y={layout.locationY}
                      textAnchor="middle"
                      fontSize={11}
                      className="fill-stone-600 font-sans"
                    >
                      {locStr}
                    </text>
                  )}

                  {/* Row 2: Phonetic transliteration in Corpus blue */}
                  {!isElided && rep.phonetic && (
                    <text
                      x={wg.centerX}
                      y={layout.phoneticY}
                      textAnchor="middle"
                      fontSize={11.5}
                      fill="#3B6EA5"
                      className="font-sans"
                    >
                      {rep.phonetic}
                    </text>
                  )}

                  {/* Row 3: Word-by-word English translation */}
                  {!isElided && rep.translation && (
                    <text
                      x={wg.centerX}
                      y={layout.translationY}
                      textAnchor="middle"
                      fontSize={11}
                      className="fill-stone-900 font-sans"
                    >
                      {rep.translation.length > 16
                        ? `${rep.translation.slice(0, 15)}…`
                        : rep.translation}
                    </text>
                  )}

                  {/* Row 4: Joined Multi-Segment Arabic Word (exact segment colors, zero spaces between tspans) */}
                  <text
                    x={wg.centerX}
                    y={layout.arabicY}
                    textAnchor="middle"
                    fontSize={isElided ? 18 : 28}
                    className={
                      isElided
                        ? 'fill-stone-500 font-sans'
                        : 'font-corpus-ar'
                    }
                    direction="rtl"
                  >
                    {isElided ? (
                      '(*)'
                    ) : wg.nodes[0]?.displaySegments && wg.nodes[0].displaySegments.length > 0 ? (
                      wg.nodes[0].displaySegments.map((seg, si) => (
                        <tspan
                          key={`${wg.groupId}-seg-${si}`}
                          fill={CORPUS_POS_COLOR[seg.pos] || '#1E293B'}
                        >
                          {seg.arabic}
                        </tspan>
                      ))
                    ) : (
                      <tspan fill={CORPUS_POS_COLOR[rep.pos || 'N'] || '#1E293B'}>
                        {rep.kind === 'reference' ? `[${rep.arabic}]` : rep.arabic}
                      </tspan>
                    )}
                  </text>

                  {/* Row 5: Segment-aligned dot + short POS code (T, V, N, PRON, P, ACC, LOC) */}
                  {wg.nodes.map((node) => {
                    const nx = layout.nodeX.get(node.nodeIndex) ?? wg.centerX;
                    const posCode = node.pos || 'N';
                    const posColor = CORPUS_POS_COLOR[posCode] || '#475569';
                    const isNodeActive =
                      hoveredNodeIdx === node.nodeIndex ||
                      (activeEdge &&
                        (activeEdge.edge.fromNode === node.nodeIndex ||
                          activeEdge.edge.toNode === node.nodeIndex));

                    return (
                      <g
                        key={node.nodeId}
                        onMouseEnter={() => setHoveredNodeIdx(node.nodeIndex)}
                        onMouseLeave={() => setHoveredNodeIdx(null)}
                      >
                        <circle
                          cx={nx}
                          cy={layout.dotY}
                          r={isNodeActive ? 4 : 2.6}
                          fill={node.kind === 'elided' ? '#9CA3AF' : posColor}
                        />
                        <text
                          x={nx}
                          y={layout.posY}
                          textAnchor="middle"
                          fontSize={12.5}
                          fontWeight={isNodeActive ? 700 : 500}
                          fill={node.kind === 'elided' ? '#9CA3AF' : posColor}
                          className="font-sans"
                        >
                          {posCode}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* 2. Straight Blue Horizontal Phrase Bars + Centered Dot + Phrase Code (PP, NS, VS) */}
            {layout.phraseLayouts.map(
              ({ node: pn, leftX, rightX, midX, barY, dotY, labelY }) => {
                const isHighlighted =
                  hoveredNodeIdx === pn.nodeIndex ||
                  (activeEdge &&
                    (activeEdge.edge.fromNode === pn.nodeIndex ||
                      activeEdge.edge.toNode === pn.nodeIndex));

                const pType = pn.phraseType || 'PP';
                const pColor = CORPUS_PHRASE_COLOR[pType] || '#475569';

                return (
                  <g
                    key={pn.nodeId}
                    onMouseEnter={() => setHoveredNodeIdx(pn.nodeIndex)}
                    onMouseLeave={() => setHoveredNodeIdx(null)}
                    className="cursor-pointer"
                  >
                    {/* Exact corpus.quran.com straight blue horizontal bar (no vertical ticks) */}
                    <line
                      x1={leftX}
                      y1={barY}
                      x2={rightX}
                      y2={barY}
                      stroke={isHighlighted ? '#0F6E54' : '#4A80C4'}
                      strokeWidth={isHighlighted ? 2.2 : 1.5}
                    />
                    <circle
                      cx={midX}
                      cy={dotY}
                      r={isHighlighted ? 4 : 2.6}
                      fill={pColor}
                    />
                    <text
                      x={midX}
                      y={labelY}
                      textAnchor="middle"
                      fontSize={12.5}
                      fontWeight={600}
                      fill={pColor}
                      className="font-sans"
                    >
                      {pType}
                    </text>
                  </g>
                );
              }
            )}

            {/* 3. Smooth Downward Elliptical Dependency Arcs with Triangle & Arabic-Only Label */}
            {layout.edgeLayouts.map((item) => {
              const {
                edge,
                idx,
                xFrom,
                xTo,
                yFrom,
                yTo,
                apexX,
                apexY,
                ctrlY,
                pointsRight,
                color,
              } = item;
              const isHovered = hoveredEdgeIdx === idx;
              const isDimmed = hoveredEdgeIdx !== null && !isHovered;

              const pathD = `M ${xFrom} ${yFrom} C ${xFrom} ${ctrlY}, ${xTo} ${ctrlY}, ${xTo} ${yTo}`;

              const arrowD = pointsRight
                ? `M ${apexX - 3.5} ${apexY - 3.5} L ${apexX + 4.5} ${apexY} L ${apexX - 3.5} ${apexY + 3.5} Z`
                : `M ${apexX + 3.5} ${apexY - 3.5} L ${apexX - 4.5} ${apexY} L ${apexX + 3.5} ${apexY + 3.5} Z`;

              return (
                <g
                  key={`${edge.tag}-${idx}`}
                  onMouseEnter={() => setHoveredEdgeIdx(idx)}
                  onMouseLeave={() => setHoveredEdgeIdx(null)}
                  style={{
                    opacity: isDimmed ? 0.22 : 1,
                    transition: 'opacity 150ms ease',
                  }}
                  className="cursor-pointer"
                >
                  {/* Wide invisible hit path */}
                  <path d={pathD} fill="none" stroke="transparent" strokeWidth={14} />

                  {/* Colored elliptical curve */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={color}
                    strokeWidth={isHovered ? 2.3 : 1.35}
                  />

                  {/* Solid colored directional triangle at apex */}
                  <path d={arrowD} fill={color} />

                  {/* Clean Noto Naskh Arabic relation label (separate halo layer beneath crisp unstroked foreground) */}
                  <text
                    x={apexX}
                    y={apexY + 17}
                    textAnchor="middle"
                    fontSize={13.5}
                    fontWeight={400}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={3.5}
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="font-corpus-label stroke-[#FCF9F0]"
                  >
                    {edge.arabicLabel}
                  </text>
                  <text
                    x={apexX}
                    y={apexY + 17}
                    textAnchor="middle"
                    fontSize={13.5}
                    fontWeight={isHovered ? 600 : 400}
                    fill={color}
                    className="font-corpus-label"
                  >
                    {edge.arabicLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Fixed-Height Bilingual Inspection Footer */}
      <div className="h-[30px] shrink-0 px-3 border-t border-[#B6CDA2]/40 bg-[#F4F0E4] flex items-center gap-2 text-xs overflow-hidden whitespace-nowrap">
        {activeEdge ? (
          <div className="flex items-center gap-2 text-stone-900 min-w-0 truncate">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: activeEdge.color }}
            />
            <span className="font-semibold shrink-0">{activeEdge.edge.arabicLabel}</span>
            <span className="text-[11px] text-stone-600 truncate">
              ({activeEdge.edge.englishLabel} — {activeEdge.edge.description})
            </span>
          </div>
        ) : activeNode ? (
          <div className="flex items-center gap-2 text-stone-900 min-w-0 truncate">
            <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="font-semibold shrink-0">
              {activeNode.kind === 'phrase'
                ? `${activeNode.phraseType} — ${activeNode.phraseArabic || ARABIC_PHRASE_FALLBACK[activeNode.phraseType || '']}`
                : `${activeNode.arabic} — ${activeNode.posArabic || ARABIC_POS_FALLBACK[activeNode.pos || ''] || activeNode.pos}`}
            </span>
            <span className="text-[11px] text-stone-600 truncate">
              {activeNode.kind === 'phrase'
                ? `(${activeNode.phraseLabel})`
                : `(${activeNode.pos})`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-stone-700 min-w-0 truncate">
            <Info className="w-3.5 h-3.5 shrink-0 text-emerald-800" />
            <span className="truncate">
              Hover an arc or click a word to inspect syntax relations · Graph {safeIdx + 1} of {graphs.length}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
