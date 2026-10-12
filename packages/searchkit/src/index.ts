export { fold, tokenize, words, umlautSpelling, joinedPairs, type Token } from './normalize';
export { editDistance, prefixDistance } from './distance';
export { typoBudget, DEFAULT_TYPO_POLICY, type TypoPolicy } from './typo';
export {
  createVocabulary,
  candidates,
  type Candidate,
  type CandidateOptions,
  type Vocabulary,
} from './vocabulary';
export {
  createSearch,
  search,
  compareHits,
  rerank,
  type Hit,
  type Range,
  type SearchField,
  type SearchOptions,
  type SearchSpec,
  type Searcher,
} from './engine';
export {
  highlightRanges,
  highlightQuery,
  snippet,
  type HighlightPart,
  type Snippet,
} from './highlight';
export {
  expandQuery,
  corrections,
  didYouMean,
  type ExpandedWord,
  type ExpandOptions,
} from './expand';
export {
  typoVariants,
  typoCases,
  evaluate,
  type TypoKind,
  type EvalCase,
  type EvalReport,
} from './evaluate';
