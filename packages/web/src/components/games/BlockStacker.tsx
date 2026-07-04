import { useState, useEffect, useCallback, useRef } from 'react'

const COLS = 10
const ROWS = 20
const CELL = 22

const SHAPES: number[][][] = [
  // I
  [[1, 1, 1, 1]],
  // O
  [[1, 1], [1, 1]],
  // T
  [[0, 1, 0], [1, 1, 1]],
  // L
  [[1, 0], [1, 0], [1, 1]],
  // J
  [[0, 1], [0, 1], [1, 1]],
  // S
  [[0, 1, 1], [1, 1, 0]],
  // Z
  [[1, 1, 0], [0, 1, 1]],
]

const COLORS = [
  '#38bdf8', // I - cyan
  '#fbbf24', // O - yellow
  '#a78bfa', // T - purple
  '#fb923c', // L - orange
  '#60a5fa', // J - blue
  '#34d399', // S - green
  '#f472b6', // Z - pink
]

interface Piece {
  shape: number[][]
  color: string
  x: number
  y: number
}

function randomPiece(): Piece {
  const idx = Math.floor(Math.random() * SHAPES.length)
  const shape = SHAPES[idx].map((r) => [...r])
  return {
    shape,
    color: COLORS[idx],
    x: Math.floor((COLS - shape[0].length) / 2),
    y: 0,
  }
}

function rotateShape(shape: number[][]): number[][] {
  const rows = shape.length
  const cols = shape[0].length
  const rotated: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rotated[c][rows - 1 - r] = shape[r][c]
    }
  }
  return rotated
}

function collides(board: number[][], piece: Piece): boolean {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue
      const bx = piece.x + c
      const by = piece.y + r
      if (bx < 0 || bx >= COLS || by >= ROWS || by < 0) return true
      if (by >= 0 && board[by][bx]) return true
    }
  }
  return false
}

function mergeBoard(board: number[][], piece: Piece, colorIdx: number): number[][] {
  const newBoard = board.map((r) => [...r])
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue
      const bx = piece.x + c
      const by = piece.y + r
      if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
        newBoard[by][bx] = colorIdx + 1
      }
    }
  }
  return newBoard
}

function clearLines(board: number[][]): { newBoard: number[][]; cleared: number } {
  let cleared = 0
  const newBoard = board.filter((row) => {
    const full = row.every((c) => c !== 0)
    if (full) cleared++
    return !full
  })
  while (newBoard.length < ROWS) {
    newBoard.unshift(Array(COLS).fill(0))
  }
  return { newBoard, cleared }
}

const LINE_SCORES = [0, 100, 300, 500, 800]

export default function BlockStacker({ onBack }: { onBack: () => void }) {
  const [board, setBoard] = useState<number[][]>(Array.from({ length: ROWS }, () => Array(COLS).fill(0)))
  const [current, setCurrent] = useState<Piece>(randomPiece())
  const [next, setNext] = useState<Piece>(randomPiece())
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('block_stacker_highscore')
    return saved ? parseInt(saved) : 0
  })
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'paused' | 'gameover'>('ready')
  const [lines, setLines] = useState(0)

  const boardRef = useRef(board)
  const currentRef = useRef(current)
  const nextRef = useRef(next)
  const scoreRef = useRef(score)
  const levelRef = useRef(level)
  const linesRef = useRef(lines)
  const dropTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentColorIdxRef = useRef(0)

  boardRef.current = board
  currentRef.current = current
  nextRef.current = next
  scoreRef.current = score
  levelRef.current = level
  linesRef.current = lines

  const drop = useCallback(() => {
    const piece = currentRef.current
    const moved = { ...piece, y: piece.y + 1 }
    if (!collides(boardRef.current, moved)) {
      setCurrent(moved)
      currentRef.current = moved
    } else {
      // Lock piece
      const colorIdx = COLORS.indexOf(piece.color)
      const newBoard = mergeBoard(boardRef.current, piece, colorIdx)
      const { newBoard: clearedBoard, cleared } = clearLines(newBoard)
      setBoard(clearedBoard)
      boardRef.current = clearedBoard

      const newLines = linesRef.current + cleared
      setLines(newLines)
      linesRef.current = newLines

      const newLevel = Math.floor(newLines / 10) + 1
      setLevel(newLevel)
      levelRef.current = newLevel

      const lineScore = LINE_SCORES[cleared] || 0
      setScore((s) => {
        const ns = s + lineScore * levelRef.current
        if (ns > parseInt(localStorage.getItem('block_stacker_highscore') || '0')) {
          localStorage.setItem('block_stacker_highscore', ns.toString())
          setHighScore(ns)
        }
        return ns
      })

      // Next piece
      const nextPiece = nextRef.current
      nextPiece.x = Math.floor((COLS - nextPiece.shape[0].length) / 2)
      nextPiece.y = 0
      currentColorIdxRef.current = COLORS.indexOf(nextPiece.color)

      if (collides(clearedBoard, nextPiece)) {
        setGameState('gameover')
        const fs = scoreRef.current
        if (fs > parseInt(localStorage.getItem('block_stacker_highscore') || '0')) {
          localStorage.setItem('block_stacker_highscore', fs.toString())
          setHighScore(fs)
        }
        return
      }

      setCurrent(nextPiece)
      currentRef.current = nextPiece
      setNext(randomPiece())
      nextRef.current = randomPiece()
    }
  }, [])

  const moveHorizontal = useCallback((dx: number) => {
    if (gameState !== 'playing') return
    const piece = currentRef.current
    const moved = { ...piece, x: piece.x + dx }
    if (!collides(boardRef.current, moved)) {
      setCurrent(moved)
      currentRef.current = moved
    }
  }, [gameState])

  const rotate = useCallback(() => {
    if (gameState !== 'playing') return
    const piece = currentRef.current
    const rotated = rotateShape(piece.shape)
    const moved = { ...piece, shape: rotated }
    // Wall kick
    if (!collides(boardRef.current, moved)) {
      setCurrent(moved)
      currentRef.current = moved
      return
    }
    // Try shifting left/right
    for (const off of [-1, 1, -2, 2]) {
      const kicked = { ...moved, x: moved.x + off }
      if (!collides(boardRef.current, kicked)) {
        setCurrent(kicked)
        currentRef.current = kicked
        return
      }
    }
  }, [gameState])

  const hardDrop = useCallback(() => {
    if (gameState !== 'playing') return
    let piece = currentRef.current
    while (!collides(boardRef.current, { ...piece, y: piece.y + 1 })) {
      piece = { ...piece, y: piece.y + 1 }
    }
    setCurrent(piece)
    currentRef.current = piece
    drop()
  }, [gameState, drop])

  const resetGame = useCallback(() => {
    const p = randomPiece()
    const n = randomPiece()
    p.x = Math.floor((COLS - p.shape[0].length) / 2)
    p.y = 0
    n.x = Math.floor((COLS - n.shape[0].length) / 2)
    n.y = 0
    setBoard(Array.from({ length: ROWS }, () => Array(COLS).fill(0)))
    setCurrent(p)
    setNext(n)
    setScore(0)
    setLevel(1)
    setLines(0)
    setGameState('ready')
    boardRef.current = Array.from({ length: ROWS }, () => Array(COLS).fill(0))
    currentRef.current = p
    nextRef.current = n
    scoreRef.current = 0
    levelRef.current = 1
    linesRef.current = 0
  }, [])

  // Drop interval
  useEffect(() => {
    if (gameState !== 'playing') return
    const speed = Math.max(50, 500 - (levelRef.current - 1) * 40)
    const t = setInterval(drop, speed)
    dropTimerRef.current = t
    return () => { if (t) clearInterval(t) }
  }, [gameState, drop, level])

  // Keys
  useEffect(() => {
    if (gameState === 'ready') {
      const handler = (e: KeyboardEvent) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          setGameState('playing')
        }
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }
  }, [gameState])

  useEffect(() => {
    if (gameState !== 'playing') return
    const handleKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault()
      switch (e.key) {
        case 'ArrowLeft': moveHorizontal(-1); break
        case 'ArrowRight': moveHorizontal(1); break
        case 'ArrowDown': drop(); break
        case 'ArrowUp': rotate(); break
        case ' ': hardDrop(); break
        case 'p':
        case 'P':
          setGameState((s) => s === 'playing' ? 'paused' : 'playing')
          break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [gameState, moveHorizontal, drop, rotate, hardDrop])

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="flex items-center justify-between w-full max-w-[400px]">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-muted text-secondary hover:bg-surface-hover transition-all">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-secondary">Lvl <span className="text-primary font-bold">{level}</span></span>
          <span className="text-secondary">Score: <span className="text-primary font-bold">{score}</span></span>
          <span className="text-muted">Best: <span className="text-accent font-bold">{highScore}</span></span>
        </div>
        <button onClick={resetGame}
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-accent text-accent-content hover:bg-accent-hover transition-all">
          Reset
        </button>
      </div>

      <div className="flex gap-4 items-start">
        {/* Board */}
        <div className="relative bg-[#0f172a] rounded-2xl p-2 border border-border shadow-sm">
          <div style={{ width: COLS * CELL, height: ROWS * CELL, position: 'relative' }}>
            {/* Grid */}
            {board.map((row, y) =>
              row.map((cell, x) => {
                if (!cell) return (
                  <div key={`g-${x}-${y}`}
                    style={{
                      position: 'absolute', left: x * CELL, top: y * CELL,
                      width: CELL, height: CELL,
                    }}
                    className="border border-white/[0.02]"
                  />
                )
                const color = COLORS[cell - 1] || '#666'
                return (
                  <div key={`c-${x}-${y}`}
                    style={{
                      position: 'absolute', left: x * CELL, top: y * CELL,
                      width: CELL - 1, height: CELL - 1,
                      backgroundColor: color,
                      borderRadius: 3,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)`,
                    }}
                  />
                )
              })
            )}
            {/* Current piece */}
            {current.shape.map((row, r) =>
              row.map((cell, c) => {
                if (!cell) return null
                return (
                  <div key={`p-${c}-${r}`}
                    style={{
                      position: 'absolute',
                      left: (current.x + c) * CELL,
                      top: (current.y + r) * CELL,
                      width: CELL - 1, height: CELL - 1,
                      backgroundColor: current.color,
                      borderRadius: 3,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)`,
                    }}
                  />
                )
              })
            )}

            {/* Overlays */}
            {gameState === 'ready' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
                <p className="text-white text-sm font-medium">Press Space to start</p>
              </div>
            )}
            {gameState === 'paused' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
                <p className="text-white text-sm font-medium">Paused (P to resume)</p>
              </div>
            )}
            {gameState === 'gameover' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-xl gap-1">
                <p className="text-red-400 text-sm font-bold">Game Over!</p>
                <p className="text-white/70 text-xs">Score: {score}</p>
                <button onClick={resetGame}
                  className="px-4 py-1.5 rounded-xl text-xs font-medium bg-accent text-accent-content hover:bg-accent-hover transition-all mt-1">
                  Play Again
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Next piece */}
        <div className="flex flex-col items-center gap-3">
          <div className="bg-[#0f172a] rounded-xl p-3 border border-border">
            <p className="text-[10px] text-muted mb-2 text-center font-medium">Next</p>
            <div style={{ width: 4 * CELL, height: 4 * CELL, position: 'relative' }}>
              {next.shape.map((row, r) =>
                row.map((cell, c) => {
                  if (!cell) return null
                  return (
                    <div key={`n-${c}-${r}`}
                      style={{
                        position: 'absolute',
                        left: c * CELL + (CELL * (4 - next.shape[0].length)) / 2,
                        top: r * CELL + (CELL * (4 - next.shape.length)) / 2,
                        width: CELL - 1, height: CELL - 1,
                        backgroundColor: next.color,
                        borderRadius: 3,
                      }}
                    />
                  )
                })
              )}
            </div>
          </div>
          <div className="text-[10px] text-muted text-center">
            Lines: {lines}
          </div>
        </div>
      </div>

      <div className="flex gap-3 text-[10px] text-muted flex-wrap justify-center">
        <span>← → Move</span>
        <span>↑ Rotate</span>
        <span>↓ Soft drop</span>
        <span>Space Hard drop</span>
        <span>P Pause</span>
      </div>
    </div>
  )
}
