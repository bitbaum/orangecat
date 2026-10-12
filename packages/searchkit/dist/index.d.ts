export { fold, tokenize, words, umlautSpelling, joinedPairs, writtenLengths, type Token, } from './normalize.ts';
export { editDistance, prefixDistance } from './distance.ts';
export { typoBudget, DEFAULT_TYPO_POLICY, type TypoPolicy } from './typo.ts';
export { createVocabulary, candidates, type Candidate, type CandidateOptions, type Vocabulary, } from './vocabulary.ts';
export { createSearch, search, compareHits, rerank, type Hit, type Range, type SearchField, type SearchOptions, type SearchSpec, type Searcher, } from './engine.ts';
export { highlightRanges, highlightQuery, snippet, type HighlightPart, type Snippet, } from './highlight.ts';
export { expandQuery, corrections, didYouMean, type ExpandedWord, type ExpandOptions, } from './expand.ts';
export { typoVariants, typoCases, evaluate, type TypoKind, type EvalCase, type EvalReport, } from './evaluate.ts';
