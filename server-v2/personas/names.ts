/**
 * Name generation for personas
 */

const ADJECTIVES = [
  // Colors
  'Crimson', 'Azure', 'Amber', 'Emerald', 'Violet', 'Silver', 'Golden', 'Obsidian',
  'Scarlet', 'Cobalt', 'Jade', 'Ruby', 'Sapphire', 'Onyx', 'Pearl', 'Bronze',
  // Qualities
  'Swift', 'Silent', 'Bold', 'Brave', 'Clever', 'Keen', 'Wise', 'Noble',
  'Fierce', 'Gentle', 'Steady', 'Quick', 'Sharp', 'Bright', 'Clear', 'True',
  // Elements
  'Storm', 'Thunder', 'Lightning', 'Frost', 'Flame', 'Shadow', 'Light', 'Dawn',
  'Dusk', 'Night', 'Star', 'Moon', 'Sun', 'Wind', 'Rain', 'Cloud',
  // Nature
  'Wild', 'Ancient', 'Mystic', 'Cosmic', 'Primal', 'Eternal', 'Hollow', 'Radiant',
  'Verdant', 'Frozen', 'Molten', 'Crystal', 'Iron', 'Stone', 'Steel', 'Glass',
  // Disposition
  'Resolute', 'Stalwart', 'Vigilant', 'Serene', 'Cunning', 'Gallant', 'Valiant', 'Ardent',
  'Nimble', 'Agile', 'Mighty', 'Humble', 'Patient', 'Zealous', 'Solemn', 'Jovial',
  // Mysterious
  'Phantom', 'Spectral', 'Arcane', 'Occult', 'Eldritch', 'Enigmatic', 'Cryptic', 'Veiled',
  'Hidden', 'Secret', 'Masked', 'Cloaked', 'Shrouded', 'Fading', 'Echoing', 'Whispering',
]

const NOUNS = [
  // Animals
  'Wolf', 'Hawk', 'Raven', 'Phoenix', 'Dragon', 'Tiger', 'Bear', 'Fox',
  'Eagle', 'Serpent', 'Lion', 'Panther', 'Falcon', 'Owl', 'Stag', 'Lynx',
  // Nature
  'Mist', 'Shade', 'Thorn', 'Frost', 'Ember', 'Spark', 'Flame', 'Wave',
  'Stone', 'Root', 'Branch', 'Leaf', 'Petal', 'Bloom', 'Seed', 'Moss',
  // Celestial
  'Star', 'Comet', 'Moon', 'Eclipse', 'Nova', 'Nebula', 'Void', 'Orbit',
  'Zenith', 'Aurora', 'Corona', 'Solstice', 'Equinox', 'Twilight', 'Horizon', 'Apex',
  // Objects
  'Blade', 'Shield', 'Arrow', 'Spear', 'Crown', 'Helm', 'Cloak', 'Staff',
  'Rune', 'Sigil', 'Shard', 'Fragment', 'Prism', 'Mirror', 'Lens', 'Beacon',
  // Abstract
  'Spirit', 'Wraith', 'Specter', 'Shade', 'Echo', 'Whisper', 'Dream', 'Vision',
  'Omen', 'Oracle', 'Prophet', 'Sage', 'Seeker', 'Warden', 'Guardian', 'Sentinel',
  // Places
  'Vale', 'Peak', 'Glen', 'Hollow', 'Ridge', 'Crest', 'Shore', 'Haven',
  'Reach', 'March', 'Cairn', 'Tor', 'Fell', 'Mere', 'Fen', 'Dell',
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

  const adjIndex = Math.abs(hash) % ADJECTIVES.length
  const nounIndex = Math.abs(hash >> 8) % NOUNS.length

  return `${ADJECTIVES[adjIndex]} ${NOUNS[nounIndex]}`
}

/**
 * Generate a unique name not in the existing set
 */
export function generateUniqueName(existingNames: Set<string>): string {
  // Try random combinations
  for (let i = 0; i < 100; i++) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
    const name = `${adj} ${noun}`

    if (!existingNames.has(name)) {
      return name
    }
  }

  // Fallback: add a number
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num = Math.floor(Math.random() * 1000)
  return `${adj} ${noun} ${num}`
}

/**
 * Get all possible name combinations count
 */
export function getPossibleNameCount(): number {
  return ADJECTIVES.length * NOUNS.length
}
