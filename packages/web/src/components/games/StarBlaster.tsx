import { useState, useEffect, useCallback, useRef } from 'react'

const WIDTH = 400
const HEIGHT = 500
const SHIP_WIDTH = 30
const SHIP_HEIGHT = 20
const ENEMY_SIZE = 24
const BULLET_SIZE = 4

interface Bullet {
  x: number
  y: number
  dir: number
}

interface Enemy {
  x: number
  y: number
  alive: boolean
}

function createEnemies(): Enemy[] {
  const enemies: Enemy[] = []
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 8; col++) {
      enemies.push({ x: 50 + col * 40, y: 40 + row * 35, alive: true })
    }
  }
  return enemies
}

export default function StarBlaster({ onBack }: { onBack: () => void }) {
  const [shipX, setShipX] = useState(WIDTH / 2 - SHIP_WIDTH / 2)
  const [enemies, setEnemies] = useState<Enemy[]>(createEnemies)
  const [bullets, setBullets] = useState<Bullet[]>([])
  const [enemyBullets, setEnemyBullets] = useState<Bullet[]>([])
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('star_blaster_highscore')
    return saved ? parseInt(saved) : 0
  })
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'won' | 'gameover'>('ready')
  const [enemyDir, setEnemyDir] = useState(1)
  const [level, setLevel] = useState(1)

  const shipRef = useRef(shipX)
  const enemiesRef = useRef(enemies)
  const bulletsRef = useRef(bullets)
  const enemyBulletsRef = useRef(enemyBullets)
  const scoreRef = useRef(score)
  const livesRef = useRef(lives)
  const dirRef = useRef(enemyDir)
  const levelRef = useRef(level)
  const keysRef = useRef<Set<string>>(new Set())
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const enemyShootTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  shipRef.current = shipX
  enemiesRef.current = enemies
  bulletsRef.current = bullets
  enemyBulletsRef.current = enemyBullets
  scoreRef.current = score
  livesRef.current = lives
  dirRef.current = enemyDir
  levelRef.current = level

  const resetGame = useCallback(() => {
    setShipX(WIDTH / 2 - SHIP_WIDTH / 2)
    setEnemies(createEnemies())
    setBullets([])
    setEnemyBullets([])
    setScore(0)
    setLives(3)
    setEnemyDir(1)
    setLevel(1)
    setGameState('ready')
    keysRef.current.clear()
    shipRef.current = WIDTH / 2 - SHIP_WIDTH / 2
    enemiesRef.current = createEnemies()
    bulletsRef.current = []
    enemyBulletsRef.current = []
    scoreRef.current = 0
    livesRef.current = 3
    dirRef.current = 1
    levelRef.current = 1
  }, [])

  const shoot = useCallback(() => {
    const b: Bullet = { x: shipRef.current + SHIP_WIDTH / 2 - BULLET_SIZE / 2, y: HEIGHT - 40, dir: -1 }
    setBullets((prev) => [...prev, b])
  }, [])

  const tick = useCallback(() => {
    const keys = keysRef.current
    const speed = 4

    // Move ship
    let newShipX = shipRef.current
    if (keys.has('ArrowLeft') || keys.has('a')) newShipX -= speed
    if (keys.has('ArrowRight') || keys.has('d')) newShipX += speed
    newShipX = Math.max(0, Math.min(WIDTH - SHIP_WIDTH, newShipX))
    if (newShipX !== shipRef.current) {
      setShipX(newShipX)
      shipRef.current = newShipX
    }

    // Move bullets
    setBullets((prev) => prev.map((b) => ({ ...b, y: b.y + b.dir * 6 })).filter((b) => b.y > -10 && b.y < HEIGHT + 10))

    // Move enemy bullets
    setEnemyBullets((prev) => prev.map((b) => ({ ...b, y: b.y + b.dir * 3 })).filter((b) => b.y > -10 && b.y < HEIGHT + 10))

    // Move enemies
    let dir = dirRef.current
    let hitEdge = false
    setEnemies((prev) => {
      const moved = prev.map((e) => {
        if (!e.alive) return e
        const nx = e.x + dir * (0.5 + levelRef.current * 0.1)
        if (nx < 10 || nx > WIDTH - ENEMY_SIZE - 10) hitEdge = true
        return { ...e, x: nx }
      })
      if (hitEdge) {
        dir = -dir
        dirRef.current = dir
        setEnemyDir(dir)
        const movedDown = moved.map((e) => {
          if (!e.alive) return e
          let ny = e.y + 10
          if (ny > HEIGHT - 60) {
            setGameState('gameover')
            const fs = scoreRef.current
            if (fs > parseInt(localStorage.getItem('star_blaster_highscore') || '0')) {
              localStorage.setItem('star_blaster_highscore', fs.toString())
              setHighScore(fs)
            }
          }
          return { ...e, y: ny }
        })
        return movedDown.map((e) => ({ ...e, x: e.x + dir * (0.5 + levelRef.current * 0.1) }))
      }
      return moved
    })

    // Check bullet-enemy collisions
    const currentBullets = bulletsRef.current
    const currentEnemies = enemiesRef.current
    const hits: number[] = []

    for (const b of currentBullets) {
      for (const e of currentEnemies) {
        if (!e.alive) continue
        if (
          b.x >= e.x && b.x <= e.x + ENEMY_SIZE &&
          b.y >= e.y && b.y <= e.y + ENEMY_SIZE
        ) {
          hits.push(e.x + e.y)
          setBullets((prev) => prev.filter((pb) => pb.x !== b.x || pb.y !== b.y))
          setScore((s) => {
            const ns = s + 10 * levelRef.current
            if (ns > parseInt(localStorage.getItem('star_blaster_highscore') || '0')) {
              localStorage.setItem('star_blaster_highscore', ns.toString())
              setHighScore(ns)
            }
            return ns
          })
          break
        }
      }
    }

    if (hits.length > 0) {
      setEnemies((prev) => prev.map((e) => hits.includes(e.x + e.y) ? { ...e, alive: false } : e))
    }

    // Check enemy bullet-ship collision
    const currentEnemyBullets = enemyBulletsRef.current
    for (const b of currentEnemyBullets) {
      if (
        b.x >= shipRef.current && b.x <= shipRef.current + SHIP_WIDTH &&
        b.y >= HEIGHT - 47 && b.y <= HEIGHT - 27
      ) {
        setEnemyBullets((prev) => [])
        setLives((prev) => {
          const nl = prev - 1
          if (nl <= 0) {
            setGameState('gameover')
            const fs = scoreRef.current
            if (fs > parseInt(localStorage.getItem('star_blaster_highscore') || '0')) {
              localStorage.setItem('star_blaster_highscore', fs.toString())
              setHighScore(fs)
            }
          }
          return nl
        })
        break
      }
    }
  }, [])

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return
    const t = setInterval(tick, 30)
    gameLoopRef.current = t
    return () => { if (t) clearInterval(t) }
  }, [gameState, tick])

  // Enemy shooting
  useEffect(() => {
    if (gameState !== 'playing') return
    const shoot = setInterval(() => {
      const alive = enemiesRef.current.filter((e) => e.alive)
      if (alive.length === 0) {
        setGameState('won')
        const fs = scoreRef.current
        if (fs > parseInt(localStorage.getItem('star_blaster_highscore') || '0')) {
          localStorage.setItem('star_blaster_highscore', fs.toString())
          setHighScore(fs)
        }
        return
      }
      const shooter = alive[Math.floor(Math.random() * alive.length)]
      setEnemyBullets((prev) => [...prev, { x: shooter.x + ENEMY_SIZE / 2 - 1, y: shooter.y + ENEMY_SIZE, dir: 1 }])
    }, 800 - levelRef.current * 50)
    enemyShootTimerRef.current = shoot
    return () => { if (shoot) clearInterval(shoot) }
  }, [gameState])

  // Keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'd'].includes(e.key)) e.preventDefault()
      if (e.key === ' ' && gameState === 'playing') shoot()
      if (e.key === ' ' && gameState === 'ready') setGameState('playing')
      keysRef.current.add(e.key)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [gameState, shoot])

  // Continuous fire while space held
  const spaceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    const check = setInterval(() => {
      if (keysRef.current.has(' ') && gameState === 'playing') shoot()
    }, 200)
    spaceIntervalRef.current = check
    return () => { if (check) clearInterval(check) }
  }, [gameState, shoot])

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

      <div className="relative bg-[#0a0a1a] rounded-2xl p-2 border border-border shadow-sm overflow-hidden">
        <div style={{ width: WIDTH, height: HEIGHT, position: 'relative' }}>
          {/* Stars */}
          {Array.from({ length: 30 }, (_, i) => (
            <div key={`star-${i}`}
              style={{
                position: 'absolute',
                left: Math.random() * WIDTH,
                top: Math.random() * HEIGHT,
                width: 2, height: 2,
              }}
              className="bg-white/20 rounded-full"
            />
          ))}

          {/* Ship */}
          <div style={{
            position: 'absolute', left: shipX, top: HEIGHT - 35,
            width: SHIP_WIDTH, height: SHIP_HEIGHT,
          }}>
            <svg viewBox="0 0 30 20" className="w-full h-full">
              <defs>
                <linearGradient id="shipGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#2dd4bf" />
                </linearGradient>
              </defs>
              <polygon points="15,0 0,20 30,20" fill="url(#shipGrad)" />
              <polygon points="15,3 5,18 25,18" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
              <rect x="13" y="0" width="4" height="6" rx="2" fill="#60a5fa" opacity="0.6" />
            </svg>
          </div>

          {/* Enemies */}
          {enemies.map((e, i) => e.alive && (
            <div key={`e-${i}`}
              style={{
                position: 'absolute', left: e.x, top: e.y,
                width: ENEMY_SIZE, height: ENEMY_SIZE,
              }}
            >
              <svg viewBox="0 0 24 24" className="w-full h-full">
                <rect x="2" y="4" width="20" height="14" rx="4" fill="#ef4444" opacity="0.9" />
                <rect x="2" y="4" width="20" height="6" rx="2" fill="#ef4444" opacity="0.6" />
                <circle cx="8" cy="12" r="2" fill="#fff" />
                <circle cx="16" cy="12" r="2" fill="#fff" />
                <rect x="6" y="16" width="3" height="4" rx="1.5" fill="#ef4444" opacity="0.7" />
                <rect x="15" y="16" width="3" height="4" rx="1.5" fill="#ef4444" opacity="0.7" />
              </svg>
            </div>
          ))}

          {/* Bullets */}
          {bullets.map((b, i) => (
            <div key={`b-${i}`}
              style={{ position: 'absolute', left: b.x, top: b.y, width: BULLET_SIZE, height: 10 }}
              className="bg-gradient-to-b from-cyan-400 to-transparent rounded-full"
            />
          ))}
          {enemyBullets.map((b, i) => (
            <div key={`eb-${i}`}
              style={{ position: 'absolute', left: b.x, top: b.y, width: 4, height: 8 }}
              className="bg-red-400 rounded-full"
            />
          ))}

          {/* Lives */}
          <div style={{ position: 'absolute', left: 8, top: 8 }} className="flex gap-1">
            {Array.from({ length: lives }, (_, i) => (
              <svg key={i} viewBox="0 0 30 20" className="w-4 h-3">
                <polygon points="15,0 0,20 30,20" fill="#38bdf8" opacity="0.6" />
              </svg>
            ))}
          </div>

          {/* Overlays */}
          {gameState === 'ready' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
              <p className="text-white text-sm font-medium">Press Space to start</p>
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
              <p className="text-green-400 text-sm font-bold">Victory!</p>
              <p className="text-white/70 text-xs">Score: {score}</p>
              <button onClick={resetGame}
                className="px-4 py-1.5 rounded-xl text-xs font-medium bg-accent text-accent-content hover:bg-accent-hover transition-all mt-1">
                Play Again
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 text-[10px] text-muted">
        <span>Arrow keys / A,D to move</span>
        <span>Space to shoot</span>
      </div>
    </div>
  )
}
