import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PromptForm } from './PromptForm';

describe('PromptForm', () => {
  it('calls onSubmit with the trimmed prompt', () => {
    const onSubmit = vi.fn();
    render(<PromptForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('Ask the council...'), { target: { value: '  hello  ' } });
    fireEvent.click(screen.getByText('Convene Council'));

    expect(onSubmit).toHaveBeenCalledWith('hello');
  });

  it('does not submit an empty prompt', () => {
    const onSubmit = vi.fn();
    render(<PromptForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('Convene Council'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables both textarea and button when disabled prop is true', () => {
    const onSubmit = vi.fn();
    render(<PromptForm onSubmit={onSubmit} disabled={true} />);

    const textarea = screen.getByPlaceholderText('Ask the council...');
    const button = screen.getByText('Convene Council');

    expect(textarea).toBeDisabled();
    expect(button).toBeDisabled();
  });

  it('does not submit when input contains only whitespace', () => {
    const onSubmit = vi.fn();
    render(<PromptForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('Ask the council...'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Convene Council'));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
