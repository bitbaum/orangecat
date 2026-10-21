'use client';
import { useEffect, useState } from 'react';
import {
  creativeDraftSchema,
  type CreativeDraft,
  type CreativeForm,
} from '@/domain/creative/brief';
import { MORNING_SKETCH } from '@/domain/creative/music';
import { IMAGE_PROMPT_LIMITS } from '@/config/images';
import { API_ROUTES } from '@/config/api-routes';
export const EXAMPLE =
  'Light sadness in the morning. Early spring in my hometown, walking to school, in love for the first time. They do not feel the same way.';
type Work = {
  draft: CreativeDraft;
  form: CreativeForm;
  feeling: string;
  style: string;
  source: string;
};

export function useCreativeStudio() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [feeling, setFeeling] = useState('');
  const [form, setForm] = useState<CreativeForm>('music');
  const [style, setStyle] = useState('');
  const [revision, setRevision] = useState('');
  const [work, setWork] = useState<Work | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [image, setImage] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');

  async function create(revise = false) {
    if (busy) {
      return;
    }
    setBusy(true);
    setError('');
    setNeedsLogin(false);
    const snapshot = { feeling, form, style };
    try {
      const response = await fetch(API_ROUTES.AI.CREATIVE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...snapshot,
          revision: revise ? revision : '',
          previous: revise && work ? work.draft.text : '',
          previousScore: revise && work?.form === 'music' ? work.draft.score : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setNeedsLogin(response.status === 401);
        throw new Error(
          result.error?.message || 'Could not create this interpretation. Try again.'
        );
      }
      const draft = creativeDraftSchema.parse(result.data);
      setWork({ ...snapshot, draft, source: 'AI-assisted draft' });
      setImage('');
      setImagePrompt(snapshot.form === 'image' ? draft.text.slice(0, IMAGE_PROMPT_LIMITS.max) : '');
      setRevision('');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not create a draft. Your brief is still here.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function generateImage() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(API_ROUTES.AI.IMAGES_GENERATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Could not generate the image.');
      }
      setImage(result.data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate an image.');
    } finally {
      setBusy(false);
    }
  }

  function audition() {
    setFeeling(EXAMPLE);
    setForm('music');
    setStyle('Soft, spare, bittersweet');
    setError('');
    setImage('');
    setWork({
      feeling: EXAMPLE,
      form: 'music',
      style: 'Soft, spare, bittersweet',
      source: 'Composed example · no AI request',
      draft: {
        title: 'The road before the bell',
        text: 'A hesitant melody over warm minor chords. Space between the notes leaves the feeling unresolved; the last phrase almost returns home.',
        score: MORNING_SKETCH,
      },
    });
  }
  function downloadWork() {
    if (!work) {
      return;
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ ...work, ...(image ? { image } : {}) }, null, 2)], {
        type: 'application/json',
      })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'studio-work.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const canRevise = work && work.form === form && work.feeling === feeling && work.style === style;
  return {
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
  };
}
