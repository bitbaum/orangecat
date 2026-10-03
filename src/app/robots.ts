import { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/config/site-origin';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/settings/',
          '/messages/',
          '/onboarding/',
          '/profile/setup/',
          '/admin/',
        ],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
