import { useState, useEffect, useCallback } from 'react'

const EMOJIS = ['🐶', '🐱', '🐸', '🦊', '🐻', '🐼', '🐨', '🦁']
const TOTAL_CARDS = EMOJIS.length * 2

interface Card {
  id: number
  emoji: string
  isFlipped: boolean
  isMatched: boolean
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function createCards(): Card[] {
  const pairs = EMOJIS.flatMap((emoji, idx) => [
    { id: idx * 2, emoji, isFlipped: false, isMatched: false },
    { id: idx * 2 + 1, emoji, isFlipped: false, isMatched: false },
  ])
  return shuffleArray(pairs)
}

export default function MemoryMatch({ onBack }: { onBack: () => void }) {
  const [cards, setCards] = useState<Card[]>(createCards)
  const [flippedIds, setFlippedIds] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [matchedPairs, setMatchedPairs] = useState(0)
  const [isChecking, setIsChecking] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [bestScore, setBestScore] = useState(() => {
    const saved = localStorage.getItem('memory_best')
    return saved ? parseInt(saved) : 0
  })

  const checkMatch = useCallback((firstId: number, secondId: number, currentCards: Card[]) => {
    const first = currentCards.find((c) => c.id === firstId)!
    const second = currentCards.find((c) => c.id === secondId)!
    const isMatch = first.emoji === second.emoji

    setCards((prev) =>
      prev.map((c) =>
        c.id === firstId || c.id === secondId
          ? { ...c, isFlipped: true, isMatched: isMatch ? true : c.isMatched }
          : c
      )
    )

    if (isMatch) {
      const newMatched = matchedPairs + 1
      setMatchedPairs(newMatched)
      if (newMatched === EMOJIS.length) {
        if (moves + 1 < bestScore || bestScore === 0) {
          setBestScore(moves + 1)
          localStorage.setItem('memory_best', (moves + 1).toString())
        }
      }
      setFlippedIds([])
      setIsChecking(false)
    } else {
      setTimeout(() => {
        setCards((prev) =>
          prev.map((c) =>
            c.id === firstId || c.id === secondId
              ? { ...c, isFlipped: false }
              : c
          )
        )
        setFlippedIds([])
        setIsChecking(false)
      }, 800)
    }
  }, [matchedPairs, moves, bestScore])

  const handleCardClick = (id: number) => {
    if (isChecking) return
    const card = cards.find((c) => c.id === id)
    if (!card || card.isFlipped || card.isMatched) return

    if (!gameStarted) setGameStarted(true)

    if (flippedIds.length === 0) {
      setCards((prev) => prev.map((c) => c.id === id ? { ...c, isFlipped: true } : c))
      setFlippedIds([id])
    } else if (flippedIds.length === 1) {
      setCards((prev) => prev.map((c) => c.id === id ? { ...c, isFlipped: true } : c))
      setFlippedIds([flippedIds[0], id])
      setMoves((m) => m + 1)
      setIsChecking(true)
      checkMatch(flippedIds[0], id, cards.map((c) =>
        c.id === id ? { ...c, isFlipped: true } : c
      ))
    }
  }

  const resetGame = () => {
    setCards(createCards())
    setFlippedIds([])
    setMoves(0)
    setMatchedPairs(0)
    setIsChecking(false)
    setGameStarted(false)
  }

  const isWon = matchedPairs === EMOJIS.length

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="flex items-center justify-between w-full max-w-[360px]">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-muted text-secondary hover:bg-surface-hover transition-all">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-secondary">Moves: <span className="text-primary font-bold">{moves}</span></span>
          <span className="text-muted">Best: <span className="text-accent font-bold">{bestScore || '-'}</span></span>
        </div>
        <button onClick={resetGame}
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-accent text-accent-content hover:bg-accent-hover transition-all">
          Reset
        </button>
      </div>

      {!gameStarted && !isWon && (
        <p className="text-xs text-secondary font-medium">Click any card to start</p>
      )}

      {isWon && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-bold text-accent">You won in {moves} moves!</p>
          <button onClick={resetGame}
            className="px-4 py-1.5 rounded-xl text-xs font-medium bg-accent text-accent-content hover:bg-accent-hover transition-all mt-1">
            Play Again
          </button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 bg-surface-muted rounded-2xl p-2 border border-border shadow-sm">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleCardClick(card.id)}
            disabled={card.isFlipped || card.isMatched || isChecking}
            className={`h-14 w-14 sm:h-16 sm:w-16 rounded-xl flex items-center justify-center text-xl sm:text-2xl transition-all duration-300 ${
              card.isFlipped || card.isMatched
                ? card.isMatched
                  ? 'bg-accent/10 scale-95 opacity-60'
                  : 'bg-surface shadow-sm'
                : 'bg-surface-muted hover:bg-surface-hover active:scale-95 border border-border'
            } disabled:cursor-default`}
          >
            {(card.isFlipped || card.isMatched) ? card.emoji : (
              <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
