/**
 * Name generation for personas
 * Corporate first + last names for that coworker feel
 */

const FIRST_NAMES = [
  // Common corporate names
  'Alex', 'Amanda', 'Andrew', 'Angela', 'Anthony', 'Ashley',
  'Benjamin', 'Brandon', 'Brian', 'Brittany',
  'Carlos', 'Catherine', 'Charles', 'Christina', 'Christopher', 'Courtney',
  'Daniel', 'David', 'Deborah', 'Derek', 'Diana', 'Donna',
  'Edward', 'Elizabeth', 'Emily', 'Eric', 'Ethan', 'Eugene',
  'Frank', 'Gabriel', 'Grace', 'Gregory', 'Hannah', 'Heather',
  'Jack', 'Jacob', 'James', 'Janet', 'Jason', 'Jeffrey', 'Jennifer', 'Jessica', 'John', 'Jonathan', 'Jordan', 'Joseph', 'Joshua', 'Julia', 'Justin',
  'Karen', 'Katherine', 'Keith', 'Kelly', 'Kenneth', 'Kevin', 'Kimberly', 'Kyle',
  'Laura', 'Lauren', 'Linda', 'Lisa', 'Lucas', 'Luis',
  'Madison', 'Margaret', 'Maria', 'Mark', 'Martha', 'Martin', 'Mary', 'Matthew', 'Megan', 'Melissa', 'Michael', 'Michelle', 'Monica',
  'Nancy', 'Natalie', 'Nathan', 'Nicholas', 'Nicole', 'Noah',
  'Olivia', 'Omar', 'Patricia', 'Patrick', 'Paul', 'Peter', 'Philip', 'Priya',
  'Rachel', 'Raymond', 'Rebecca', 'Richard', 'Robert', 'Ronald', 'Ryan',
  'Samantha', 'Samuel', 'Sandra', 'Sara', 'Sarah', 'Scott', 'Sean', 'Sharon', 'Sophia', 'Stephanie', 'Stephen', 'Steven', 'Susan',
  'Tanya', 'Taylor', 'Teresa', 'Thomas', 'Timothy', 'Todd', 'Travis', 'Tyler',
  'Vanessa', 'Victor', 'Victoria', 'Vincent', 'Wei', 'William',
  'Yolanda', 'Zachary',
]

const LAST_NAMES = [
  // Common surnames
  'Adams', 'Allen', 'Anderson', 'Bailey', 'Baker', 'Barnes', 'Bell', 'Bennett', 'Brooks', 'Brown', 'Bryant', 'Butler',
  'Campbell', 'Carter', 'Chen', 'Clark', 'Collins', 'Cook', 'Cooper', 'Cox', 'Cruz',
  'Davis', 'Diaz', 'Edwards', 'Evans', 'Fisher', 'Flores', 'Foster', 'Freeman',
  'Garcia', 'Gomez', 'Gonzalez', 'Gray', 'Green', 'Griffin', 'Gutierrez',
  'Hall', 'Hamilton', 'Harris', 'Hayes', 'Henderson', 'Hernandez', 'Hill', 'Howard', 'Hughes', 'Hunt',
  'Jackson', 'James', 'Jenkins', 'Johnson', 'Jones', 'Jordan',
  'Kelly', 'Kennedy', 'Kim', 'King', 'Kumar', 'Lee', 'Lewis', 'Li', 'Long', 'Lopez',
  'Martin', 'Martinez', 'Miller', 'Mitchell', 'Moore', 'Morgan', 'Morris', 'Murphy', 'Myers',
  'Nelson', 'Nguyen', 'Patel', 'Patterson', 'Perez', 'Perry', 'Peterson', 'Phillips', 'Powell', 'Price',
  'Ramirez', 'Reed', 'Reyes', 'Reynolds', 'Richardson', 'Rivera', 'Roberts', 'Robinson', 'Rodriguez', 'Rogers', 'Ross', 'Russell',
  'Sanchez', 'Sanders', 'Scott', 'Shah', 'Shaw', 'Simmons', 'Singh', 'Smith', 'Stewart', 'Sullivan',
  'Taylor', 'Thomas', 'Thompson', 'Torres', 'Turner',
  'Walker', 'Wallace', 'Wang', 'Ward', 'Watson', 'West', 'White', 'Williams', 'Wilson', 'Wood', 'Wright',
  'Yang', 'Young', 'Zhang',
]

/**
 * Generate a full name from a session ID
 * For pane-based IDs (auto-created), uses random selection
 * For real Claude session IDs, uses deterministic hash
 */
export function generateNameFromSessionId(sessionId: string): string {
  // Pane-based IDs are too similar to hash well - use random
  if (sessionId.startsWith('pane-')) {
    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
    return `${first} ${last}`
  }

  // Real Claude session IDs - use deterministic hash
  let hash = 0
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash) + sessionId.charCodeAt(i)
    hash = hash & hash
  }

  const firstIndex = Math.abs(hash) % FIRST_NAMES.length
  const lastIndex = Math.abs(hash >> 8) % LAST_NAMES.length

  return `${FIRST_NAMES[firstIndex]} ${LAST_NAMES[lastIndex]}`
}

/**
 * Generate a unique full name not in the existing set
 */
export function generateUniqueName(existingNames: Set<string>): string {
  // Try random combinations
  for (let i = 0; i < 500; i++) {
    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
    const name = `${first} ${last}`

    if (!existingNames.has(name)) {
      return name
    }
  }

  // Fallback: add middle initial
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
  const initial = String.fromCharCode(65 + Math.floor(Math.random() * 26))
  return `${first} ${initial}. ${last}`
}

/**
 * Get approximate count of possible name combinations
 */
export function getPossibleNameCount(): number {
  return FIRST_NAMES.length * LAST_NAMES.length
}
