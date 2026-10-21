'use client';

import Link from 'next/link';
import { Markdown } from '@bitbaum/chatkit/react';
import Button from '@/components/ui/Button';
import { CREATIVE_FORMS, type CreativeForm } from '@/domain/creative/brief';
import { MusicPlayer } from './MusicPlayer';
import { IMAGE_PROMPT_LIMITS } from '@/config/images';
import { ROUTES } from '@/config/routes';
import { useCreativeStudio, EXAMPLE } from './useCreativeStudio';

export function CreativeStudio() {
  const {
    ready,
    feeling,
    setFeeling,
    form,
    setForm,
    style,
    setStyle,
    revision,
    setRevision,
    work,
    busy,
    error,
    needsLogin,
    image,
    imagePrompt,
    setImagePrompt,
    create,
    generateImage,
    audition,
    downloadWork,
    canRevise,
  } = useCreativeStudio();
  const inputClass =
    'mt-2 w-full rounded-lg border border-default bg-surface-base p-3 text-base text-fg-primary';
  return (
    <section aria-label="Creative Studio" className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      <Link
        href={ROUTES.CREATE}
        className="inline-flex min-h-11 items-center text-sm text-fg-secondary underline underline-offset-4"
      >
        Create on OrangeCat
      </Link>
      <p className="mt-6 font-mono text-xs uppercase tracking-widest text-fg-tertiary">
        The Studio · first sketches
      </p>
      <h1 className="mt-3 max-w-2xl font-heading text-4xl font-semibold tracking-tight sm:text-6xl">
        Start with a feeling.
        <br />
        Find its form.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-fg-secondary">
        A memory, a place, a moment you cannot quite explain. Turn it into something you can hear,
        read or develop together.
      </p>
      <div className="mt-10 grid items-start gap-8 lg:grid-cols-2">
        <form
          onSubmit={e => {
            e.preventDefault();
            void create();
          }}
          className="space-y-6 rounded-2xl border border-default bg-surface-base p-5 sm:p-6"
        >
          <label className="block font-medium">
            What does it feel like?
            <textarea
              className={inputClass}
              rows={6}
              maxLength={2000}
              required
              minLength={3}
              value={feeling}
              onChange={e => setFeeling(e.target.value)}
              placeholder={EXAMPLE}
              disabled={busy}
            />
          </label>
          <fieldset disabled={busy}>
            <legend className="font-medium">Give it a form</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {(Object.keys(CREATIVE_FORMS) as CreativeForm[]).map(key => (
                <label
                  key={key}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm ${form === key ? 'border-interactive bg-surface-raised text-fg-primary' : 'border-default text-fg-secondary'}`}
                >
                  <input
                    type="radio"
                    name="creative-form"
                    value={key}
                    checked={form === key}
                    onChange={() => setForm(key)}
                  />
                  {CREATIVE_FORMS[key].label}
                </label>
              ))}
            </div>
            <p className="mt-3 text-sm text-fg-secondary">{CREATIVE_FORMS[form].detail}.</p>
          </fieldset>
          <label className="block font-medium">
            Style or genre <span className="font-normal text-fg-tertiary">(optional)</span>
            <input
              className={inputClass}
              maxLength={160}
              value={style}
              onChange={e => setStyle(e.target.value)}
              placeholder="Dream pop, spare piano, magical realism…"
              disabled={busy}
            />
          </label>
          <Button
            type="submit"
            className="w-full"
            disabled={!ready || busy || feeling.trim().length < 3}
            isLoading={busy}
          >
            {busy ? 'Creating…' : 'Create an interpretation'}
          </Button>
          <p className="text-sm text-fg-tertiary">
            AI creation needs sign-in. Your brief is sent when you create. Work stays in this tab
            until you download it. No work is posted to your profile.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={audition}
            disabled={!ready || busy}
          >
            Listen to the morning sketch · no sign-in
          </Button>
        </form>
        <section className="min-w-0" aria-label="Your interpretation" aria-busy={busy}>
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-default bg-surface-raised p-4"
            >
              <p>{error}</p>
              {needsLogin && (
                <Link
                  className="inline-flex min-h-11 items-center underline"
                  href={ROUTES.AUTH_LOGIN}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Sign in to create (opens a new tab)
                </Link>
              )}
            </div>
          )}
          {busy && (
            <p role="status" className="mb-4 text-fg-secondary">
              Working on your interpretation…
            </p>
          )}
          {work ? (
            <article className="rounded-2xl border border-default bg-surface-base p-5 sm:p-6">
              <p className="text-xs text-fg-tertiary">
                {work.source} · {CREATIVE_FORMS[work.form].label}
              </p>
              <h2 className="mt-3 font-heading text-2xl font-semibold">{work.draft.title}</h2>
              <div className="mt-5">
                <Markdown text={work.draft.text} />
              </div>
              {work.draft.score && <MusicPlayer draft={work.draft} />}
              {work.form === 'image' && (
                <div className="mt-5 space-y-3">
                  <label className="block font-medium">
                    Image prompt{' '}
                    <textarea
                      className={inputClass}
                      rows={4}
                      maxLength={IMAGE_PROMPT_LIMITS.max}
                      value={imagePrompt}
                      onChange={e => setImagePrompt(e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || imagePrompt.trim().length < IMAGE_PROMPT_LIMITS.min}
                    onClick={() => void generateImage()}
                  >
                    Generate image with my provider credits
                  </Button>
                  <p className="text-sm text-fg-secondary">
                    Images are stored at a public URL. Uses your own image-provider key in{' '}
                    <Link href={ROUTES.SETTINGS_AI} className="underline">
                      AI settings
                    </Link>
                    .
                  </p>
                  {image && (
                    <Markdown
                      text={
                        '```chat_ui\n' +
                        JSON.stringify({
                          type: 'gallery',
                          title: work.draft.title,
                          images: [{ src: image, alt: work.draft.title }],
                        }) +
                        '\n```'
                      }
                    />
                  )}
                </div>
              )}
              <div className="mt-6 border-t border-default pt-5">
                <label className="block font-medium">
                  What would you change?
                  <textarea
                    className={inputClass}
                    rows={2}
                    maxLength={1000}
                    value={revision}
                    onChange={e => setRevision(e.target.value)}
                    placeholder="Less polished. More like a memory. Leave the ending open."
                    disabled={busy || !canRevise}
                  />
                </label>
                {!canRevise && (
                  <p className="mt-2 text-sm text-fg-secondary">
                    The brief changed. Create a new interpretation to work from it.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    disabled={busy || !canRevise || !revision.trim()}
                    onClick={() => void create(true)}
                  >
                    Revise together
                  </Button>
                  <Button type="button" variant="outline" onClick={downloadWork}>
                    Download work + brief
                  </Button>
                </div>
              </div>
            </article>
          ) : (
            <div className="rounded-2xl border border-default p-6 sm:p-8">
              <p className="font-heading text-2xl">One moment. Many possible works.</p>
              <p className="mt-4 leading-relaxed text-fg-secondary">“{EXAMPLE}”</p>
              <p className="mt-6 text-sm text-fg-secondary">
                Begin with a short instrumental sketch, a poem or an opening scene. Keep the feeling
                and try another form. Your notes shape the next version.
              </p>
            </div>
          )}
          <p className="mt-5 text-sm leading-relaxed text-fg-tertiary">
            Music is currently a short synthesized instrumental, with limited timbres. Lyrics are
            text. Film and animation produce treatments; physical paintings and finished productions
            need a human or production service.
          </p>
        </section>
      </div>
    </section>
  );
}
