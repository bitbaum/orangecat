# Mobile-First Posting System - Status & Next Steps

created_date: 2025-11-16
last_modified_date: 2025-12-11
last_modified_summary: Simplified composer defaults and enabled nested replies via parent_event_id

**Date:** 2025-11-16
**PRD:** `mobile-first-posting-system.md`
**Related:** `POST_DESIGN_IMPROVEMENTS.md` (completed)

---

## Recent Updates (2025-12-11)
- Composer defaults to a minimal, single-action experience with quick audience presets (public/followers/only me).
- Replies now use `parent_event_id` with nested rendering for thread view (no separate comments table in UI).

## Current Status: Week 1 ✅ Complete + Partial Week 2

### Week 1: Foundation ✅ COMPLETE

#### ✅ 1.1 Replace Complex State Management

**Status:** COMPLETE
**Files Created:**

- `src/hooks/usePostComposerNew.ts` ✅ (434 lines)
  - Simple useState-based state (no complex reducer)
  - Draft auto-save with localStorage
  - Retry logic with exponential backoff
  - Optimistic updates
  - Offline support via navigator.onLine
  - Profile existence caching
  - Cross-posting to multiple projects

**Features Implemented:**

- ✅ Debounced draft saving (300ms)
- ✅ Draft recovery on mount (24hr TTL)
- ✅ Character count with validation
- ✅ Retry attempts (max 3) with exponential backoff
- ✅ Optimistic event creation for instant UI feedback
- ✅ Cross-posting to user-selected projects
- ✅ Memory leak prevention (cleanup timers on unmount)

#### ✅ 1.2 Fix React Hooks Rule Violations

**Status:** COMPLETE
**Files Modified:**

- `src/components/timeline/SocialTimeline.tsx` - Hooks moved before early returns

#### ✅ 1.3 Implement Error Boundaries

**Status:** COMPLETE
**Files Created:**

- `src/components/timeline/PostingErrorBoundary.tsx` ✅ (217 lines)
  - Network status detection (online/offline)
  - Retry UI with max 3 attempts
  - Reset functionality
  - Development mode debug info
  - Hook version: `usePostingErrorHandler()`
  - HOC: `withPostingErrorBoundary()`

---

### Week 2: Mobile-First UX 🔄 PARTIAL

#### ✅ 2.1 Touch-Optimized Components (PARTIAL)

**Status:** Component created, needs full mobile UX pass
**Files Created:**

- `src/components/timeline/PostComposerMobile.tsx` ✅ (100+ lines partial)
  - Auto-resize textarea (max 120px)
  - Keyboard shortcuts (Ctrl+Enter, Escape)
  - Avatar display
  - Compact mode support

**Still Needed:**

- ⏳ 44px minimum touch targets (currently unknown)
- ⏳ Bottom sheet for options (referenced but not fully implemented)
- ⏳ Swipe gestures support
- ⏳ Mobile keyboard handling improvements
- ⏳ Haptic feedback (iOS)

#### ⏳ 2.2 Progressive Disclosure (NOT STARTED)

**Current:** All options visible
**Needed:**

- Collapsible secondary options
- Smart UI hierarchy
- Bottom sheet for advanced settings

#### ⏳ 2.3 Contextual Intelligence (NOT STARTED)

**Needed:**

- Smart project suggestions based on content
- Auto-categorization
- Recent projects prioritization
- Content-based recommendations

---

### Week 3: Robustness & Reliability ⏳ NOT STARTED

#### Partial Progress:

- ✅ Error boundaries (from Week 1.3)
- ✅ Retry logic (from Week 1.1)
- ✅ Draft management (from Week 1.1)

#### Still Needed:

- ⏳ Comprehensive error type handling:
  - Network failures (timeout, 5xx)
  - Validation errors
  - Authentication errors
  - Service unavailable
- ⏳ Offline queue service
- ⏳ Conflict resolution on reconnect

---

### Week 4: Performance & Polish ⏳ NOT STARTED

#### Needed:

- ⏳ Performance metrics tracking
- ⏳ Bundle size analysis
- ⏳ Accessibility audit (WCAG 2.1 AA)
- ⏳ Analytics integration
- ⏳ User testing

---

## Next Steps Priority List

### 🔴 HIGH PRIORITY (Week 2 Completion)

1. **Complete PostComposerMobile touch optimization**
   - Audit all interactive elements for 44px minimum
   - Implement bottom sheet component for options
   - Add haptic feedback for iOS
   - Test on physical mobile devices

2. **Implement progressive disclosure UI**
   - Primary actions always visible
   - Secondary options in expandable panel
   - Bottom sheet for project selection
   - Visibility toggle prominent but not intrusive

3. **Add contextual intelligence**
   - Content analysis for project suggestions
   - Recent projects (last 5) shown first
   - Smart defaults based on posting context

### 🟡 MEDIUM PRIORITY (Week 3)

4. **Comprehensive error handling**
   - Error type enum with recovery strategies
   - Specific error messages per type
   - Network timeout handling
   - Auth session expiry handling

5. **Offline queue service**

   ```typescript
   class OfflineQueue {
     static enqueue(post: PostAction): void;
     static process(): Promise<void>;
     static getStatus(): QueueStatus;
   }
   ```

6. **Draft conflict resolution**
   - Multi-device draft sync detection
   - User choice on conflicts
   - Last-write-wins with confirmation

### 🟢 LOW PRIORITY (Week 4)

7. **Performance optimization**
   - Code splitting for large components
   - Virtual scrolling for project lists
   - Bundle size reduction

8. **Accessibility compliance**
   - Full keyboard navigation audit
   - Screen reader testing
   - Color contrast verification
   - ARIA labels review

9. **Analytics & monitoring**
   - Post success/failure rates
   - Time-to-post metrics
   - Error frequency tracking
   - User interaction patterns

---

## Implementation Gaps

### What's Working Well ✅

- State management is clean and simple
- Error boundaries catch crashes
- Draft saving prevents data loss
- Retry logic handles transient failures
- Optimistic updates feel instant

### What Needs Work ⚠️

1. **Mobile UX Polish**
   - Touch target sizes not verified
   - No bottom sheet component yet
   - Missing haptic feedback
   - Keyboard behavior not fully tested

2. **Progressive Disclosure**
   - All options shown at once
   - No smart defaults
   - No contextual suggestions

3. **Offline Support**
   - Basic detection exists (navigator.onLine)
   - No persistent queue
   - No sync on reconnect

4. **Performance**
   - Bundle size not measured
   - No performance metrics
   - No code splitting

5. **Accessibility**
   - Not tested with screen readers
   - Keyboard nav not fully verified
   - Color contrast not audited

---

## Proposed Task Breakdown (Next Sprint)

### Sprint 1: Complete Mobile UX (1 week)

**Day 1-2: Touch Optimization**

- [ ] Audit all buttons/inputs for 44px minimum
- [ ] Create reusable BottomSheet component
- [ ] Implement swipe-to-dismiss gestures
- [ ] Add haptic feedback hook for iOS

**Day 3-4: Progressive Disclosure**

- [ ] Redesign composer with collapsible options
- [ ] Move project selection to bottom sheet
- [ ] Smart visibility toggle (prominent but not intrusive)
- [ ] Context-aware defaults

**Day 5: Testing & Polish**

- [ ] Test on iPhone (various models)
- [ ] Test on Android (various models)
- [ ] Fix keyboard overlap issues
- [ ] Smooth animations

### Sprint 2: Robustness (1 week)

**Day 1-2: Error Handling**

- [ ] Error type enum with recovery strategies
- [ ] Specific error messages per scenario
- [ ] Toast notifications for errors
- [ ] Better network failure handling

**Day 3-4: Offline Queue**

- [ ] Implement OfflineQueue service
- [ ] Persistent storage (IndexedDB)
- [ ] Auto-process on reconnect
- [ ] Conflict resolution UI

**Day 5: Testing**

- [ ] Test offline scenarios
- [ ] Test network interruptions
- [ ] Test multi-device conflicts

### Sprint 3: Performance & Polish (1 week)

**Day 1-2: Performance**

- [ ] Bundle size analysis
- [ ] Code splitting for composer
- [ ] Lazy load project lists
- [ ] Measure time-to-interactive

**Day 3-4: Accessibility**

- [ ] Keyboard navigation audit
- [ ] Screen reader testing
- [ ] Color contrast fixes
- [ ] ARIA labels

**Day 5: Launch Prep**

- [ ] Analytics integration
- [ ] User testing session
- [ ] Documentation update
- [ ] Deploy to production

---

## Files to Review

### Active Files (Keep)

- ✅ `src/hooks/usePostComposerNew.ts` - Main hook
- ✅ `src/components/timeline/PostComposerMobile.tsx` - Mobile component
- ✅ `src/components/timeline/PostingErrorBoundary.tsx` - Error boundary
- ✅ `docs/features/posting/mobile-first-posting-system.md` - PRD
- ✅ `docs/features/posting/POST_DESIGN_IMPROVEMENTS.md` - Completed design work

### Legacy Files (Archive?)

- ⚠️ `src/hooks/usePostComposer.ts` - Old complex reducer version
  - **Action:** Keep for now as fallback, mark as deprecated
- ⚠️ `src/components/timeline/TimelineComposer.tsx` - Desktop version
  - **Action:** Keep, but should use new hook
- ⚠️ `src/components/timeline/TwitterTimeline.tsx` - Deleted?
  - **Action:** Verify deletion

---

## Success Criteria

### Week 2 Complete

- [ ] All touch targets ≥ 44px
- [ ] Bottom sheet working for options
- [ ] Progressive disclosure implemented
- [ ] Smart project suggestions working
- [ ] Tested on 3+ mobile devices

### Week 3 Complete

- [ ] Comprehensive error handling
- [ ] Offline queue working
- [ ] Draft conflicts resolved automatically
- [ ] 99%+ error recovery rate

### Week 4 Complete

- [ ] Bundle size < 50kb
- [ ] Lighthouse score > 95
- [ ] WCAG 2.1 AA compliant
- [ ] Analytics tracking active
- [ ] User satisfaction > 4.5/5

---

## Open Questions

1. **Should we keep old `usePostComposer.ts`?**
   - Pros: Fallback if new hook has issues
   - Cons: Tech debt, confusion
   - **Recommendation:** Keep for 1 sprint, then archive

2. **Which components should use PostComposerMobile?**
   - Journey page inline composer
   - Community page modal
   - Project timeline posting
   - **Recommendation:** All of the above

3. **Do we need desktop-specific version?**
   - PostComposerMobile has responsive design
   - Works on desktop with keyboard shortcuts
   - **Recommendation:** Mobile-first for all, no separate desktop version

4. **Analytics - what to track?**
   - Post success/failure rate
   - Time from open to post
   - Retry frequency
   - Draft recovery usage
   - **Recommendation:** All of the above + more

---

## Risk Assessment

### Low Risk ✅

- State management refactor (already done, working)
- Error boundaries (done, no issues)
- Draft saving (done, tested)

### Medium Risk ⚠️

- Mobile UX changes (need testing on real devices)
- Bottom sheet implementation (new component)
- Offline queue (complex edge cases)

### High Risk 🔴

- Multi-device draft conflicts (hard to test)
- Network edge cases (flaky connections)
- Accessibility (requires specialized testing)

---

## Recommendations

1. **Execute Sprint 1 (Mobile UX) immediately**
   - Biggest user impact
   - Completes Week 2 of PRD
   - Sets foundation for Weeks 3-4

2. **Defer analytics until Sprint 3**
   - Not blocking for users
   - Can add incrementally

3. **Archive old docs during Sprint 1**
   - Reduces confusion
   - Clean slate for new features

4. **User testing after Sprint 1**
   - Validate mobile UX
   - Catch issues early
   - Iterate before performance pass

---

**Next Action:** Start Sprint 1 Day 1 - Touch target audit
