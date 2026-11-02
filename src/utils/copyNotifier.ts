export interface CopyToastDetail {
  id: string;
  label: string;
  snippet: string;
  first20: string;
  fullLength: number;
}

/**
 * Triggers a sleek, bright-colored toast notification displaying
 * the first 20 characters of the copied item.
 */
export function triggerCopyToast(text: string, label: string = 'Copied to clipboard') {
  if (!text) return;
  // Normalize whitespace for readable single-line display of first 20 chars
  const normalized = text.replace(/[\r\n\t]+/g, ' ').trim();
  const first20 = normalized.slice(0, 20);
  const snippet = normalized.length > 20 ? `${first20}…` : first20;

  const detail: CopyToastDetail = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    snippet,
    first20,
    fullLength: text.length,
  };

  window.dispatchEvent(
    new CustomEvent('app-copy-toast', {
      detail,
    })
  );
}

/**
 * Copies text to clipboard with automatic fallback to document.execCommand,
 * ensuring copy works in all browser environments, iframes, and VS Code webviews.
 */
export async function copyWithToast(text: string, label: string = 'Copied to clipboard'): Promise<void> {
  triggerCopyToast(text, label);

  // 1. Primary: modern navigator.clipboard API
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, falling back to execCommand:', err);
    }
  }

  // 2. Reliable Fallback: hidden textarea + document.execCommand('copy')
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!successful) {
      console.warn('document.execCommand copy returned false');
    }
  } catch (fallbackErr) {
    console.error('All clipboard copy methods failed:', fallbackErr);
  }
}
