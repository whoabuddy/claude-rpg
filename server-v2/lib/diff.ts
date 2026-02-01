/**
 * Line-based diff algorithm for terminal content
 *
 * Generates minimal diff operations to transform old content to new content.
 * Optimized for terminal output where most changes are appended lines.
 */

export type DiffOp =
  | { type: 'keep'; count: number }
  | { type: 'add'; lines: string[] }
  | { type: 'remove'; count: number }

export interface DiffResult {
  ops: DiffOp[]
  estimatedSize: number // Estimated JSON size in bytes
}

/**
 * Generate diff operations to transform oldContent to newContent
 */
export function generateDiff(oldContent: string, newContent: string): DiffResult {
  const oldLines = oldContent ? oldContent.split('\n') : []
  const newLines = newContent ? newContent.split('\n') : []

  const ops: DiffOp[] = []

  // Handle empty cases
  if (oldLines.length === 0 && newLines.length === 0) {
    return { ops: [], estimatedSize: 0 }
  }

  if (oldLines.length === 0) {
    // All new content
    ops.push({ type: 'add', lines: newLines })
    return { ops, estimatedSize: estimateDiffSize(ops) }
  }

  if (newLines.length === 0) {
    // All removed
    ops.push({ type: 'remove', count: oldLines.length })
    return { ops, estimatedSize: estimateDiffSize(ops) }
  }

  // Find common prefix (unchanged lines at start)
  let prefixLength = 0
  while (
    prefixLength < oldLines.length &&
    prefixLength < newLines.length &&
    oldLines[prefixLength] === newLines[prefixLength]
  ) {
    prefixLength++
  }

  // Find common suffix (unchanged lines at end)
  let suffixLength = 0
  const oldRemaining = oldLines.length - prefixLength
  const newRemaining = newLines.length - prefixLength
  while (
    suffixLength < oldRemaining &&
    suffixLength < newRemaining &&
    oldLines[oldLines.length - 1 - suffixLength] === newLines[newLines.length - 1 - suffixLength]
  ) {
    suffixLength++
  }

  // Generate operations
  if (prefixLength > 0) {
    ops.push({ type: 'keep', count: prefixLength })
  }

  const oldMiddleCount = oldLines.length - prefixLength - suffixLength
  const newMiddleStart = prefixLength
  const newMiddleEnd = newLines.length - suffixLength

  if (oldMiddleCount > 0) {
    ops.push({ type: 'remove', count: oldMiddleCount })
  }

  if (newMiddleEnd > newMiddleStart) {
    const addedLines = newLines.slice(newMiddleStart, newMiddleEnd)
    ops.push({ type: 'add', lines: addedLines })
  }

  if (suffixLength > 0) {
    ops.push({ type: 'keep', count: suffixLength })
  }

  return {
    ops,
    estimatedSize: estimateDiffSize(ops),
  }
}

/**
 * Estimate JSON serialized size of diff operations
 */
function estimateDiffSize(ops: DiffOp[]): number {
  let size = 2 // [] array brackets

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]
    if (i > 0) size += 1 // comma separator

    // Estimate object overhead: {"type":"X",...}
    size += 12 // {"type":""}

    switch (op.type) {
      case 'keep':
        size += 4 // "keep"
        size += 10 // ,"count":N (assuming N < 1000)
        break

      case 'remove':
        size += 6 // "remove"
        size += 10 // ,"count":N
        break

      case 'add':
        size += 3 // "add"
        size += 10 // ,"lines":[]
        // Estimate lines array size
        for (let j = 0; j < op.lines.length; j++) {
          if (j > 0) size += 1 // comma
          size += 2 // quotes around string
          size += op.lines[j].length
          // Account for escaped characters (rough estimate)
          size += Math.floor(op.lines[j].length * 0.05)
        }
        break
    }
  }

  return size
}

/**
 * Apply diff operations to reconstruct content
 * Used for testing and client-side application
 */
export function applyDiff(oldContent: string, ops: DiffOp[]): string {
  // Empty ops means no changes - return original
  if (ops.length === 0) {
    return oldContent
  }

  const oldLines = oldContent ? oldContent.split('\n') : []
  const result: string[] = []
  let lineIndex = 0

  for (const op of ops) {
    switch (op.type) {
      case 'keep':
        result.push(...oldLines.slice(lineIndex, lineIndex + op.count))
        lineIndex += op.count
        break

      case 'add':
        result.push(...op.lines)
        break

      case 'remove':
        lineIndex += op.count
        break
    }
  }

  return result.join('\n')
}
