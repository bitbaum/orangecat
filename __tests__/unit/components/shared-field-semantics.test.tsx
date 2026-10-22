// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import Textarea from '@/components/ui/Textarea';

afterEach(cleanup);
it('enforces a required textarea as well as displaying its marker', () => {
  render(<Textarea label="Description" required />);
  const field = screen.getByRole('textbox', { name: /Description/ });
  expect(field).toBeRequired();
  expect((field as HTMLTextAreaElement).checkValidity()).toBe(false);
});
