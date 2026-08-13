'use client';

/**
 * Collaborate — the open-roles board.
 *
 * Browse open collaborator roles across projects, post roles on your own
 * projects, and reach out via DM ("I'm interested"). The one genuinely-new
 * collaboration primitive (project_roles), distinct from /jobs (group proposals).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Handshake, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { API_ROUTES } from '@/config/api-routes';
import { ROUTES } from '@/config/routes';
import { ENGAGEMENT_TYPES, ENGAGEMENT_LABELS, type EngagementType } from '@/config/project-roles';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { authLoginPath } from '@/lib/navigation/safe-return-path';

interface Role {
  id: string;
  project_id: string;
  role_title: string;
  skills: string[];
  engagement_type: EngagementType;
  description: string | null;
  status: string;
  created_at: string;
  projects?: { id: string; title: string; user_id: string; status: string } | null;
}

interface MyProject {
  id: string;
  title: string;
}

export default function CollaboratePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [myProjects, setMyProjects] = useState<MyProject[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const [projectId, setProjectId] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [skills, setSkills] = useState('');
  const [engagement, setEngagement] = useState<EngagementType>('contribution');
  const [description, setDescription] = useState('');

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_ROUTES.PROJECT_ROLES.BASE);
      const json = await res.json();
      setRoles(json?.data?.roles ?? []);
    } catch (err) {
      logger.error('Failed to load roles', err, 'Collaborate');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // load the current user's projects for the "post a role" selector
  useEffect(() => {
    if (!user?.id) {
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_ROUTES.PROJECTS.BASE}?user_id=${user.id}`);
        const json = await res.json();
        const list = (json?.data ?? json?.data?.projects ?? json?.projects ?? []) as MyProject[];
        const projects = Array.isArray(list) ? list : [];
        setMyProjects(projects);
        if (projects[0]) {
          setProjectId(projects[0].id);
        }
      } catch (err) {
        logger.error('Failed to load my projects', err, 'Collaborate');
      }
    })();
  }, [user?.id]);

  const submitRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !roleTitle.trim()) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(API_ROUTES.PROJECT_ROLES.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          role_title: roleTitle.trim(),
          skills: skills
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
          engagement_type: engagement,
          description: description.trim() || null,
        }),
      });
      if (res.ok) {
        setRoleTitle('');
        setSkills('');
        setDescription('');
        setShowForm(false);
        await loadRoles();
      }
    } catch (err) {
      logger.error('Failed to post role', err, 'Collaborate');
    } finally {
      setSubmitting(false);
    }
  };

  const expressInterest = async (role: Role) => {
    if (!user) {
      toast.info('Sign in to contact this project');
      router.push(authLoginPath(ROUTES.COLLABORATE));
      return;
    }

    const ownerId = role.projects?.user_id;
    if (!ownerId) {
      return;
    }
    try {
      const res = await fetch(API_ROUTES.MESSAGES.OPEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantIds: [ownerId],
          title: `Re: ${role.role_title}`,
        }),
      });
      const json = await res.json();
      const convId = json?.data?.conversationId;
      router.push(convId ? `${ROUTES.MESSAGES}/${convId}` : ROUTES.MESSAGES);
    } catch (err) {
      logger.error('Failed to open conversation', err, 'Collaborate');
    }
  };

  return (
    <div className="oc-page">
      <div className="oc-page-container oc-page-stack max-w-shell pb-20 sm:pb-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-fg-primary">
              <Handshake className="h-6 w-6 text-accent-warm" />
              Collaborate
            </h1>
            <p className="mt-1 text-sm text-fg-secondary">
              Open roles on projects looking for collaborators
            </p>
          </div>
          {myProjects.length > 0 && (
            <Button variant="accent" onClick={() => setShowForm(v => !v)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Post a role
            </Button>
          )}
        </header>

        {showForm && (
          <Card className="oc-surface-padding">
            <form onSubmit={submitRole} className="space-y-3">
              <select
                className="w-full rounded-btn border border-border-default bg-surface-base px-3 py-2 text-sm"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
              >
                {myProjects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-btn border border-border-default bg-surface-base px-3 py-2 text-sm"
                placeholder="Role title (e.g. Backend developer)"
                value={roleTitle}
                onChange={e => setRoleTitle(e.target.value)}
                maxLength={100}
              />
              <input
                className="w-full rounded-btn border border-border-default bg-surface-base px-3 py-2 text-sm"
                placeholder="Skills, comma-separated (e.g. TypeScript, Postgres)"
                value={skills}
                onChange={e => setSkills(e.target.value)}
              />
              <select
                className="w-full rounded-btn border border-border-default bg-surface-base px-3 py-2 text-sm"
                value={engagement}
                onChange={e => setEngagement(e.target.value as EngagementType)}
              >
                {ENGAGEMENT_TYPES.map(t => (
                  <option key={t} value={t}>
                    {ENGAGEMENT_LABELS[t]}
                  </option>
                ))}
              </select>
              <textarea
                className="w-full rounded-btn border border-border-default bg-surface-base px-3 py-2 text-sm"
                placeholder="What you're looking for (optional)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                maxLength={1000}
              />
              <Button type="submit" variant="accent" disabled={submitting || !roleTitle.trim()}>
                {submitting ? 'Posting…' : 'Post role'}
              </Button>
            </form>
          </Card>
        )}

        {loading ? (
          <p className="text-sm text-fg-tertiary">Loading roles…</p>
        ) : roles.length === 0 ? (
          <Card className="oc-surface-padding text-center">
            <p className="text-fg-secondary">No open roles yet.</p>
            <p className="mt-1 text-sm text-fg-tertiary">
              {myProjects.length > 0
                ? 'Post one above to find collaborators.'
                : 'Create a project to post collaborator roles.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {roles.map(role => {
              const isOwn = role.projects?.user_id === user?.id;
              return (
                <Card key={role.id} className="oc-surface-padding">
                  <CardContent className="p-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-medium text-fg-primary">{role.role_title}</h3>
                        {role.projects?.title && (
                          <p className="text-sm text-fg-tertiary">on {role.projects.title}</p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-surface-raised px-2.5 py-0.5 text-xs text-fg-secondary">
                        {ENGAGEMENT_LABELS[role.engagement_type] ?? role.engagement_type}
                      </span>
                    </div>
                    {role.description && (
                      <p className="mt-2 text-sm text-fg-secondary">{role.description}</p>
                    )}
                    {role.skills?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {role.skills.map(s => (
                          <span
                            key={s}
                            className="rounded-full border border-border-default px-2 py-0.5 text-xs text-fg-tertiary"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {!isOwn && (
                      <div className="mt-3">
                        <Button variant="outline" size="sm" onClick={() => expressInterest(role)}>
                          I&apos;m interested
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
