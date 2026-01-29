/**
 * Project types
 */

export type ProjectClass = 'frontend' | 'backend' | 'infra' | 'blockchain' | 'fullstack' | 'unknown'

export interface Project {
  id: string
  path: string
  name: string
  githubUrl: string | null
  projectClass: ProjectClass
  totalXp: number
  level: number
  createdAt: string
  lastActivityAt: string
}

export interface GitRepoInfo {
  name: string
  branch: string
  remote: string | null
  isDirty: boolean
  ahead: number
  behind: number
}

export interface ProjectWithStats extends Project {
  stats: {
    toolsUsed: number
    filesEdited: number
    testsRun: number
    commitsCreated: number
    linesChanged: number
  }
}
