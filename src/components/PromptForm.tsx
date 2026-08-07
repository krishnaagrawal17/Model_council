import { useState } from 'react';

export interface PromptFormProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
}

export function PromptForm({ onSubmit, disabled }: PromptFormProps) {
  const [value, setValue] = useState('');

  return (
    <form
      className="prompt-form"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) return;
        onSubmit(trimmed);
      }}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask the council..."
        disabled={disabled}
      />
      <button className="btn btn-primary" type="submit" disabled={disabled || value.trim() === ''}>
        Convene Council
      </button>
    </form>
  );
}
