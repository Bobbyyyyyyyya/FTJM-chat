import { useState } from 'react'

type Player = 'X' | 'O'
type Cell = Player | null

function calculateWinner(squares: Cell[]): { winner: Player | null; line: number[] | null } {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ]
  for (const [a, b, c] of lines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { winner: squares[a], line: [a, b, c] }
    }
  }
  return { winner: null, line: null }
}

function getAIMove(squares: Cell[]): number {
  const empty = squares.map((s, i) => s === null ? i : null).filter((s) => s !== null) as number[]
  if (empty.length === 0) return -1

  // Try to win
  for (const i of empty) {
    const test = [...squares]
    test[i] = 'O'
    if (calculateWinner(test).winner === 'O') return i
  }

  // Block player win
  for (const i of empty) {
    const test = [...squares]
    test[i] = 'X'
    if (calculateWinner(test).winner === 'X') return i
  }

  // Take center
  if (empty.includes(4)) return 4

  // Take corners
  const corners = empty.filter((i) => [0, 2, 6, 8].includes(i))
  if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)]

  // Take anything
  return empty[Math.floor(Math.random() * empty.length)]
}

export default function TicTacToe({ onBack }: { onBack: () => void }) {
  const [squares, setSquares] = useState<Cell[]>(Array(9).fill(null))
  const [isXNext, setIsXNext] = useState(true)
  const [mode, setMode] = useState<'pvp' | 'ai' | null>(null)
  const [scores, setScores] = useState({ X: 0, O: 0, draws: 0 })
  const [status, setStatus] = useState('Choose a mode to start')

  const { winner, line } = calculateWinner(squares)
  const isDraw = !winner && squares.every((s) => s !== null)

  const handleClick = (i: number) => {
    if (winner || isDraw || squares[i] || !mode) return
    if (mode === 'ai' && !isXNext) return

    const next = [...squares]
    next[i] = isXNext ? 'X' : 'O'
    setSquares(next)
    setIsXNext(!isXNext)

    const result = calculateWinner(next)
    if (result.winner) {
      setStatus(`Player ${result.winner} wins!`)
      setScores((s) => ({ ...s, [result.winner!]: s[result.winner!] + 1 }))
    } else if (next.every((s) => s !== null)) {
      setStatus("It's a draw!")
      setScores((s) => ({ ...s, draws: s.draws + 1 }))
    } else {
      setStatus(mode === 'ai' ? 'AI is thinking...' : `Player ${isXNext ? 'O' : 'X'}'s turn`)
    }
  }

  // AI move
  const prevSquares = squares
  if (mode === 'ai' && !isXNext && !winner && !isDraw) {
    setTimeout(() => {
      const move = getAIMove(prevSquares)
      if (move >= 0) {
        const next = [...prevSquares]
        next[move] = 'O'
        setSquares(next)
        setIsXNext(true)
        const result = calculateWinner(next)
        if (result.winner) {
          setStatus(`Player ${result.winner} wins!`)
          setScores((s) => ({ ...s, [result.winner!]: s[result.winner!] + 1 }))
        } else if (next.every((s) => s !== null)) {
          setStatus("It's a draw!")
          setScores((s) => ({ ...s, draws: s.draws + 1 }))
        } else {
          setStatus('Your turn (X)')
        }
      }
    }, 400)
  }

  const resetGame = () => {
    setSquares(Array(9).fill(null))
    setIsXNext(true)
    setStatus(mode === 'ai' ? 'Your turn (X)' : "Player X's turn")
  }

  const startMode = (m: 'pvp' | 'ai') => {
    setMode(m)
    setSquares(Array(9).fill(null))
    setIsXNext(true)
    setScores({ X: 0, O: 0, draws: 0 })
    setStatus(m === 'ai' ? 'Your turn (X)' : "Player X's turn")
  }

  if (!mode) {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-muted text-secondary hover:bg-surface-hover transition-all self-start">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h3 className="text-lg font-bold text-primary">Tic-Tac-Toe</h3>
        <div className="flex gap-4">
          <button onClick={() => startMode('pvp')}
            className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-surface border border-border hover:bg-surface-hover hover:border-accent/30 transition-all">
            <div className="flex gap-1">
              <span className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">X</span>
              <span className="h-8 w-8 rounded-lg bg-surface-muted flex items-center justify-center text-sm font-bold text-secondary">O</span>
            </div>
            <span className="text-sm font-medium text-primary">2 Players</span>
          </button>
          <button onClick={() => startMode('ai')}
            className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-surface border border-border hover:bg-surface-hover hover:border-accent/30 transition-all">
            <div className="h-8 w-8 rounded-lg bg-gradient-accent flex items-center justify-center text-sm font-bold text-white">AI</div>
            <span className="text-sm font-medium text-primary">vs Computer</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="flex items-center justify-between w-full max-w-[320px]">
        <button onClick={() => setMode(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-muted text-secondary hover:bg-surface-hover transition-all">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Menu
        </button>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-accent font-bold">X: {scores.X}</span>
          <span className="text-muted">Draw: {scores.draws}</span>
          <span className="text-secondary font-bold">O: {scores.O}</span>
        </div>
        <button onClick={resetGame}
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-accent text-accent-content hover:bg-accent-hover transition-all">
          Reset
        </button>
      </div>

      <div className="text-xs text-secondary font-medium">{status}</div>

      <div className="grid grid-cols-3 gap-2 bg-surface-muted rounded-2xl p-2 border border-border shadow-sm">
        {squares.map((cell, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            disabled={!!winner || isDraw || !!cell || (mode === 'ai' && !isXNext)}
            className={`h-16 w-16 rounded-xl flex items-center justify-center text-2xl font-bold transition-all ${
              cell
                ? cell === 'X'
                  ? 'bg-accent/10 text-accent'
                  : 'bg-surface-hover text-secondary'
                : 'bg-surface hover:bg-surface-hover active:scale-95'
            } ${
              line?.includes(i) ? 'ring-2 ring-accent' : ''
            } disabled:cursor-not-allowed`}
          >
            {cell}
          </button>
        ))}
      </div>
    </div>
  )
}
