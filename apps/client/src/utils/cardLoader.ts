/**
 * Card Data Loader
 *
 * Loads NMJL card pattern data for display in the card viewer.
 * Card data is stored in `data/cards/unified_cardYYYY.json` at the repository root
 * and copied to `public/cards/` during build via the `copy-cards` npm script.
 *
 * @module cardLoader
 *
 * @example
 * ```typescript
 * // Load the 2025 NMJL card
 * const card = await loadCard(2025);
 *
 * // Get all section names
 * const sections = getSectionNames(card);
 *
 * // Get patterns for a specific section
 * const patterns = getPatterns(card, "13579");
 * ```
 */

/**
 * Component-based tile specification from card2025.json
 */
export interface TileComponent {
  suit: string; // e.g., "VSUIT1", "VSUIT2", "VSUIT3", "VSUIT1_DRAGON", "Wind", "Dragon", "Flower"
  number: number; // 1-9 for suited tiles, 1-4 for winds (E/S/W/N)
  count: number; // How many of this tile in the pattern
}

/**
 * Represents a single pattern from the NMJL card.
 */
export interface CardPattern {
  /** Array of tile groups (e.g., ["11", "333", "5555"]) - for display */
  pattern: string[];
  /** Component-based tile specification */
  components: TileComponent[];
  /** Human-readable pattern description */
  name: string;
  /** Section/category name (e.g., "13579", "QUINTS") */
  section: string;
  /** Point value for completing this pattern */
  points?: number;
  /** Whether this pattern must use even numbers (for like numbers patterns) */
  even?: boolean;
  /** Whether this pattern must use odd numbers (for like numbers patterns) */
  odd?: boolean;
  /** TODO: Map of tile positions to joker eligibility (not yet implemented) */
  flexibility?: Record<number, boolean>;
}

/**
 * Complete card data for a specific year, organized by sections.
 */
export interface CardData {
  /** NMJL card year (e.g., 2017, 2025) */
  year: number;
  /** Patterns grouped by section/category */
  sections: Record<string, CardPattern[]>;
}

let cachedCard: CardData | null = null;

/**
 * Load card data for a specific year.
 *
 * Fetches the unified card JSON from the public directory and parses it into
 * the internal {@link CardData} format. Results are cached for subsequent calls.
 *
 * @param year - The NMJL card year (e.g., 2025, 2020, 2019, 2018, 2017)
 * @returns Promise resolving to parsed card data
 * @throws Error if the card file cannot be fetched or parsed
 *
 * @example
 * ```typescript
 * try {
 *   const card = await loadCard(2025);
 *   console.log(`Loaded ${Object.keys(card.sections).length} sections`);
 * } catch (error) {
 *   console.error('Failed to load card:', error);
 * }
 * ```
 */
export async function loadCard(year: number): Promise<CardData> {
  // Return cached data if available
  if (cachedCard && cachedCard.year === year) {
    return cachedCard;
  }

  try {
    // Fetch from public directory (cardYYYY.json naming convention)
    const response = await fetch(`/cards/card${year}.json`);

    if (!response.ok) {
      throw new Error(`Failed to load card ${year}: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform unified format to internal CardData structure
    const cardData: CardData = {
      year,
      sections: parseCardSections(data),
    };

    cachedCard = cardData;
    return cardData;
  } catch (error) {
    console.error(`Error loading card ${year}:`, error);
    throw error;
  }
}

/**
 * Card format structure from data/cards/cardYYYY.json
 */
interface CardHand {
  description: string;
  vsuit_count: number;
  concealed: boolean;
  odd: boolean;
  even: boolean;
  components: TileComponent[];
}

interface CardSection {
  group_description: string;
  hands: CardHand[];
}

interface CardFileData {
  year: number;
  sections: CardSection[];
}

/**
 * Parse sections from card2025.json format.
 *
 * Converts the cardYYYY.json format to the internal {@link CardData} structure.
 * The format groups patterns by section (e.g., "13579", "WINDS - DRAGONS"),
 * with each hand having component-based tile specifications.
 *
 * @param data - Raw JSON data from cardYYYY.json
 * @returns Patterns grouped by section/category name
 * @internal
 */
function parseCardSections(data: unknown): Record<string, CardPattern[]> {
  const sections: Record<string, CardPattern[]> = {};

  // Validate data structure
  if (typeof data !== 'object' || data === null || !('sections' in data)) {
    console.warn('Invalid card data format - missing sections array');
    return sections;
  }

  const cardData = data as CardFileData;

  // Process each section
  for (const section of cardData.sections) {
    const sectionName = section.group_description;

    if (!sections[sectionName]) {
      sections[sectionName] = [];
    }

    // Process each hand in the section
    for (const hand of section.hands) {
      // Parse description for display (e.g., "11 333 5555 777 99")
      const tilePattern = hand.description.split(' ');

      sections[sectionName].push({
        pattern: tilePattern,
        components: hand.components,
        name: hand.description,
        section: sectionName,
        points: undefined, // Points not in card2025.json format
        even: hand.even,
        odd: hand.odd,
        flexibility: undefined,
      });
    }
  }

  return sections;
}

/**
 * Get all section names from a card.
 *
 * @param cardData - The loaded card data
 * @returns Array of section names (e.g., ["13579", "QUINTS", "WINDS - DRAGONS"])
 */
export function getSectionNames(cardData: CardData): string[] {
  return Object.keys(cardData.sections);
}

/**
 * Get patterns for a specific section.
 *
 * @param cardData - The loaded card data
 * @param section - Section name (e.g., "13579", "QUINTS")
 * @returns Array of patterns in the section, or empty array if section not found
 */
export function getPatterns(cardData: CardData, section: string): CardPattern[] {
  return cardData.sections[section] || [];
}

/**
 * Filter patterns based on current hand.
 *
 * Returns patterns that might be possible with the current tiles.
 *
 * @param cardData - The loaded card data
 * @param _hand - Tile histogram
 * @returns Array of potentially achievable patterns
 *
 * @remarks
 * TODO: Implement histogram-based pattern matching algorithm.
 * Currently returns all patterns for MVP to allow user browsing.
 * Need to filter patterns by feasibility based on the player's current hand.
 */
export function filterPossiblePatterns(
  cardData: CardData,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _hand: number[]
): CardPattern[] {
  const allPatterns: CardPattern[] = [];
  Object.values(cardData.sections).forEach((patterns) => {
    allPatterns.push(...patterns);
  });

  return allPatterns;
}

/**
 * Check if card data is available for a specific year.
 *
 * @param year - The NMJL card year to check
 * @returns Promise resolving to true if the card file exists
 */
export async function isCardAvailable(year: number): Promise<boolean> {
  try {
    const response = await fetch(`/cards/card${year}.json`, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get list of available card years.
 *
 * Returns all NMJL card years that the server supports.
 *
 * @returns Promise resolving to array of available years
 *
 * @remarks
 * Current implementation returns a static list of known available years.
 * When implementing CreateRoom UI, use this to populate a year dropdown.
 * Default to 2025 if user doesn't select a year.
 *
 * TODO: Query server capabilities dynamically via API endpoint instead of hardcoded list.
 */
export async function getAvailableYears(): Promise<number[]> {
  // Known available years with unified card data
  return [2017, 2018, 2019, 2020, 2025];
}

/**
 * Clear the cached card data.
 *
 * Forces the next {@link loadCard} call to fetch fresh data from the server.
 * Useful when card data has been updated or when switching between years.
 */
export function clearCache(): void {
  cachedCard = null;
}
