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
});
