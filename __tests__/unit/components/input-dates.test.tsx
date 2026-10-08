/**
 * Every date field in the app comes through the shared Input. A date is shown
 * in words in the app's own control styling, with the real input still on top;
 * every other type stays the plain input it always was.
 */
import { renderToString } from 'react-dom/server';
import { Input } from '@/components/ui/Input';

describe('Input with a date type', () => {
  it('shows the picked day in words and keeps the real date input', () => {
    const html = renderToString(
      <Input
        label="Counted on"
        type="date"
        value="2026-10-11"
        onChange={() => {}}
        name="asOf"
        required
      />
    );
    expect(html).toMatch(/Sun, Oct 11, 2026|Sun, 11 Oct 2026/);
    expect(html).toMatch(/<input[^>]*type="date"/);
    expect(html).toMatch(/<input[^>]*name="asOf"/);
    expect(html).toMatch(/<input[^>]*required/);
    expect(html).toMatch(/<label[^>]*for="[^"]+"[^>]*>Counted on/);
  });

  it('puts the control styling on the visible box, so it matches the other inputs', () => {
    const html = renderToString(
      <Input type="datetime-local" value="2026-10-11T14:30" onChange={() => {}} className="mine" />
    );
    expect(html).toMatch(/<span class="wk-input [^"]*h-10[^"]*mine"/);
    expect(html).toMatch(/14:30|2:30/);
  });

  it('keeps an error state reachable from the real input', () => {
    const html = renderToString(
      <Input type="date" value="" onChange={() => {}} error="Pick a day" />
    );
    expect(html).toMatch(/<input[^>]*aria-invalid="true"/);
    expect(html).toMatch(/role="alert"[^>]*>Pick a day/);
  });

  it('leaves every other type a plain input', () => {
    const html = renderToString(<Input type="text" value="x" onChange={() => {}} />);
    expect(html).not.toMatch(/wk-input/);
    expect(html).toMatch(/<input[^>]*type="text"/);
  });
});
