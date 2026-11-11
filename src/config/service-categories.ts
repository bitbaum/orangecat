/** The categories a service is filed under. `user_services.category` is NOT NULL. */
export const SERVICE_CATEGORIES = [
  'Art & Illustration',
  'Tattoo & Body Art',
  'Beauty & Wellness',
  'Photography',
  'Video & Film',
  'Music & Audio',
  'Design',
  'Writing & Editing',
  'Consulting',
  'Coaching & Mentoring',
  'Teaching & Tutoring',
  'Development',
  'Marketing',
  'Translation',
  'Legal',
  'Accounting',
  'Other',
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const DEFAULT_SERVICE_CATEGORY: ServiceCategory = 'Other';

/** The category Cat named, matched case-insensitively, else Other. */
export function toServiceCategory(value: unknown): ServiceCategory {
  if (typeof value !== 'string') {
    return DEFAULT_SERVICE_CATEGORY;
  }
  const v = value.trim().toLowerCase();
  return SERVICE_CATEGORIES.find(c => c.toLowerCase() === v) ?? DEFAULT_SERVICE_CATEGORY;
}

/** For a tool description. */
export const SERVICE_CATEGORY_HINT = SERVICE_CATEGORIES.join(', ');
