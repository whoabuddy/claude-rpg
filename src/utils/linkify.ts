/**
 * Linkify URLs and file paths in HTML content from terminal output.
 *
 * Runs AFTER ansiToHtml so it processes HTML strings. Must avoid
 * matching inside HTML tags or attributes (e.g., <span class="...">) .
 */

// Match URLs: http(s)://... up to a typical URL boundary
const URL_RE = /https?:\/\/[^\s<>"'`)\]]+/g

// Match absolute file paths: /home/... or /tmp/... etc.
// Followed by optional :line:col
const FILE_PATH_RE = /(?<![<"'=\w])\/(?:home|tmp|usr|var|etc|opt|srv|dev|Users|mnt|media)\/[^\s<>"'`)\]:]+(?::\d+(?::\d+)?)?/g

/**
 * Wrap URLs and file paths in anchor tags for click handling.
 * Links get data attributes for programmatic handling rather than href,
 * since terminal file paths aren't real URLs.
 */
export function linkifyTerminalHtml(html: string): string {
  if (!html) return html

  // Process URL matches first, then file paths
  // We need to avoid double-linkifying, so track replaced ranges.
  // Strategy: split HTML into "inside tag" and "outside tag" segments,
  // only linkify the "outside tag" (text content) segments.

  const parts: string[] = []
  let lastIndex = 0

  // Split by HTML tags — only linkify text between tags
  const tagRe = /<[^>]+>/g
  let tagMatch: RegExpExecArray | null

  while ((tagMatch = tagRe.exec(html)) !== null) {
    // Text segment before this tag
    const textSegment = html.slice(lastIndex, tagMatch.index)
    if (textSegment) {
      parts.push(linkifyText(textSegment))
    }
    // The tag itself (pass through unchanged)
    parts.push(tagMatch[0])
    lastIndex = tagMatch.index + tagMatch[0].length
  }

  // Remaining text after last tag
  const remaining = html.slice(lastIndex)
  if (remaining) {
    parts.push(linkifyText(remaining))
  }

  return parts.join('')
}

function linkifyText(text: string): string {
  // Apply URL linkification first, then file paths on non-URL segments
  let result = text.replace(URL_RE, match =>
    `<a class="terminal-link" data-href="${escapeAttr(match)}" data-type="url" title="Ctrl+Click to open">${match}</a>`
  )

  // Only apply file path regex to segments not already inside an <a> tag
  result = replaceOutsideAnchors(result, FILE_PATH_RE, match =>
    `<a class="terminal-link" data-href="${escapeAttr(match)}" data-type="file" title="Ctrl+Click to open">${match}</a>`
  )

  return result
}

function replaceOutsideAnchors(html: string, re: RegExp, replacer: (match: string) => string): string {
  const parts: string[] = []
  let lastIndex = 0

  // Split by existing <a>...</a> tags
  const anchorRe = /<a[^>]*>.*?<\/a>/g
  let anchorMatch: RegExpExecArray | null

  while ((anchorMatch = anchorRe.exec(html)) !== null) {
    // Text before this anchor — apply regex
    const before = html.slice(lastIndex, anchorMatch.index)
    if (before) {
      parts.push(before.replace(re, replacer))
    }
    // The anchor itself (pass through unchanged)
    parts.push(anchorMatch[0])
    lastIndex = anchorMatch.index + anchorMatch[0].length
  }

  // Remaining text after last anchor
  const remaining = html.slice(lastIndex)
  if (remaining) {
    parts.push(remaining.replace(re, replacer))
  }

  return parts.join('')
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}
