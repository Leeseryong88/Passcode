
import { useState, useCallback } from 'react';

type CopyFn = (text: string) => Promise<boolean>;

function useCopyToClipboard(): [boolean, CopyFn] {
  const [copied, setCopied] = useState(false);

  const copy: CopyFn = useCallback(async (text) => {
    if (!navigator?.clipboard) {
      console.warn('Clipboard not supported');
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
      return true;
    } catch (error) {
      console.warn('Copy failed', error);
      setCopied(false);
      return false;
    }
  }, []);

  return [copied, copy];
}

export default useCopyToClipboard;
