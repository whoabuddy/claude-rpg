/**
 * Personas module
 */

export * from './types'
export * from './service'
export { generateNameFromSessionId, generateUniqueName } from './names'
export { fetchBitcoinFace } from './avatar'
export { TIERS, getTierForLevel, getNextTier, type TierDefinition, type PersonaTier } from './tiers'
export { BADGES, checkBadges, getBadgeDefinition, type BadgeDefinition } from './badges'
export {
  DAILY_CHALLENGES,
  WEEKLY_CHALLENGES,
  assignDailyChallenges,
  assignWeeklyChallenges,
  updateChallengeProgress,
  checkChallengeCompletion,
  getActiveChallenges,
  getAllChallenges,
  expireOldChallenges,
  autoAssignChallenges,
  checkNeedsAssignment,
  getChallengeDefinition,
  getAllChallengeDefinitions,
} from './challenges'
