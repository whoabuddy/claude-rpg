/**
 * Projects module
 */

export * from './types'
export * from './service'
export { isGitRepo, getRepoInfo, extractGitHubUrl } from './git'
export { getProjectTeamStats, type TeamStats, type PersonaContribution } from './aggregation'
export { generateNarrative, type NarrativeSummary } from './narrative'
