import { useEffect, useState } from 'react'
import type { Companion } from '@shared/types'
import { levelFromTotalXP } from '@shared/types'
import { useStore } from '../store'
import { RadarChart, calculateStatsRadar } from './RadarChart'
import { TeamStats } from './TeamStats'
import { NarrativeSummary } from './NarrativeSummary'
import { getProjectNarrative } from '../lib/api'
import { formatNumber } from '../lib/format'
import type { TeamStats as TeamStatsType, NarrativeSummary as NarrativeSummaryType } from '../types/project'

interface ProjectDetailPageProps {
  companionId: string
  connected: boolean
  onNavigateBack: () => void
}

// Fire icon for streak indicator
function FireIcon() {
  return (
    <svg className="w-4 h-4 inline-block" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2c0 4-3 6-3 10 0 3.31 2.69 6 6 6 1.66 0 3.16-.67 4.24-1.76C18.16 17.33 17 18.99 15 20c-4 2-8 0-9-4-.5-2 0-4 1-6 .5-1 1.5-3 2-4 1-2 3-4 3-4z"
        className="fill-rpg-streak stroke-rpg-error"
        strokeWidth="1"
      />
      <path
        d="M12 22c-2.21 0-4-1.79-4-4 0-2 2-4 2-4s2 2 2 4c0 2.21-0 4 0 4z"
        className="fill-rpg-streak-inner"
      />
    </svg>
  )
}

// Achievement rarity badge colors
function getRarityClass(rarity: string): string {
  switch (rarity) {
    case 'legendary': return 'bg-rpg-gold/20 text-rpg-gold border-rpg-gold-dim'
    case 'epic': return 'bg-purple-500/20 text-purple-400 border-purple-600'
    case 'rare': return 'bg-blue-500/20 text-blue-400 border-blue-600'
    case 'common': return 'bg-rpg-border text-rpg-text-muted border-rpg-border-dim'
    default: return 'bg-rpg-card text-rpg-text-muted border-rpg-border-dim'
  }
}

export function ProjectDetailPage({ companionId, connected, onNavigateBack }: ProjectDetailPageProps) {
  // Get companion from store
  const companion = useStore((state) =>
    state.companions.find((c) => c.id === companionId) || null
  )

  // State for team stats and narrative
  const [teamStats, setTeamStats] = useState<TeamStatsType | null>(null)
  const [narrative, setNarrative] = useState<NarrativeSummaryType | null>(null)
  const [loadingNarrative, setLoadingNarrative] = useState(false)

  // Fetch team stats and narrative on mount
  useEffect(() => {
    if (!companion) return

    setLoadingNarrative(true)
    getProjectNarrative(companionId, 'json')
      .then(result => {
        if (result.ok && result.data) {
          const narrativeData = result.data as NarrativeSummaryType
          setNarrative(narrativeData)
          // Extract team stats if present (server includes it in format=json)
          if (narrativeData.teamStats) {
            setTeamStats(narrativeData.teamStats)
          }
        }
      })
      .catch(err => {
        console.error('[ProjectDetailPage] Failed to fetch narrative:', err)
      })
      .finally(() => {
        setLoadingNarrative(false)
      })
  }, [companionId, companion])

  // Handle export narrative as markdown
  const handleExport = async () => {
    const result = await getProjectNarrative(companionId, 'markdown')
    if (result.ok && typeof result.data === 'string') {
      const blob = new Blob([result.data], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${companion?.name || 'project'}-narrative.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  if (!companion) {
    return (
      <div className="p-4">
        <button
          onClick={onNavigateBack}
          className="text-rpg-text-muted hover:text-rpg-text transition-colors mb-4"
        >
          &larr; Back
        </button>
        <p className="text-rpg-text-dim text-center py-8">Project not found</p>
      </div>
    )
  }

  const { level, currentXP, nextLevelXP } = levelFromTotalXP(companion.totalExperience)
  const xpProgress = (currentXP / nextLevelXP) * 100

  // Calculate total commands
  const totalCommands =
    companion.stats.commands.testsRun +
    companion.stats.commands.buildsRun +
    companion.stats.commands.deploysRun +
    companion.stats.commands.lintsRun

  // Calculate total blockchain ops
  const totalBlockchain =
    companion.stats.blockchain.clarinetChecks +
    companion.stats.blockchain.clarinetTests +
    companion.stats.blockchain.testnetDeploys +
    companion.stats.blockchain.mainnetDeploys

  // Generate narrative text
  const narrativeLines: string[] = []

  if (companion.stats.git.commits > 0) {
    narrativeLines.push(
      `This project has seen ${companion.stats.git.commits} commit${companion.stats.git.commits === 1 ? '' : 's'} ` +
      `across ${companion.stats.sessionsCompleted} session${companion.stats.sessionsCompleted === 1 ? '' : 's'}.`
    )
  }

  if (companion.streak.current > 0) {
    narrativeLines.push(
      `Currently on a ${companion.streak.current}-day streak! ` +
      (companion.streak.longest > companion.streak.current
        ? `Best: ${companion.streak.longest} days.`
        : 'This is the best streak yet!')
    )
  }

  if (companion.stats.quests.questsCompleted > 0) {
    narrativeLines.push(
      `Completed ${companion.stats.quests.questsCompleted} quest${companion.stats.quests.questsCompleted === 1 ? '' : 's'} ` +
      `through ${companion.stats.quests.phasesCompleted} phase${companion.stats.quests.phasesCompleted === 1 ? '' : 's'}.`
    )
  }

  if (companion.stats.git.prsCreated > 0) {
    narrativeLines.push(
      `Created ${companion.stats.git.prsCreated} pull request${companion.stats.git.prsCreated === 1 ? '' : 's'}, ` +
      `with ${companion.stats.git.prsMerged} merged.`
    )
  }

  if (level >= 5) {
    narrativeLines.push(`This seasoned project has reached level ${level}.`)
  } else if (level >= 3) {
    narrativeLines.push(`Making steady progress at level ${level}.`)
  } else {
    narrativeLines.push(`Just getting started at level ${level}.`)
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onNavigateBack}
          className="p-2 -ml-2 text-rpg-text-muted hover:text-rpg-text transition-colors"
          title="Back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-rpg-text">{companion.name}</h1>
          {companion.repo.path && (
            <p className="text-xs text-rpg-text-dim font-mono truncate">
              {companion.repo.path}
            </p>
          )}
        </div>
      </div>

      {/* Level & XP Progress */}
      <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-rpg-accent/20 text-rpg-accent text-sm font-bold rounded">
              Level {level}
            </span>
            {companion.streak.current > 0 && (
              <span className="flex items-center gap-1 text-sm text-rpg-streak">
                <FireIcon />
                {companion.streak.current} day{companion.streak.current === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <span className="text-xs text-rpg-text-dim">
            {currentXP} / {nextLevelXP} XP
          </span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-rpg-border rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-rpg-accent to-rpg-gold transition-all duration-500"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
      </div>

      {/* Stat Distribution Chart */}
      {companion.stats.sessionsCompleted > 0 && (
        <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated p-4">
          <h2 className="text-sm font-medium text-rpg-text mb-2">Stat Distribution</h2>
          <div className="flex justify-center">
            <RadarChart
              data={calculateStatsRadar(companion.stats)}
              size={220}
            />
          </div>
        </div>
      )}

      {/* Stats Overview Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total XP */}
        <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated p-3">
          <div className="text-xs text-rpg-text-muted mb-1">Total XP</div>
          <div className="text-2xl font-bold text-rpg-accent tabular-nums">
            {formatNumber(companion.totalExperience)}
          </div>
        </div>

        {/* Sessions */}
        <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated p-3">
          <div className="text-xs text-rpg-text-muted mb-1">Sessions</div>
          <div className="text-2xl font-bold text-rpg-text tabular-nums">
            {companion.stats.sessionsCompleted}
          </div>
        </div>

        {/* Git stats */}
        <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated p-3">
          <div className="text-xs text-rpg-text-muted mb-1">Commits</div>
          <div className="text-2xl font-bold text-rpg-text tabular-nums">
            {companion.stats.git.commits}
          </div>
          <div className="text-xs text-rpg-text-dim mt-1">
            {companion.stats.git.pushes} pushes, {companion.stats.git.prsCreated} PRs
          </div>
        </div>

        {/* Commands */}
        <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated p-3">
          <div className="text-xs text-rpg-text-muted mb-1">Commands</div>
          <div className="text-2xl font-bold text-rpg-text tabular-nums">
            {totalCommands}
          </div>
          <div className="text-xs text-rpg-text-dim mt-1">
            {companion.stats.commands.testsRun} tests, {companion.stats.commands.buildsRun} builds
          </div>
        </div>

        {/* Quests */}
        {companion.stats.quests.questsCompleted > 0 && (
          <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated p-3">
            <div className="text-xs text-rpg-text-muted mb-1">Quests</div>
            <div className="text-2xl font-bold text-rpg-text tabular-nums">
              {companion.stats.quests.questsCompleted}
            </div>
            <div className="text-xs text-rpg-text-dim mt-1">
              {companion.stats.quests.phasesCompleted} phases
            </div>
          </div>
        )}

        {/* Blockchain stats (if any) */}
        {totalBlockchain > 0 && (
          <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated p-3">
            <div className="text-xs text-rpg-text-muted mb-1">Blockchain</div>
            <div className="text-2xl font-bold text-rpg-text tabular-nums">
              {totalBlockchain}
            </div>
            <div className="text-xs text-rpg-text-dim mt-1">
              {companion.stats.blockchain.clarinetTests} tests, {companion.stats.blockchain.mainnetDeploys} deploys
            </div>
          </div>
        )}
      </div>

      {/* Project Story */}
      <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated p-4">
        <h2 className="text-sm font-medium text-rpg-text mb-2">Project Story</h2>
        {narrativeLines.length > 0 ? (
          <div className="space-y-2 text-sm text-rpg-text-muted leading-relaxed">
            {narrativeLines.map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-rpg-text-dim">No story yet. Start working to build your legend!</p>
        )}
      </div>

      {/* Achievements */}
      {companion.achievements.length > 0 && (
        <div className="rounded-lg border border-rpg-border bg-rpg-bg-elevated p-4">
          <h2 className="text-sm font-medium text-rpg-text mb-3">
            Achievements ({companion.achievements.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {companion.achievements.map(achievement => {
              // Achievement definitions would need to be imported or fetched
              // For now, just display the achievement ID
              return (
                <div
                  key={achievement.id}
                  className="flex items-center gap-2 p-2 rounded border border-rpg-border-dim bg-rpg-card"
                >
                  <span className="text-lg">{achievement.id.includes('first') ? '🎉' : '🏆'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-rpg-text truncate">
                      {achievement.id.replace(/_/g, ' ')}
                    </div>
                    <div className="text-xs text-rpg-text-dim">
                      {new Date(achievement.unlockedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Team Stats */}
      <TeamStats teamStats={teamStats} loading={loadingNarrative} />

      {/* Narrative Summary */}
      <NarrativeSummary
        narrative={narrative}
        loading={loadingNarrative}
        onExport={handleExport}
      />
    </div>
  )
}
