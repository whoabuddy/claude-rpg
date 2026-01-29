/**
 * Terminal parsing types
 */

export type PromptType = 'permission' | 'question' | 'plan' | 'feedback'

export interface DetectedPrompt {
  type: PromptType
  text: string
  options?: string[]
}

export interface TerminalDetection {
  status: 'working' | 'waiting' | 'idle' | 'error' | 'unknown'
  confidence: number // 0-1
  prompt?: DetectedPrompt
  error?: string
  matchedPattern?: string
}
