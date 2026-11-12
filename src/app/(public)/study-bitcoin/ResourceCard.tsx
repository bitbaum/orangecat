'use client';

import Link from 'next/link';
import { ExternalLink, ArrowRight, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { GRADIENTS } from '@/config/gradients';
import type { Resource } from './config';

interface ResourceCardProps {
  resource: Resource;
  featured?: boolean;
}

export function ResourceCard({ resource, featured = false }: ResourceCardProps) {
  const Icon = resource.icon;
  const externalProps = resource.external ? { target: '_blank', rel: 'noopener noreferrer' } : {};

  if (featured) {
    return (
      <Card
        className={`group oc-card-link duration-200 border border-default ${GRADIENTS.sectionOrangeAmber}`}
      >
        <CardContent className="p-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-bitcoinOrange/15 rounded-lg flex items-center justify-center group-hover:bg-bitcoinOrange/30">
              <Icon className="w-6 h-6 text-bitcoinOrange" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-fg-primary mb-2 group-hover:underline underline-offset-4">
                {resource.title}
              </h3>
              <p className="text-fg-secondary mb-4 leading-relaxed">{resource.description}</p>
              <Link
                href={resource.href}
                className="inline-flex items-center text-fg-primary font-medium underline underline-offset-4 hover:text-fg-secondary"
                {...externalProps}
              >
                Get Started
                {resource.external ? (
                  <ExternalLink className="w-4 h-4 ml-2" />
                ) : (
                  <ArrowRight className="w-4 h-4 ml-2" />
                )}
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group oc-card-link duration-200">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-surface-raised rounded-lg flex items-center justify-center group-hover:bg-bitcoinOrange/15 transition-colors">
            <Icon className="w-5 h-5 text-fg-secondary group-hover:underline underline-offset-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-fg-primary mb-1 group-hover:underline underline-offset-4">
              {resource.title}
            </h3>
            <p className="text-sm text-fg-secondary mb-3 leading-relaxed">{resource.description}</p>
            <Link
              href={resource.href}
              className="inline-flex items-center text-sm text-fg-primary font-medium underline underline-offset-4 hover:text-fg-secondary"
              {...externalProps}
            >
              {resource.type === 'external' ? 'Visit' : 'Read'}
              {resource.external ? (
                <ExternalLink className="w-3 h-3 ml-1" />
              ) : (
                <ChevronRight className="w-3 h-3 ml-1" />
              )}
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
