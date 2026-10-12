import { highlightQuery, highlightRanges, type Range } from '@bitbaum/searchkit';

/**
 * Text with what matched picked out. With `ranges` (from a ranked search
 * result) a typo match is marked too — "cqto" marks "Cato"; without them, the
 * words that start with what was typed.
 */
export function Highlight({
  text,
  query = '',
  ranges,
}: {
  text: string;
  query?: string;
  ranges?: readonly Range[];
}) {
  const parts =
    ranges && ranges.length > 0 ? highlightRanges(text, ranges) : highlightQuery(text, query);
  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark key={i} className="oc-search-mark">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}
