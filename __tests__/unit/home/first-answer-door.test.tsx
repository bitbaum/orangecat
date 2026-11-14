// @vitest-environment jsdom
/**
 * The home page's Cat door: one real answer to the visitor's own sentence,
 * then the invitation that carries the sentence through sign-up. What was
 * typed is never lost, answer or no answer.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/components/ai-chat/ModernChatPanel/components/ChatInput', () => ({
  ChatInput: ({
    value,
    onChange,
    onSend,
    ariaLabel,
    sendLabel,
  }: {
    value: string;
    onChange: (v: string) => void;
    onSend: () => unknown;
    ariaLabel: string;
    sendLabel: string;
  }) => (
    <div>
      <input aria-label={ariaLabel} value={value} onChange={e => onChange(e.target.value)} />
      <button type="button" onClick={() => onSend()}>
        {sendLabel}
      </button>
    </div>
  ),
}));
vi.mock('@/hooks/useDictation', () => ({ CHAT_VOICE: {} }));

import { FirstAnswerDoor, firstSentenceProblem } from '@/components/home/sections/FirstAnswerDoor';
import { API_ROUTES } from '@/config/api-routes';
import { CAT_DOOR, registerHrefKeepingSentence } from '@/config/cat-door';
import { HOME_FIRST_ANSWER_COPY as COPY } from '@/config/landing-page';

const fetchMock = vi.fn();
const sentence = 'I bake sourdough and want to sell it';

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function askTyped() {
  render(<FirstAnswerDoor examples={['Sell my old bike']} />);
  await userEvent.type(screen.getByLabelText(CAT_DOOR.prompt), sentence);
  await userEvent.click(screen.getByRole('button', { name: CAT_DOOR.submit }));
}

function expectInvitationKeeps(kept: string) {
  expect(screen.getByRole('link', { name: COPY.invite })).toHaveAttribute(
    'href',
    registerHrefKeepingSentence(kept)
  );
}

describe('FirstAnswerDoor', () => {
  it('holds a sentence to the bounds every Cat door has', () => {
    expect(firstSentenceProblem('a')).toMatch(/at least/);
    expect(firstSentenceProblem('x'.repeat(CAT_DOOR.maxLength + 1))).toMatch(/or fewer/);
    expect(firstSentenceProblem(sentence)).toBeNull();
  });

  it('gives one real answer, then the invitation that keeps the sentence', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { answer: 'That is a Product.' } }),
    });
    await askTyped();
    expect(await screen.findByText('That is a Product.')).toBeInTheDocument();
    expect(screen.getByText(sentence)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(API_ROUTES.CAT.FIRST_ANSWER);
    expect(JSON.parse(init.body)).toEqual({ sentence });
    expectInvitationKeeps(sentence);
    // One answer: the box is gone, so there is no second question here.
    expect(screen.queryByLabelText(CAT_DOOR.prompt)).not.toBeInTheDocument();
  });

  it('asks an example in place instead of sending the visitor to a sign-up form', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { answer: 'A Product fits.' } }),
    });
    render(<FirstAnswerDoor examples={['Sell my old bike']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sell my old bike' }));
    expect(await screen.findByText('A Product fits.')).toBeInTheDocument();
    expectInvitationKeeps('Sell my old bike');
  });

  it('keeps the sentence when the visitor budget is spent', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    await askTyped();
    expect(await screen.findByText(COPY.limitReached)).toBeInTheDocument();
    expectInvitationKeeps(sentence);
  });

  it('keeps the sentence when no answer can be given', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await askTyped();
    expect(await screen.findByText(COPY.noAnswer)).toBeInTheDocument();
    expectInvitationKeeps(sentence);
  });

  it('does not send a sentence too short to mean anything', async () => {
    render(<FirstAnswerDoor />);
    await userEvent.type(screen.getByLabelText(CAT_DOOR.prompt), 'a');
    await userEvent.click(screen.getByRole('button', { name: CAT_DOOR.submit }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
