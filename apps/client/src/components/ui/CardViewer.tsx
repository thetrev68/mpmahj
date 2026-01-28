/**
 * Card Viewer Component
 *
 * Displays the NMJL card patterns in a browsable interface.
 * Features:
 * - Filter by section
 * - Highlight patterns that match current hand
 * - Toggle visibility
 */

import { useState, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useGameStore } from '@/store/gameStore';
import type { Tile } from '@/types/bindings/generated/Tile';
import {
  loadCard,
  getSectionNames,
  getPatterns,
  type CardData,
  type CardPattern,
} from '@/utils/cardLoader';
import { tileToSvgPath, tileToString } from '@/utils/tileFormatter';
import './CardViewer.css';

export function CardViewer() {
  const showCardViewer = useUIStore((state) => state.showCardViewer);
  const setShowCardViewer = useUIStore((state) => state.setShowCardViewer);
  const hand = useGameStore((state) => state.yourHand);

  const [cardData, setCardData] = useState<CardData | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load card data on mount
  useEffect(() => {
    const loadCardData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load current year card (2025)
        const data = await loadCard(2025);
        setCardData(data);

        // Select first section by default
        const sections = getSectionNames(data);
        if (sections.length > 0) {
          setSelectedSection(sections[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load card');
        console.error('Error loading card:', err);
      } finally {
        setLoading(false);
      }
    };

    if (showCardViewer && !cardData) {
      loadCardData();
    }
  }, [showCardViewer, cardData]);

  if (!showCardViewer) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">NMJL Card 2025</h2>
          <button
            onClick={() => setShowCardViewer(false)}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            aria-label="Close card viewer"
          >
            ×
          </button>
        </div>

        {/* Loading/Error States */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500">Loading card data...</p>
          </div>
        )}

        {error && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-500 mb-2">{error}</p>
              <p className="text-sm text-gray-600">
                Card data should be placed in <code>public/cards/card2025.json</code>
              </p>
            </div>
          </div>
        )}

        {/* Main Content */}
        {!loading && !error && cardData && (
          <div className="flex-1 flex overflow-hidden">
            {/* Section Sidebar */}
            <div className="w-48 border-r overflow-y-auto bg-gray-50">
              <div className="p-2">
                {getSectionNames(cardData).map((section) => (
                  <button
                    key={section}
                    onClick={() => setSelectedSection(section)}
                    className={`w-full text-left px-3 py-2 rounded mb-1 transition-colors ${
                      selectedSection === section ? 'bg-blue-500 text-white' : 'hover:bg-gray-200'
                    }`}
                  >
                    {section}
                  </button>
                ))}
              </div>
            </div>

            {/* Pattern Display */}
            <div className="flex-1 overflow-y-auto p-4">
              {selectedSection ? (
                <PatternList patterns={getPatterns(cardData, selectedSection)} hand={hand} />
              ) : (
                <div className="text-center text-gray-500 mt-8">
                  Select a section to view patterns
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface PatternListProps {
  patterns: CardPattern[];
  hand: Tile[];
}

function PatternList({ patterns, hand }: PatternListProps) {
  if (patterns.length === 0) {
    return <div className="text-center text-gray-500 mt-8">No patterns in this section</div>;
  }

  return (
    <div className="space-y-4">
      {patterns.map((pattern, index) => (
        <PatternCard key={index} pattern={pattern} hand={hand} />
      ))}
    </div>
  );
}

interface PatternCardProps {
  pattern: CardPattern;
  hand: Tile[];
}

/**
 * Convert a tile component to a Tile index.
 * Maps VSUIT1 -> Bams (green), VSUIT2 -> Craks (red), VSUIT3 -> Dots (blue)
 * Maps VSUIT*_DRAGON to matching dragons
 * 
 * Special number values:
 * - number=0: Special tile (Flower, Dragon with no number)
 * - number=100: "any number" (wildcard for like numbers patterns) - displayed as 2 for even, 1 for odd/default
 * - number=101-103: "any number" in consecutive patterns (offset 1-3) - displayed as 2-4
 */
function componentToTileIndex(
  component: { suit: string; number: number },
  patternEven?: boolean,
  patternOdd?: boolean
): Tile | null {
  const { suit, number } = component;
  
  // Convert special number encodings to display numbers
  let displayNumber: number;
  if (number === 0) {
    displayNumber = 0; // Special tiles (Flower, Dragon)
  } else if (number === 100) {
    // "any number" in like numbers - choose display based on pattern constraint
    if (patternEven) {
      displayNumber = 2; // Even pattern - use 2 as representative
    } else if (patternOdd) {
      displayNumber = 1; // Odd pattern - use 1 as representative
    } else {
      displayNumber = 1; // Default to 1
    }
  } else if (number === 101) {
    displayNumber = 2; // "any number" in consecutive (offset 1)
  } else if (number === 102) {
    displayNumber = 3; // "any number" in consecutive (offset 2)
  } else if (number === 103) {
    displayNumber = 4; // "any number" in consecutive (offset 3)
  } else {
    displayNumber = number; // Regular tile number
  }

  // Variable suits
  if (suit === 'VSUIT1') {
    // Bams (green) - indices 0-8
    if (displayNumber >= 1 && displayNumber <= 9) {
      return (displayNumber - 1) as Tile;
    }
  }

  if (suit === 'VSUIT2') {
    // Craks (red) - indices 9-17
    if (displayNumber >= 1 && displayNumber <= 9) {
      return (9 + displayNumber - 1) as Tile;
    }
  }

  if (suit === 'VSUIT3') {
    // Dots (blue) - indices 18-26
    if (displayNumber >= 1 && displayNumber <= 9) {
      return (18 + displayNumber - 1) as Tile;
    }
  }

  // Variable suit dragons
  if (suit === 'VSUIT1_DRAGON') {
    return 31; // Green Dragon (matches VSUIT1/Bams green)
  }
  if (suit === 'VSUIT2_DRAGON') {
    return 32; // Red Dragon (matches VSUIT2/Craks red)
  }
  if (suit === 'VSUIT3_DRAGON') {
    return 33; // White Dragon/Soap (matches VSUIT3/Dots white/blue)
  }

  // Winds: number 1=East, 2=South, 3=West, 4=North
  if (suit === 'Wind') {
    if (displayNumber === 1) return 27; // East
    if (displayNumber === 2) return 28; // South
    if (displayNumber === 3) return 29; // West
    if (displayNumber === 4) return 30; // North
  }

  // Generic Dragon (use White Dragon as representative for display)
  if (suit === 'Dragon') {
    return 33; // White Dragon/Soap
  }

  // Flower
  if (suit === 'Flower') {
    return 34;
  }

  // Joker
  if (suit === 'Joker') {
    return 35;
  }

  return null;
}

function PatternCard({ pattern }: PatternCardProps) {
  // TODO: Implement pattern matching logic to highlight possible patterns
  // For now, just display the pattern
  
  // Extract base pattern from description (before parentheses)
  const basePattern = pattern.name.split('(')[0].trim();
  const baseTokens = basePattern.split(/\s+/);
  
  // Build meld groups and track operators
  const meldGroups: Array<{ tiles: Tile[]; operator?: string }> = [];
  let baseTokenIndex = 0;

  for (const component of pattern.components) {
    const tileIndex = componentToTileIndex(component, pattern.even, pattern.odd);
    
    if (tileIndex !== null) {
      // Create new meld group for each component
      const meld: { tiles: Tile[]; operator?: string } = { tiles: [] };
      
      // Add 'count' copies of this tile
      for (let i = 0; i < component.count; i++) {
        meld.tiles.push(tileIndex);
      }
      
      meldGroups.push(meld);
      
      // Skip current token (meld) and check if next token is an operator
      baseTokenIndex++;
      if (baseTokenIndex < baseTokens.length) {
        const nextToken = baseTokens[baseTokenIndex];
        if (nextToken === '+' || nextToken === '=') {
          meld.operator = nextToken;
          baseTokenIndex++;
        }
      }
    }
  }

  return (
    <div className="card-pattern">
      <h3 className="pattern-name">{pattern.name}</h3>
      <div className="pattern-tiles">
        {meldGroups.map((meld, groupIndex) => (
          <div key={groupIndex}>
            <div className="pattern-meld">
              {meld.tiles.map((tileIndex, tileIdx) => {
                const svgPath = tileToSvgPath(tileIndex);
                const tileName = tileToString(tileIndex);
                
                return (
                  <div key={tileIdx} className="pattern-tile" title={tileName}>
                    {svgPath ? (
                      <img src={svgPath} alt={tileName} className="pattern-tile-image" />
                    ) : (
                      <span className="pattern-tile-text">{tileName}</span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Show operator after meld if exists */}
            {meld.operator && (
              <div className="pattern-operator">{meld.operator}</div>
            )}
          </div>
        ))}
      </div>
      {pattern.points && <div className="pattern-points">Points: {pattern.points}</div>}
    </div>
  );
}
