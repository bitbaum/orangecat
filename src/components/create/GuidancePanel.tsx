'use client';

/**
 * GUIDANCE PANEL COMPONENT
 *
 * Shows contextual guidance for form fields.
 * Displays default content when no field is focused,
 * and field-specific guidance when a field is active.
 *
 * Created: 2025-12-03
 * Last Modified: 2026-08-02
 * Last Modified Summary: Render via shared guidance cards (jscpd dedup with DynamicSidebar)
 */

import { ReactNode } from 'react';
import { GuidanceDefaultCard, GuidanceFallbackCard, GuidanceFieldCard } from './guidance-shared';
import type { GuidanceContent, DefaultGuidance } from './types';

// ==================== PROPS ====================

interface GuidancePanelProps {
  activeField: string | null;
  guidanceContent: Record<string, GuidanceContent>;
  defaultGuidance: DefaultGuidance;
  additionalContent?: ReactNode;
}

// ==================== COMPONENT ====================

export function GuidancePanel({
  activeField,
  guidanceContent,
  defaultGuidance,
  additionalContent,
}: GuidancePanelProps) {
  // Default state: Show intro content
  if (!activeField) {
    return (
      <div className="sticky top-20">
        <GuidanceDefaultCard content={defaultGuidance} />
      </div>
    );
  }

  // Get content for active field
  const content = guidanceContent[activeField];

  // Fallback if field not found
  if (!content) {
    return (
      <div className="sticky top-20">
        <GuidanceFallbackCard />
      </div>
    );
  }

  return (
    <div className="sticky top-20">
      <GuidanceFieldCard content={content}>
        {/* Additional Content (e.g., currency converter) */}
        {additionalContent && (
          <div className="mt-3 pt-3 border-t border-subtle">{additionalContent}</div>
        )}
      </GuidanceFieldCard>
    </div>
  );
}
