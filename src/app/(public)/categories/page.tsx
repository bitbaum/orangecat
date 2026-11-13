'use client';

import { categories } from '@/config/categories';
import Link from 'next/link';
import { Palette, Code, GraduationCap, Building2, Heart, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import { PUBLIC_PAGE_WIDTH, PublicPageHeader } from '@/components/layout/PublicPageHeader';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { discoverHref } from '@/services/discover/params';

const iconMap = {
  Palette,
  Code,
  GraduationCap,
  Building2,
  Heart,
};

export default function CategoriesPage() {
  const { session } = useAuth();
  const router = useRouter();

  const handleCreatePage = () => {
    if (session) {
      router.push(ROUTES.CREATE);
    } else {
      router.push(ROUTES.AUTH_REGISTER);
    }
  };

  return (
    <div className="min-h-screen bg-surface-page">
      <div className={PUBLIC_PAGE_WIDTH.wide}>
        <PublicPageHeader
          title="Find Your Community"
          lede="Whether you're a creator, builder, educator, or organization, OrangeCat helps you exchange, fund, lend, invest, and govern—without gatekeepers."
        />

        <div className="grid gap-12">
          {categories.map(category => {
            const Icon = iconMap[category.icon as keyof typeof iconMap] || ArrowRight;
            if (!Icon) {
              return null;
            }
            return (
              <div key={category.id} className="bg-surface-base rounded-lg shadow-sm p-6">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-surface-raised border border-subtle flex items-center justify-center">
                    <Icon className="w-6 h-6 text-fg-secondary" />
                  </div>
                  <div className="ml-4">
                    <h2 className="text-2xl font-semibold text-fg-primary">{category.name}</h2>
                    <p className="text-fg-secondary">{category.description}</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {category.groups.map(group => (
                    <Link
                      key={group.id}
                      href={discoverHref({ q: group.searchTerm })}
                      className="block p-6 bg-surface-raised rounded-lg hover:bg-surface-raised/80 dark:hover:bg-surface-raised/80 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-fg-primary mb-2">{group.name}</h3>
                        <ArrowRight className="w-5 h-5 text-fg-tertiary group-hover:text-fg-primary transition-colors" />
                      </div>
                      <p className="text-fg-secondary text-sm">{group.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <Button variant="accent" size="lg" onClick={handleCreatePage}>
            {session ? 'Start Creating' : 'Get Started'}
          </Button>
          {!session && (
            <p className="mt-4 text-sm text-fg-secondary">
              Already have an account?{' '}
              <Link
                href={ROUTES.AUTH_LOGIN}
                className="text-fg-primary underline underline-offset-4"
              >
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
