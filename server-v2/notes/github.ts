/**
 * GitHub integration for converting notes into issues
 */

import { createLogger } from '../lib/logger'

const log = createLogger('notes-github')

export interface CreateIssueOptions {
  title: string
  body: string
  repo: string
  labels?: string[]
}

export interface CreateIssueResult {
  success: boolean
  issueUrl?: string
  error?: string
}

/**
 * Create a GitHub issue using gh CLI
 */
export async function createGitHubIssue(options: CreateIssueOptions): Promise<CreateIssueResult> {
  const { title, body, repo, labels } = options

  try {
    // Build gh CLI command
    const args = [
      'issue',
      'create',
      '--repo',
      repo,
      '--title',
      title,
      '--body',
      body,
    ]

    // Add labels if provided
    if (labels && labels.length > 0) {
      for (const label of labels) {
        args.push('--label', label)
      }
    }

    log.info('Creating GitHub issue', { repo, title })

    // Execute gh CLI command
    const proc = Bun.spawn(['gh', ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      log.error('gh CLI failed', { exitCode, stderr })
      return {
        success: false,
        error: stderr || 'Failed to create issue',
      }
    }

    // Parse issue URL from stdout (gh returns the URL on successful creation)
    const issueUrl = stdout.trim()

    if (!issueUrl || !issueUrl.startsWith('http')) {
      log.error('Unexpected gh CLI output', { stdout })
      return {
        success: false,
        error: 'Failed to parse issue URL',
      }
    }

    log.info('Created GitHub issue', { issueUrl })

    return {
      success: true,
      issueUrl,
    }
  } catch (error) {
    log.error('Failed to create GitHub issue', {
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
