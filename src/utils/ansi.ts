import { AnsiUp } from 'ansi_up'

// Singleton instance with CSS class mode (avoids inline styles)
const ansiUp = new AnsiUp()
ansiUp.use_classes = true

/**
 * Convert ANSI escape codes in terminal content to HTML with CSS classes.
 * Terminal parser already calls stripAnsi() before parsing, so prompt
 * detection is unaffected by the ANSI codes.
 */
export function ansiToHtml(content: string): string {
  return ansiUp.ansi_to_html(content)
}
