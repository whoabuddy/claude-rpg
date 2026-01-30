/**
 * Name generation for personas
 * Using human first names for maximum relatability
 */

const FIRST_NAMES = [
  // Classic names (A-E)
  'Alice', 'Alex', 'Aria', 'Ava', 'Bella', 'Ben', 'Blake', 'Cameron',
  'Charlie', 'Chloe', 'Clara', 'Cole', 'Dana', 'David', 'Diana', 'Dylan',
  'Elena', 'Eli', 'Ella', 'Emma', 'Eric', 'Eva',
  // Classic names (F-J)
  'Felix', 'Finn', 'Fiona', 'Grace', 'Gwen', 'Harper', 'Henry', 'Iris',
  'Isaac', 'Ivy', 'Jack', 'James', 'Jane', 'Jasper', 'Jordan', 'Julia',
  // Classic names (K-O)
  'Kate', 'Leo', 'Liam', 'Lily', 'Logan', 'Lucy', 'Luke', 'Luna',
  'Maya', 'Mia', 'Miles', 'Milo', 'Nina', 'Noah', 'Nora', 'Oliver',
  // Classic names (P-T)
  'Parker', 'Piper', 'Quinn', 'Rachel', 'Riley', 'River', 'Roman', 'Rosa',
  'Ruby', 'Ryan', 'Sage', 'Sam', 'Sarah', 'Seth', 'Sienna', 'Simon',
  'Sophia', 'Sophie', 'Stella', 'Tate', 'Taylor', 'Theo', 'Thomas', 'Tyler',
  // Classic names (U-Z)
  'Uma', 'Victor', 'Violet', 'Vivian', 'Wesley', 'Willow', 'Wyatt', 'Zoe',
  // International variety
  'Aiko', 'Amara', 'Ananya', 'Aria', 'Asha', 'Dante', 'Diego', 'Emilia',
  'Esme', 'Hana', 'Kenji', 'Layla', 'Leila', 'Luca', 'Mara', 'Marco',
  'Mateo', 'Naomi', 'Omar', 'Ravi', 'Rowan', 'Sasha', 'Yuki', 'Zara',
]

/**
 * Generate a deterministic name from a session ID
 */
export function generateNameFromSessionId(sessionId: string): string {
  // Simple hash from session ID
  let hash = 0
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash) + sessionId.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }

  const nameIndex = Math.abs(hash) % FIRST_NAMES.length
  return FIRST_NAMES[nameIndex]
}

/**
 * Generate a unique name not in the existing set
 */
export function generateUniqueName(existingNames: Set<string>): string {
  // Try random names
  for (let i = 0; i < 100; i++) {
    const name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]

    if (!existingNames.has(name)) {
      return name
    }
  }

  // Fallback: add a number suffix
  const name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
  const num = Math.floor(Math.random() * 1000)
  return `${name} ${num}`
}

/**
 * Get all possible name combinations count
 */
export function getPossibleNameCount(): number {
  return FIRST_NAMES.length
}
