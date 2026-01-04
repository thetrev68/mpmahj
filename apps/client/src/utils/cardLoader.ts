/**
 * Card Data Loader
 *
 * Loads NMJL card pattern data for display in the card viewer.
 * Card data is stored in data/nmjl_cards/ and needs to be accessible to the client.
 *
 * Strategy: Copy card JSONs to public/cards/ and fetch at runtime
 */

export interface CardPattern {
  pattern: string[];
  name: string;
  section: string;
  points?: number;
  flexibility?: Record<number, boolean>;
}

export interface CardData {
  year: number;
  sections: Record<string, CardPattern[]>;
}

let cachedCard: CardData | null = null;

/**
 * Load card data for a specific year
 * @param year - The card year (e.g., 2025)
 * @returns Promise resolving to card data
 */
export async function loadCard(year: number): Promise<CardData> {
  // Return cached data if available
  if (cachedCard && cachedCard.year === year) {
    return cachedCard;
  }

  try {
    // Fetch from public directory
    const response = await fetch(`/cards/card${year}.json`);

    if (!response.ok) {
      throw new Error(`Failed to load card ${year}: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform the data to our internal format
    // The actual card format from data/nmjl_cards/ needs to be examined
    // This is a placeholder structure
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
 * Parse sections from raw card data
 * This depends on the actual JSON structure in data/nmjl_cards/
 */
function parseCardSections(data: unknown): Record<string, CardPattern[]> {
  const sections: Record<string, CardPattern[]> = {};

  // TODO: Parse based on actual card JSON structure
  // For now, return empty structure
  if (typeof data === 'object' && data !== null && 'sections' in data) {
    const typedData = data as Record<string, unknown>;
    Object.entries(typedData.sections as Record<string, unknown[]>).forEach(
      ([sectionName, patterns]) => {
        sections[sectionName] = patterns.map((p: unknown) => {
          const pattern = p as Record<string, unknown>;
          return {
            pattern: (pattern.pattern as string[]) || [],
            name: (pattern.name as string) || '',
            section: sectionName,
            points: pattern.points as number | undefined,
            flexibility: pattern.flexibility as Record<number, boolean> | undefined,
          };
        });
      }
    );
  }

  return sections;
}

/**
 * Get all section names from a card
 */
export function getSectionNames(cardData: CardData): string[] {
  return Object.keys(cardData.sections);
}

/**
 * Get patterns for a specific section
 */
export function getPatterns(cardData: CardData, section: string): CardPattern[] {
  return cardData.sections[section] || [];
}

/**
 * Filter patterns based on current hand
 * Returns patterns that might be possible with the current tiles
 */
export function filterPossiblePatterns(
  cardData: CardData,
  // Future: implement pattern matching algorithm
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _hand: number[]
): CardPattern[] {
  // This is a complex matching algorithm
  // For MVP, we can just return all patterns and let the user browse

  const allPatterns: CardPattern[] = [];
  Object.values(cardData.sections).forEach((patterns) => {
    allPatterns.push(...patterns);
  });

  return allPatterns;
}

/**
 * Check if card data is available for a year
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
 * Get list of available card years
 */
export async function getAvailableYears(): Promise<number[]> {
  // Check for cards from 2017-2030
  const years: number[] = [];

  for (let year = 2017; year <= 2030; year++) {
    if (await isCardAvailable(year)) {
      years.push(year);
    }
  }

  return years;
}

/**
 * Clear cached card data
 */
export function clearCache(): void {
  cachedCard = null;
}
