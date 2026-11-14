/**
 * Parses natural-language reminder time expressions into ISO timestamps.
 * Returns an ISO string on success, or null if the expression cannot be parsed.
 *
 * Supports:
 *   - Relative: "in 30 minutes", "in 2 hours", "in 3 days"
 *   - Named: "tomorrow", "next week", "next month"
 *   - ISO/date strings: passed through as-is if parseable
 */
export function parseReminderDate(when: string): string | null {
  if (!when) {
    return null;
  }
  const now = new Date();
  const lower = when.trim().toLowerCase();

  // "in N unit" pattern
  const inMatch = lower.match(
    /^in\s+(\d+)\s+(minute|minutes|hour|hours|day|days|week|weeks|month|months)$/
  );
  if (inMatch) {
    const n = parseInt(inMatch[1], 10);
    const unit = inMatch[2];
    const result = new Date(now);
    if (unit.startsWith('minute')) {
      result.setMinutes(result.getMinutes() + n);
    } else if (unit.startsWith('hour')) {
      result.setHours(result.getHours() + n);
    } else if (unit.startsWith('day')) {
      result.setDate(result.getDate() + n);
    } else if (unit.startsWith('week')) {
      result.setDate(result.getDate() + n * 7);
    } else if (unit.startsWith('month')) {
      result.setMonth(result.getMonth() + n);
    }
    return result.toISOString();
  }

  // Named shortcuts
  if (lower === 'tomorrow') {
    const result = new Date(now);
    result.setDate(result.getDate() + 1);
    result.setHours(9, 0, 0, 0);
    return result.toISOString();
  }
  if (lower === 'next week') {
    const result = new Date(now);
    result.setDate(result.getDate() + 7);
    result.setHours(9, 0, 0, 0);
    return result.toISOString();
  }
  if (lower === 'next month') {
    const result = new Date(now);
    result.setMonth(result.getMonth() + 1);
    result.setDate(1);
    result.setHours(9, 0, 0, 0);
    return result.toISOString();
  }

  // Try parsing as a date string directly
  const parsed = new Date(when);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return null;
}
