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
 * Copies text to clipboard and immediately triggers the sleek copy toast notification.
 */
export async function copyWithToast(text: string, label: string = 'Copied to clipboard'): Promise<void> {
  triggerCopyToast(text, label);
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.warn('Failed to write to clipboard via copyWithToast:', err);
  }
}
