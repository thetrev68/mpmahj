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
import {
  loadCard,
  getSectionNames,
  getPatterns,
  type CardData,
  type CardPattern,
} from '@/utils/cardLoader';

export function CardViewer() {
  const showCardViewer = useUIStore((state) => state.showCardViewer);
  const setShowCardViewer = useUIStore((state) => state.setShowCardViewer);
  const hand = useGameStore((state) => state.hand.concealed);

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
  hand: number[];
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
  hand: number[];
}

function PatternCard({ pattern }: PatternCardProps) {
  // TODO: Implement pattern matching logic to highlight possible patterns
  // For now, just display the pattern

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <h3 className="font-semibold mb-2">{pattern.name}</h3>
      <div className="flex flex-wrap gap-1 font-mono text-sm">
        {pattern.pattern.map((tile, index) => (
          <span key={index} className="px-2 py-1 bg-gray-100 rounded border border-gray-300">
            {tile}
          </span>
        ))}
      </div>
      {pattern.points && <div className="mt-2 text-sm text-gray-600">Points: {pattern.points}</div>}
    </div>
  );
}
