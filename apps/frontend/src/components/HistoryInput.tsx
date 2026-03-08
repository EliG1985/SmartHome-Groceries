import { useEffect, useId, useState } from 'react';

interface HistoryInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string | number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  historyKey: string;
  maxEntries?: number;
}

const STORAGE_PREFIX = 'fieldHistory:';

function readHistory(historyKey: string): string[] {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${historyKey}`);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(historyKey: string, entries: string[]) {
  localStorage.setItem(`${STORAGE_PREFIX}${historyKey}`, JSON.stringify(entries));
}

export function HistoryInput({ value, onChange, historyKey, maxEntries = 8, onBlur, ...props }: HistoryInputProps) {
  const [history, setHistory] = useState<string[]>([]);
  const listId = useId();

  useEffect(() => {
    setHistory(readHistory(historyKey));
  }, [historyKey]);

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const trimmed = event.currentTarget.value.trim();
    if (trimmed) {
      const next = [trimmed, ...history.filter((entry) => entry !== trimmed)].slice(0, maxEntries);
      setHistory(next);
      writeHistory(historyKey, next);
    }

    if (onBlur) onBlur(event);
  };

  return (
    <>
      <input {...props} value={value} onChange={onChange} onBlur={handleBlur} list={listId} />
      <datalist id={listId}>
        {history.map((entry) => (
          <option key={entry} value={entry} />
        ))}
      </datalist>
    </>
  );
}
