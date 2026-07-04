import { useState, useEffect, useCallback, useRef } from 'react'

const GRID_SIZE = 20
const CELL_SIZE = 20
const INITIAL_SPEED = 150

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type Position = { x: number; y: number }

function getInitialSnake(): Position[] {
  const mid = Math.floor(GRID_SIZE / 2)
  return [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ]
}

function getRandomFood(snake: Position[]): Position {
  let pos: Position
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    }
  } while (snake.some((s) => s.x === pos.x && s.y === pos.y))
  return pos
}

export default function Snake({ onBack }: { onBack: () => void }) {
  const [snake, setSnake] = useState<Position[]>(getInitialSnake)
  const [food, setFood] = useState<Position>(getRandomFood(getInitialSnake()))
  const [direction, setDirection] = useState<Direction>('RIGHT')
  const [nextDirection, setNextDirection] = useState<Direction>('RIGHT')
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [isStarted, setIsStarted] = useState(false)
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snake_highscore')
    return saved ? parseInt(saved) : 0
  })
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const snakeRef = useRef(snake)
  const foodRef = useRef(food)
  const dirRef = useRef(direction)
  const nextDirRef = useRef(nextDirection)
  const gameOverRef = useRef(gameOver)

  snakeRef.current = snake
  foodRef.current = food
  dirRef.current = direction
  nextDirRef.current = nextDirection
  gameOverRef.current = gameOver

  const reset = useCallback(() => {
    if (gameLoopRef.current) { clearInterval(gameLoopRef.current); gameLoopRef.current = null }
    const initial = getInitialSnake()
    setSnake(initial)
    setFood(getRandomFood(initial))
    setDirection('RIGHT')
    setNextDirection('RIGHT')
    setGameOver(false)
    setScore(0)
    setIsStarted(false)
    dirRef.current = 'RIGHT'
    nextDirRef.current = 'RIGHT'
    gameOverRef.current = false
  }, [])

  const tick = useCallback(() => {
    if (gameOverRef.current) return

    const currentSnake = snakeRef.current
    dirRef.current = nextDirRef.current
    const dir = dirRef.current

    const head = currentSnake[0]
    const newHead = { ...head }
    switch (dir) {
      case 'UP': newHead.y -= 1; break
      case 'DOWN': newHead.y += 1; break
      case 'LEFT': newHead.x -= 1; break
      case 'RIGHT': newHead.x += 1; break
    }

    if (
      newHead.x < 0 || newHead.x >= GRID_SIZE ||
      newHead.y < 0 || newHead.y >= GRID_SIZE ||
      currentSnake.some((s) => s.x === newHead.x && s.y === newHead.y)
    ) {
      setGameOver(true)
      gameOverRef.current = true
      if (gameLoopRef.current) { clearInterval(gameLoopRef.current); gameLoopRef.current = null }
      setScore((s) => {
        const finalScore = s
        if (finalScore > parseInt(localStorage.getItem('snake_highscore') || '0')) {
          localStorage.setItem('snake_highscore', finalScore.toString())
          setHighScore(finalScore)
        }
        return finalScore
      })
      return
    }

    const ate = newHead.x === foodRef.current.x && newHead.y === foodRef.current.y
    const newSnake = [newHead, ...currentSnake]
    if (!ate) newSnake.pop()

    setSnake(newSnake)
    snakeRef.current = newSnake

    if (ate) {
      setScore((s) => {
        const ns = s + 10
        if (ns > parseInt(localStorage.getItem('snake_highscore') || '0')) {
          localStorage.setItem('snake_highscore', ns.toString())
          setHighScore(ns)
        }
        return ns
      })
      setFood(getRandomFood(newSnake))
      foodRef.current = getRandomFood(newSnake)
    }
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
      }
      if (!isStarted && !gameOver) {
        setIsStarted(true)
        return
      }

      const opposite: Record<Direction, Direction> = {
        UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
      }
      let newDir: Direction | null = null
      switch (e.key) {
        case 'ArrowUp': newDir = 'UP'; break
        case 'ArrowDown': newDir = 'DOWN'; break
        case 'ArrowLeft': newDir = 'LEFT'; break
        case 'ArrowRight': newDir = 'RIGHT'; break
      }
      if (newDir && newDir !== opposite[nextDirRef.current]) {
        setNextDirection(newDir)
        nextDirRef.current = newDir
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isStarted, gameOver])

  useEffect(() => {
    if (isStarted && !gameOver) {
      gameLoopRef.current = setInterval(tick, INITIAL_SPEED)
    }
    return () => {
      if (gameLoopRef.current) { clearInterval(gameLoopRef.current); gameLoopRef.current = null }
    }
  }, [isStarted, gameOver, tick])

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="flex items-center justify-between w-full max-w-[400px]">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-muted text-secondary hover:bg-surface-hover transition-all">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex items-center gap-4">
          <div className="text-xs text-secondary">
            Score: <span className="text-primary font-bold">{score}</span>
          </div>
          <div className="text-xs text-muted">
            Best: <span className="text-accent font-bold">{highScore}</span>
          </div>
        </div>
        <button onClick={reset}
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-accent text-accent-content hover:bg-accent-hover transition-all">
          Reset
        </button>
      </div>

      <div className="relative bg-surface-muted rounded-2xl p-3 border border-border shadow-sm">
        <div
          style={{
            width: GRID_SIZE * CELL_SIZE,
            height: GRID_SIZE * CELL_SIZE,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {!isStarted && !gameOver && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-muted/80 rounded-lg">
              <p className="text-sm text-secondary font-medium">Press any arrow key to start</p>
            </div>
          )}
          {gameOver && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface-muted/80 rounded-lg gap-2">
              <p className="text-sm font-bold text-red-400">Game Over!</p>
              <p className="text-xs text-muted">Score: {score}</p>
              <button onClick={reset}
                className="px-4 py-1.5 rounded-xl text-xs font-medium bg-accent text-accent-content hover:bg-accent-hover transition-all mt-1">
                Play Again
              </button>
            </div>
          )}
          <div style={{ position: 'relative' }}>
            {snake.map((seg, i) => (
              <div
                key={`${seg.x}-${seg.y}-${i}`}
                style={{
                  position: 'absolute',
                  left: seg.x * CELL_SIZE,
                  top: seg.y * CELL_SIZE,
                  width: CELL_SIZE - 1,
                  height: CELL_SIZE - 1,
                  borderRadius: i === 0 ? '4px' : '2px',
                  transition: 'none',
                }}
                className={i === 0 ? 'bg-accent' : 'bg-accent/70'}
              />
            ))}
            <div
              style={{
                position: 'absolute',
                left: food.x * CELL_SIZE,
                top: food.y * CELL_SIZE,
                width: CELL_SIZE - 1,
                height: CELL_SIZE - 1,
                borderRadius: '50%',
              }}
              className="bg-red-400 animate-pulse"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2 text-[10px] text-muted">
        <span>Arrow keys to move</span>
      </div>
    </div>
  )
}
