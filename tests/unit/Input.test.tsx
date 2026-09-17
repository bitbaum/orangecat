// @vitest-environment jsdom
/**
 * Input Component Tests — behavior, not class strings.
 *
 * Same story as Button: the earlier suite asserted "border-border-strong
 * shadow-sm rounded-md" type strings that the design system has since
 * changed. Rewritten 2026-06-03 to test what users care about.
 */

import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Input from '@/components/ui/Input';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="email" />);
    expect(screen.getByPlaceholderText('email')).toBeInTheDocument();
  });

  it('passes className through', () => {
    render(<Input className="my-class" placeholder="x" />);
    expect(screen.getByPlaceholderText('x')).toHaveClass('my-class');
  });

  it('reflects the type prop', () => {
    render(<Input type="email" placeholder="email" />);
    expect(screen.getByPlaceholderText('email')).toHaveAttribute('type', 'email');
  });

  it('fires onChange and reflects the typed value', () => {
    function Wrapper() {
      const [v, setV] = useState('');
      return <Input placeholder="x" value={v} onChange={e => setV(e.target.value)} />;
    }
    render(<Wrapper />);
    const input = screen.getByPlaceholderText('x');
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(input).toHaveValue('hello');
  });

  it('reflects disabled', () => {
    render(<Input disabled placeholder="x" />);
    expect(screen.getByPlaceholderText('x')).toBeDisabled();
  });

  it('reflects required', () => {
    render(<Input required placeholder="x" />);
    expect(screen.getByPlaceholderText('x')).toBeRequired();
  });

  it('reflects readOnly', () => {
    render(<Input readOnly value="locked" placeholder="x" />);
    expect(screen.getByPlaceholderText('x')).toHaveAttribute('readonly');
  });

  it('forwards refs to the underlying input element', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} placeholder="x" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('renders an error message when provided', () => {
    render(<Input placeholder="x" error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('forwards aria attributes for accessibility', () => {
    render(<Input placeholder="x" aria-label="email address" />);
    expect(screen.getByLabelText('email address')).toBeInTheDocument();
  });
});
