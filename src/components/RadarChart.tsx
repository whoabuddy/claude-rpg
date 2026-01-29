/**
 * Simple SVG radar chart for stat visualization
 */

interface RadarDataPoint {
  label: string
  value: number // 0-100 normalized
}

interface RadarChartProps {
  data: RadarDataPoint[]
  size?: number
  className?: string
}

export function RadarChart({ data, size = 200, className = '' }: RadarChartProps) {
  if (data.length < 3) return null

  const center = size / 2
  const radius = (size / 2) - 30 // Leave room for labels
  const angleStep = (2 * Math.PI) / data.length
  const startAngle = -Math.PI / 2 // Start at top

  // Generate polygon points for the background rings
  function polygonPoints(r: number): string {
    return data
      .map((_, i) => {
        const angle = startAngle + i * angleStep
        const x = center + r * Math.cos(angle)
        const y = center + r * Math.sin(angle)
        return `${x},${y}`
      })
      .join(' ')
  }

  // Generate the data polygon
  const dataPoints = data.map((d, i) => {
    const angle = startAngle + i * angleStep
    const r = (d.value / 100) * radius
    const x = center + r * Math.cos(angle)
    const y = center + r * Math.sin(angle)
    return { x, y, ...d }
  })

  const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={`${className}`}
      role="img"
      aria-label="Stat distribution radar chart"
    >
      {/* Background rings */}
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <polygon
          key={scale}
          points={polygonPoints(radius * scale)}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-rpg-border"
          opacity={0.5}
        />
      ))}

      {/* Axis lines */}
      {data.map((_, i) => {
        const angle = startAngle + i * angleStep
        const x = center + radius * Math.cos(angle)
        const y = center + radius * Math.sin(angle)
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke="currentColor"
            strokeWidth="1"
            className="text-rpg-border"
            opacity={0.3}
          />
        )
      })}

      {/* Data polygon */}
      <polygon
        points={dataPolygon}
        fill="currentColor"
        fillOpacity={0.2}
        stroke="currentColor"
        strokeWidth="2"
        className="text-rpg-accent"
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="4"
          fill="currentColor"
          className="text-rpg-accent"
        />
      ))}

      {/* Labels */}
      {data.map((d, i) => {
        const angle = startAngle + i * angleStep
        const labelRadius = radius + 18
        const x = center + labelRadius * Math.cos(angle)
        const y = center + labelRadius * Math.sin(angle)

        // Adjust text anchor based on position
        let textAnchor = 'middle'
        if (Math.abs(Math.cos(angle)) > 0.3) {
          textAnchor = Math.cos(angle) > 0 ? 'start' : 'end'
        }

        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor={textAnchor}
            dominantBaseline="middle"
            className="text-rpg-text-muted fill-current"
            fontSize="11"
          >
            {d.label}
          </text>
        )
      })}
    </svg>
  )
}

/**
 * Calculate normalized radar data from companion stats
 */
export function calculateStatsRadar(stats: {
  git: { commits: number; pushes: number; prsCreated: number }
  commands: { testsRun: number; buildsRun: number; deploysRun: number }
  sessionsCompleted: number
  quests: { questsCompleted: number; phasesCompleted: number }
}): RadarDataPoint[] {
  // Normalize each stat to 0-100 scale
  // Using log scale for better visualization of varied values
  function normalize(value: number, max: number): number {
    if (value === 0) return 0
    const logValue = Math.log10(value + 1)
    const logMax = Math.log10(max + 1)
    return Math.min(100, (logValue / logMax) * 100)
  }

  const totalCommands = stats.commands.testsRun + stats.commands.buildsRun + stats.commands.deploysRun
  const totalQuests = stats.quests.questsCompleted + stats.quests.phasesCompleted

  return [
    { label: 'Git', value: normalize(stats.git.commits + stats.git.pushes, 100) },
    { label: 'Tests', value: normalize(stats.commands.testsRun, 50) },
    { label: 'Builds', value: normalize(stats.commands.buildsRun, 30) },
    { label: 'Sessions', value: normalize(stats.sessionsCompleted, 50) },
    { label: 'Quests', value: normalize(totalQuests, 20) },
    { label: 'PRs', value: normalize(stats.git.prsCreated, 10) },
  ]
}
