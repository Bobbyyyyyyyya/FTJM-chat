import { useState, useEffect, useCallback, useRef } from 'react'

const TILE = 20
const COLS = 28
const ROWS = 31

const MAZE = [
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  'X............XX............X',
  'X.XXXX.XXXXX.XX.XXXXX.XXXX.X',
  'XoXXXX.XXXXX.XX.XXXXX.XXXXoX',
  'X.XXXX.XXXXX.XX.XXXXX.XXXX.X',
  'X..........................X',
  'X.XXXX.XX.XXXXXXXX.XX.XXXX.X',
  'X.XXXX.XX.XXXXXXXX.XX.XXXX.X',
  'X......XX....XX....XX......X',
  'XXXXXX.XXXXX XX XXXXX.XXXXXX',
  'XXXXXX.XXXXX XX XXXXX.XXXXXX',
  'XXXXXX.XX          XX.XXXXXX',
  'XXXXXX.XX XXX  XXX XX.XXXXXX',
  'XXXXXX.XX X      X XX.XXXXXX',
  'X....    X        X    ....X',
  'XXXXXX.XX X      X XX.XXXXXX',
  'XXXXXX.XX XXX  XXX XX.XXXXXX',
  'XXXXXX.XX          XX.XXXXXX',
  'XXXXXX.XX XXXXXXXX XX.XXXXXX',
  'XXXXXX.XX XXXXXXXX XX.XXXXXX',
  'X............XX............X',
  'X.XXXX.XXXXX.XX.XXXXX.XXXX.X',
  'X.XXXX.XXXXX.XX.XXXXX.XXXX.X',
  'Xo..XX.......  .......XX..oX',
  'XXX.XX.XX.XXXXXXXX.XX.XX.XXX',
  'XXX.XX.XX.XXXXXXXX.XX.XX.XXX',
  'X......XX....XX....XX......X',
  'X.XXXXXXXXXX.XX.XXXXXXXXXX.X',
  'X.XXXXXXXXXX.XX.XXXXXXXXXX.X',
  'X..........................X',
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
]

const GHOST_COLORS = ['#ff4444', '#ffb8ff', '#44ffff', '#ffb852']

interface Position { x: number; y: number }
interface Ghost { pos: Position; color: string; direction: { x: number; y: number }; scared: boolean }

function getInitialPills(): boolean[][] {
  return MAZE.map((row) => row.split('').map((c) => c === '.' || c === 'o'))
}

function isWall(x: number, y: number): boolean {
  if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return true
  return MAZE[y][x] === 'X'
}

function isPillTile(x: number, y: number): 'dot' | 'power' | 'none' {
  if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return 'none'
  const c = MAZE[y][x]
  if (c === '.') return 'dot'
  if (c === 'o') return 'power'
  return 'none'
}

function getGhostStart(i: number): Position {
  const starts = [
    { x: 13, y: 11 },
    { x: 11, y: 14 },
    { x: 13, y: 14 },
    { x: 15, y: 14 },
  ]
  return starts[i] || { x: 13, y: 11 }
}

export default function PillEater({ onBack }: { onBack: () => void }) {
  const [player, setPlayer] = useState<Position>({ x: 13, y: 23 })
  const [direction, setDirection] = useState<Position>({ x: 0, y: 0 })
  const [nextDir, setNextDir] = useState<Position>({ x: 0, y: 0 })
  const [pills, setPills] = useState<boolean[][]>(getInitialPills)
  const [ghosts, setGhosts] = useState<Ghost[]>(
    Array.from({ length: 4 }, (_, i) => ({
      pos: getGhostStart(i),
      color: GHOST_COLORS[i],
      direction: { x: 0, y: 0 },
      scared: false,
    }))
  )
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('pill_eater_highscore')
    return saved ? parseInt(saved) : 0
  })
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'dead' | 'won' | 'gameover'>('ready')
  const [scaredTimer, setScaredTimer] = useState(0)

  const playerRef = useRef(player)
  const dirRef = useRef(direction)
  const nextDirRef = useRef(nextDir)
  const pillsRef = useRef(pills)
  const ghostsRef = useRef(ghosts)
  const scoreRef = useRef(score)
  const livesRef = useRef(lives)
  const scaredRef = useRef(scaredTimer)
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ghostLoopRef = useRef<ReturnType<typeof setInterval> | null>(null)

  playerRef.current = player
  dirRef.current = direction
  nextDirRef.current = nextDir
  pillsRef.current = pills
  ghostsRef.current = ghosts
  scoreRef.current = score
  livesRef.current = lives
  scaredRef.current = scaredTimer

  const resetGame = useCallback(() => {
    setPlayer({ x: 13, y: 23 })
    setDirection({ x: 0, y: 0 })
    setNextDir({ x: 0, y: 0 })
    setPills(getInitialPills())
    setGhosts(Array.from({ length: 4 }, (_, i) => ({
      pos: getGhostStart(i), color: GHOST_COLORS[i], direction: { x: 0, y: 0 }, scared: false,
    })))
    setScore(0)
    setLives(3)
    setScaredTimer(0)
    setGameState('ready')
    playerRef.current = { x: 13, y: 23 }
    dirRef.current = { x: 0, y: 0 }
    nextDirRef.current = { x: 0, y: 0 }
    pillsRef.current = getInitialPills()
    ghostsRef.current = Array.from({ length: 4 }, (_, i) => ({
      pos: getGhostStart(i), color: GHOST_COLORS[i], direction: { x: 0, y: 0 }, scared: false,
    }))
    scoreRef.current = 0
    livesRef.current = 3
    scaredRef.current = 0
  }, [])

  const movePlayer = useCallback(() => {
    const p = playerRef.current
    const d = dirRef.current
    const nd = nextDirRef.current

    let newX = p.x + nd.x
    let newY = p.y + nd.y
    if (!isWall(newX, newY)) {
      setDirection(nd)
      dirRef.current = nd
    } else {
      newX = p.x + d.x
      newY = p.y + d.y
      if (isWall(newX, newY)) return
    }

    // Wrap around
    if (newX < 0) newX = COLS - 1
    if (newX >= COLS) newX = 0

    const newPos = { x: newX, y: newY }
    setPlayer(newPos)
    playerRef.current = newPos

    // Eat pill
    const tile = isPillTile(newX, newY)
    if (tile !== 'none' && pillsRef.current[newY]?.[newX]) {
      const newPills = pillsRef.current.map((row) => [...row])
      newPills[newY][newX] = false
      setPills(newPills)
      pillsRef.current = newPills

      if (tile === 'power') {
        setScaredTimer(300)
        scaredRef.current = 300
        setGhosts((prev) => prev.map((g) => ({ ...g, scared: true })))
        setScore((s) => { const ns = s + 50; return ns })
      } else {
        setScore((s) => { const ns = s + 10; return ns })
      }
    }
  }, [])

  const moveGhosts = useCallback(() => {
    setGhosts((prev) => {
      return prev.map((ghost) => {
        const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }]
        const opposite = { x: -ghost.direction.x, y: -ghost.direction.y }
        const possible = dirs.filter(
          (d) => {
            const nx = ghost.pos.x + d.x
            const ny = ghost.pos.y + d.y
            return !isWall(nx, ny) && !(d.x === opposite.x && d.y === opposite.y)
          }
        )
        let newDir = ghost.direction
        if (possible.length > 0) {
          newDir = possible[Math.floor(Math.random() * possible.length)]
        } else if (!isWall(ghost.pos.x + opposite.x, ghost.pos.y + opposite.y)) {
          newDir = opposite
        }
        const newPos = {
          x: ghost.pos.x + newDir.x,
          y: ghost.pos.y + newDir.y,
        }

        // Check collision with player
        const p = playerRef.current
        if (newPos.x === p.x && newPos.y === p.y) {
          if (ghost.scared) {
            // Eat ghost - respawn
            const idx = prev.indexOf(ghost)
            setScore((s) => { const ns = s + 200; return ns })
            return { ...ghost, pos: getGhostStart(idx), direction: { x: 0, y: 0 }, scared: false }
          } else if (gameState === 'playing') {
            setGameState('dead')
          }
        }

        return { ...ghost, pos: newPos, direction: newDir }
      })
    })
  }, [gameState])

  // Scared timer
  useEffect(() => {
    if (scaredTimer <= 0) return
    if (gameState !== 'playing') return
    const t = setInterval(() => {
      setScaredTimer((prev) => {
        const next = prev - 1
        if (next <= 0) {
          setGhosts((g) => g.map((gh) => ({ ...gh, scared: false })))
          return 0
        }
        return next
      })
      scaredRef.current = scaredTimer - 1
    }, 100)
    return () => clearInterval(t)
  }, [scaredTimer > 0, gameState])

  // Player movement
  useEffect(() => {
    if (gameState !== 'playing') return
    const t = setInterval(movePlayer, 120)
    gameLoopRef.current = t
    return () => { if (t) clearInterval(t) }
  }, [gameState, movePlayer])

  // Ghost movement
  useEffect(() => {
    if (gameState !== 'playing') return
    const t = setInterval(moveGhosts, 200)
    ghostLoopRef.current = t
    return () => { if (t) clearInterval(t) }
  }, [gameState, moveGhosts])

  // Keys
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
      }
      if (gameState === 'ready') {
        setGameState('playing')
        return
      }
      if (gameState === 'dead' || gameState === 'gameover' || gameState === 'won') return

      let nd = dirRef.current
      switch (e.key) {
        case 'ArrowUp': nd = { x: 0, y: -1 }; break
        case 'ArrowDown': nd = { x: 0, y: 1 }; break
        case 'ArrowLeft': nd = { x: -1, y: 0 }; break
        case 'ArrowRight': nd = { x: 1, y: 0 }; break
      }
      setNextDir(nd)
      nextDirRef.current = nd
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [gameState])

  // Check win
  useEffect(() => {
    if (gameState !== 'playing') return
    const hasPills = pillsRef.current.some((row) => row.some((p) => p))
    if (!hasPills) {
      setGameState('won')
      const finalScore = scoreRef.current
      if (finalScore > parseInt(localStorage.getItem('pill_eater_highscore') || '0')) {
        localStorage.setItem('pill_eater_highscore', finalScore.toString())
        setHighScore(finalScore)
      }
    }
  }, [pills, gameState])

  // Handle death
  useEffect(() => {
    if (gameState !== 'dead') return
    const newLives = livesRef.current - 1
    setLives(newLives)
    if (newLives <= 0) {
      setGameState('gameover')
      const finalScore = scoreRef.current
      if (finalScore > parseInt(localStorage.getItem('pill_eater_highscore') || '0')) {
        localStorage.setItem('pill_eater_highscore', finalScore.toString())
        setHighScore(finalScore)
      }
    } else {
      setTimeout(() => {
        setPlayer({ x: 13, y: 23 })
        setDirection({ x: 0, y: 0 })
        setNextDir({ x: 0, y: 0 })
        playerRef.current = { x: 13, y: 23 }
        dirRef.current = { x: 0, y: 0 }
        nextDirRef.current = { x: 0, y: 0 }
        setGhosts((prev) => prev.map((g, i) => ({ ...g, pos: getGhostStart(i), direction: { x: 0, y: 0 }, scared: false })))
        setScaredTimer(0)
        scaredRef.current = 0
        setGameState('playing')
      }, 1000)
    }
  }, [gameState])

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="flex items-center justify-between w-full max-w-[560px]">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-muted text-secondary hover:bg-surface-hover transition-all">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            {Array.from({ length: lives }, (_, i) => (
              <span key={i} className="text-yellow-400">●</span>
            ))}
          </div>
          <span className="text-secondary">Score: <span className="text-primary font-bold">{score}</span></span>
          <span className="text-muted">Best: <span className="text-accent font-bold">{highScore}</span></span>
        </div>
        <button onClick={resetGame}
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-accent text-accent-content hover:bg-accent-hover transition-all">
          Reset
        </button>
      </div>

      <div className="relative bg-[#0f0f23] rounded-2xl p-2 border border-border shadow-sm">
        <div style={{ width: COLS * TILE, height: ROWS * TILE, position: 'relative' }}>
          {MAZE.map((row, y) =>
            row.split('').map((cell, x) => {
              if (cell === 'X') {
                const isH = row[x - 1] === 'X' && row[x + 1] === 'X'
                const isV = (y > 0 && MAZE[y - 1][x] === 'X') && (y < ROWS - 1 && MAZE[y + 1][x] === 'X')
                return (
                  <div key={`w-${x}-${y}`}
                    style={{
                      position: 'absolute', left: x * TILE, top: y * TILE,
                      width: TILE, height: TILE,
                    }}
                    className={`${isH ? 'border-l border-r border-blue-900/40' : ''} ${isV ? 'border-t border-b border-blue-900/40' : ''} ${!isH && !isV ? 'bg-blue-900/20 rounded-sm' : ''}`}
                  >
                    {(isH || isV) && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-1 h-1 rounded-full bg-blue-400/30" />
                      </div>
                    )}
                  </div>
                )
              }
              if (cell === '.') {
                return pills[y]?.[x] ? (
                  <div key={`p-${x}-${y}`}
                    style={{ position: 'absolute', left: x * TILE, top: y * TILE, width: TILE, height: TILE }}
                    className="flex items-center justify-center"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-200/70" />
                  </div>
                ) : null
              }
              if (cell === 'o') {
                return pills[y]?.[x] ? (
                  <div key={`o-${x}-${y}`}
                    style={{ position: 'absolute', left: x * TILE, top: y * TILE, width: TILE, height: TILE }}
                    className="flex items-center justify-center"
                  >
                    <div className="w-3 h-3 rounded-full bg-yellow-200/80 animate-pulse" />
                  </div>
                ) : null
              }
              return null
            })
          )}

          {/* Ghosts */}
          {ghosts.map((ghost, i) => (
            <div key={`g-${i}`}
              style={{
                position: 'absolute', left: ghost.pos.x * TILE, top: ghost.pos.y * TILE,
                width: TILE, height: TILE,
                transition: 'left 0.2s, top 0.2s',
              }}
              className="flex items-center justify-center"
            >
              <div style={{
                width: 16, height: 16, borderRadius: '8px 8px 4px 4px',
                backgroundColor: ghost.scared ? '#4444ff' : ghost.color,
                opacity: ghost.scared && scaredTimer < 100 && Math.floor(scaredTimer / 10) % 2 === 0 ? 0.5 : 1,
              }} />
            </div>
          ))}

          {/* Player */}
          <div
            style={{
              position: 'absolute', left: player.x * TILE, top: player.y * TILE,
              width: TILE, height: TILE,
              transition: 'left 0.12s, top 0.12s',
            }}
            className="flex items-center justify-center"
          >
            <div className="w-4 h-4 rounded-full bg-yellow-400 shadow-lg shadow-yellow-400/50" />
          </div>

          {/* Overlays */}
          {gameState === 'ready' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
              <p className="text-white text-sm font-medium">Press any arrow to start</p>
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
          {gameState === 'won' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-xl gap-1">
              <p className="text-yellow-400 text-sm font-bold">You Win!</p>
              <p className="text-white/70 text-xs">Score: {score}</p>
              <button onClick={resetGame}
                className="px-4 py-1.5 rounded-xl text-xs font-medium bg-accent text-accent-content hover:bg-accent-hover transition-all mt-1">
                Play Again
              </button>
            </div>
          )}
          {gameState === 'dead' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
              <p className="text-white text-sm font-medium">Lost a life...</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 text-[10px] text-muted">
        <span>Arrow keys to move</span>
        <span>Collect all dots to win</span>
      </div>
    </div>
  )
}
