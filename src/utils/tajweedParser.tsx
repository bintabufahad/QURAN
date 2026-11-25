import React from 'react';

export const TAJWEED_RULES: Record<string, { name: string; arabic: string; color: string; desc: string }> = {
  ghunnah: {
    name: 'Ghunnah',
    arabic: 'غنة',
    color: '#15803D',
    desc: 'Nasalization held for 2 counts on Noon/Meem Mushaddadah',
  },
  idgham_ghunnah: {
    name: 'Idgham with Ghunnah',
    arabic: 'إدغام بغنة',
    color: '#15803D',
    desc: 'Merging Noon Sakinah/Tanween into ي ن م و with nasalization',
  },
  idgham_wo_ghunnah: {
    name: 'Idgham without Ghunnah',
    arabic: 'إدغام بلا غنة',
    color: '#6B7280',
    desc: 'Complete merging into ل or ر without nasalization',
  },
  ikhafa: {
    name: 'Ikhfa',
    arabic: 'إخفاء',
    color: '#9333EA',
    desc: 'Concealed pronunciation of Noon Sakinah/Tanween with Ghunnah',
  },
  ikhafa_shafawi: {
    name: 'Ikhfa Shafawi',
    arabic: 'إخفاء شفوي',
    color: '#9333EA',
    desc: 'Labial concealment of Meem Sakinah before Ba',
  },
  iqlab: {
    name: 'Iqlab',
    arabic: 'إقلاب',
    color: '#9333EA',
    desc: 'Conversion of Noon Sakinah/Tanween into Meem before Ba',
  },
  qalaqah: {
    name: 'Qalqalah',
    arabic: 'قلقلة',
    color: '#0369A1',
    desc: 'Echoing bounce on ق ط ب ج د when carrying Sukun',
  },
  qalqalah: {
    name: 'Qalqalah',
    arabic: 'قلقلة',
    color: '#0369A1',
    desc: 'Echoing bounce on ق ط ب ج د when carrying Sukun',
  },
  madda_normal: {
    name: 'Madd Tabi‘i (2 counts)',
    arabic: 'مد طبيعي',
    color: '#C47F17',
    desc: 'Natural vowel elongation held for 2 counts',
  },
  madda_permissible: {
    name: 'Madd Ja’iz (2–5 counts)',
    arabic: 'مد جائز',
    color: '#D96B27',
    desc: 'Permissible elongation (Munfasil / ‘Arid)',
  },
  madda_obligatory_monfasel: {
    name: 'Madd Munfasil (4–5 counts)',
    arabic: 'مد منفصل',
    color: '#D96B27',
    desc: 'Separated elongation across word boundary',
  },
  madda_obligatory_mottasel: {
    name: 'Madd Muttasil (4–5 counts)',
    arabic: 'مد متصل',
    color: '#B91C1C',
    desc: 'Connected obligatory elongation before Hamza in same word',
  },
  madda_necessary: {
    name: 'Madd Lazim (6 counts)',
    arabic: 'مد لازم',
    color: '#B91C1C',
    desc: 'Necessary full 6-count elongation',
  },
  ham_wasl: {
    name: 'Hamzat al-Wasl',
    arabic: 'همزة الوصل',
    color: '#8E949B',
    desc: 'Connecting Hamza dropped in continuous recitation',
  },
  laam_shamsiyah: {
    name: 'Lam Shamsiyyah',
    arabic: 'لام شمسية',
    color: '#8E949B',
    desc: 'Silent Lam assimilated into the following sun letter',
  },
  slnt: {
    name: 'Silent Letter',
    arabic: 'حرف صامت',
    color: '#8E949B',
    desc: 'Written orthographically but silent in recitation',
  },
};

/**
 * Safely parses Quran.com v4 Tajweed markup (<rule class=...>...</rule> or <tajweed class=...>...</tajweed>)
 * into React nodes without raw HTML injection.
 */
export function renderTajweedText(markup: string, fallbackPlain: string): React.ReactNode {
  if (!markup || !markup.includes('<')) {
    return fallbackPlain;
  }

  const tokenRegex = /<(rule|tajweed)\s+class=([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = tokenRegex.exec(markup)) !== null) {
    if (match.index > lastIndex) {
      parts.push(markup.slice(lastIndex, match.index));
    }
    const ruleClass = match[2];
    const innerText = match[3];
    const ruleMeta = TAJWEED_RULES[ruleClass];

    parts.push(
      <span
        key={`tj-${keyCounter++}`}
        className={`tj-${ruleClass}`}
        title={ruleMeta ? `${ruleMeta.name} (${ruleMeta.arabic}) — ${ruleMeta.desc}` : ruleClass}
      >
        {innerText}
      </span>
    );
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < markup.length) {
    // Strip any stray unclosed/unknown tags safely
    parts.push(markup.slice(lastIndex).replace(/<[^>]+>/g, ''));
  }

  return parts.length > 0 ? parts : fallbackPlain;
}

export const TAJWEED_LEGEND_ITEMS = [
  { key: 'ghunnah', label: 'Ghunnah / Idgham (Nasal)', color: '#15803D', arabic: 'غنة / إدغام' },
  { key: 'ikhafa', label: 'Ikhfa / Iqlab (Concealment)', color: '#9333EA', arabic: 'إخفاء / إقلاب' },
  { key: 'qalaqah', label: 'Qalqalah (Echoing)', color: '#0369A1', arabic: 'قلقلة' },
  { key: 'madda_normal', label: 'Madd Tabi‘i (2 counts)', color: '#C47F17', arabic: 'مد طبيعي' },
  { key: 'madda_permissible', label: 'Madd Ja’iz / Munfasil (4–5)', color: '#D96B27', arabic: 'مد منفصل' },
  { key: 'madda_necessary', label: 'Madd Wajib / Lazim (4–6)', color: '#B91C1C', arabic: 'مد متصل / لازم' },
  { key: 'ham_wasl', label: 'Silent / Lam Shamsiyyah / Wasl', color: '#8E949B', arabic: 'وصل / صامت' },
];
