/**
 * DOCUMENT DETAIL PAGE
 *
 * Shows a single document's content with edit/delete actions.
 * Documents provide personal context for My Cat AI assistant.
 *
 * Created: 2026-01-20
 * Last Modified: 2026-01-20
 * Last Modified Summary: Initial document detail page
 */

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ROUTES } from '@/config/routes';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, FileText, Eye, EyeOff, Globe } from 'lucide-react';
import {
  DOCUMENT_TYPE_LABELS,
  VISIBILITY_LABELS,
  DOCUMENT_TYPE_ICONS,
} from '@/config/entities/documents';
import type { DocumentType, DocumentVisibility } from '@/lib/validation';
import { DeleteDocumentButton } from './DeleteDocumentButton';
import { APP_LOCALE } from '@/utils/locale';
import { getUserActorId } from '@/domain/actors';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Document {
  id: string;
  actor_id: string;
  title: string;
  content: string | null;
  document_type: DocumentType;
  visibility: DocumentVisibility;
  tags: string[];
  summary: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get visibility icon based on visibility level
 */
function getVisibilityIcon(visibility: DocumentVisibility) {
  switch (visibility) {
    case 'private':
      return <EyeOff className="h-4 w-4" />;
    case 'cat_visible':
      return <Eye className="h-4 w-4" />;
    case 'public':
      return <Globe className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

/**
 * Get visibility badge variant
 */
function getVisibilityVariant(visibility: DocumentVisibility): 'default' | 'secondary' | 'outline' {
  switch (visibility) {
    case 'private':
      return 'secondary';
    case 'cat_visible':
      return 'default';
    case 'public':
      return 'outline';
    default:
      return 'secondary';
  }
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerClient();

  // Check authentication
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    redirect('/auth?mode=login&from=/dashboard/cat?tab=context');
  }

  // Get user's actor
  const ownActorId = await getUserActorId(supabase, user.id);

  if (!ownActorId) {
    notFound();
  }
  const actorData = { id: ownActorId };

  const actor = actorData as { id: string };

  // Get the document
  const { data: document, error } = await supabase
    .from(DATABASE_TABLES.USER_DOCUMENTS)
    .select('*')
    .eq('id', id)
    .eq('actor_id', actor.id)
    .single();

  if (error || !document) {
    notFound();
  }

  const doc = document as Document;

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Back link */}
      <Link
        href={`${ROUTES.DASHBOARD.CAT}?tab=context`}
        className="inline-flex items-center gap-2 text-sm text-fg-secondary hover:text-fg-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Context
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">
              {DOCUMENT_TYPE_ICONS[doc.document_type]} {DOCUMENT_TYPE_LABELS[doc.document_type]}
            </Badge>
            <Badge
              variant={getVisibilityVariant(doc.visibility)}
              className="flex items-center gap-1"
            >
              {getVisibilityIcon(doc.visibility)}
              {VISIBILITY_LABELS[doc.visibility]}
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">{doc.title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`${ROUTES.DASHBOARD.DOCUMENTS_CREATE}?edit=${id}`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <DeleteDocumentButton documentId={id} documentTitle={doc.title} />
        </div>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Content</CardTitle>
        </CardHeader>
        <CardContent>
          {doc.content ? (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">{doc.content}</div>
          ) : (
            <p className="text-fg-secondary italic">No content</p>
          )}
        </CardContent>
      </Card>

      {/* Tags */}
      {doc.tags && doc.tags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {doc.tags.map((tag, index) => (
                <Badge key={index} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-fg-secondary">Created</dt>
              <dd className="font-medium mt-1">
                {new Date(doc.created_at).toLocaleDateString(APP_LOCALE, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </dd>
            </div>
            <div>
              <dt className="text-fg-secondary">Last Updated</dt>
              <dd className="font-medium mt-1">
                {new Date(doc.updated_at).toLocaleDateString(APP_LOCALE, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Help text */}
      {doc.visibility === 'cat_visible' && (
        <div className="rounded-md border border-subtle bg-surface-raised/30 p-4 text-sm text-fg-secondary">
          <p>
            <strong>Your Cat can see this document.</strong> This context helps your Cat give you
            personalized advice based on your{' '}
            {DOCUMENT_TYPE_LABELS[doc.document_type].toLowerCase()}.
          </p>
        </div>
      )}

      {doc.visibility === 'private' && (
        <div className="rounded-md border border-subtle bg-surface-raised p-4 text-sm text-fg-secondary">
          <p>
            <strong>This document is private.</strong> Only you can see it. Change the visibility to
            "Cat Only" if you want your Cat to use this as context for advice.
          </p>
        </div>
      )}
    </div>
  );
}
