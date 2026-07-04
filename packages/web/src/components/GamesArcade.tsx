import { useState } from 'react'
import { motion } from 'motion/react'
import Snake from './games/Snake'
import TicTacToe from './games/TicTacToe'
import MemoryMatch from './games/MemoryMatch'
import PillEater from './games/PillEater'
import StarBlaster from './games/StarBlaster'
import BlockStacker from './games/BlockStacker'

type GameId = 'snake' | 'tictactoe' | 'memory' | 'pilleater' | 'starblaster' | 'blockstacker'

interface GameDefinition {
  id: GameId
  title: string
  description: string
  icon: React.ReactNode
  color: string
  gradient: string
}

const games: GameDefinition[] = [
  {
    id: 'snake',
    title: 'Snake',
    description: 'Classic snake game. Eat food, grow, and avoid walls!',
    color: 'from-emerald-500 to-teal-400',
    gradient: 'from-emerald-400/20 to-teal-400/10',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" className="text-emerald-400" fill="currentColor" fillOpacity="0.2" />
        <path d="M12 6v4l3 3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400" />
        <circle cx="12" cy="6" r="1.5" fill="currentColor" className="text-emerald-400" />
      </svg>
    ),
  },
  {
    id: 'tictactoe',
    title: 'Tic-Tac-Toe',
    description: 'Classic 3x3 grid. Play with a friend or against AI!',
    color: 'from-violet-500 to-purple-400',
    gradient: 'from-violet-400/20 to-purple-400/10',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M6 6l12 12M18 6l-12 12" strokeLinecap="round" className="text-violet-400" />
        <rect x="3" y="3" width="18" height="18" rx="3" className="text-violet-400" fill="currentColor" fillOpacity="0.1" />
      </svg>
    ),
  },
  {
    id: 'memory',
    title: 'Memory Match',
    description: 'Match pairs of emojis. Test your memory!',
    color: 'from-amber-500 to-orange-400',
    gradient: 'from-amber-400/20 to-orange-400/10',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="2" y="3" width="20" height="18" rx="3" className="text-amber-400" fill="currentColor" fillOpacity="0.1" />
        <path d="M8 10h8M8 14h5M8 18h2" strokeLinecap="round" className="text-amber-400" />
      </svg>
    ),
  },
  {
    id: 'pilleater',
    title: 'Pill Eater',
    description: 'Navigate a maze, collect pills, and dodge ghosts!',
    color: 'from-yellow-500 to-amber-400',
    gradient: 'from-yellow-400/20 to-amber-400/10',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="10" className="text-yellow-400" fill="currentColor" fillOpacity="0.1" />
        <path d="M12 6v6l4 4" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400" />
        <circle cx="12" cy="12" r="2" fill="currentColor" className="text-yellow-400" />
      </svg>
    ),
  },
  {
    id: 'starblaster',
    title: 'Star Blaster',
    description: 'Defend against alien invaders in this space shooter!',
    color: 'from-cyan-500 to-blue-400',
    gradient: 'from-cyan-400/20 to-blue-400/10',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7z" className="text-cyan-400" fill="currentColor" fillOpacity="0.15" />
      </svg>
    ),
  },
  {
    id: 'blockstacker',
    title: 'Block Stacker',
    description: 'Stack falling blocks and clear lines in this puzzle classic!',
    color: 'from-pink-500 to-rose-400',
    gradient: 'from-pink-400/20 to-rose-400/10',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="3" y="3" width="18" height="18" rx="3" className="text-pink-400" fill="currentColor" fillOpacity="0.1" />
        <path d="M3 9h18M3 15h18M9 3v18M15 3v18" strokeLinecap="round" className="text-pink-400" />
      </svg>
    ),
  },
]

export default function GamesArcade() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null)

  if (activeGame === 'snake') return <Snake onBack={() => setActiveGame(null)} />
  if (activeGame === 'tictactoe') return <TicTacToe onBack={() => setActiveGame(null)} />
  if (activeGame === 'memory') return <MemoryMatch onBack={() => setActiveGame(null)} />
  if (activeGame === 'pilleater') return <PillEater onBack={() => setActiveGame(null)} />
  if (activeGame === 'starblaster') return <StarBlaster onBack={() => setActiveGame(null)} />
  if (activeGame === 'blockstacker') return <BlockStacker onBack={() => setActiveGame(null)} />

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-8"
        >
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-accent items-center justify-center mb-4 shadow-lg shadow-accent/20">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-primary">Games Arcade</h2>
          <p className="text-sm text-muted mt-1.5 max-w-sm mx-auto">
            Pick a classic game to play
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game, index) => (
            <motion.button
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveGame(game.id)}
              className="text-left bg-surface rounded-2xl border border-border p-5 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300"
            >
              <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${game.gradient} flex items-center justify-center mb-4 border border-border/50`}>
                {game.icon}
              </div>
              <h3 className="text-base font-bold text-primary mb-1">{game.title}</h3>
              <p className="text-xs text-muted leading-relaxed">{game.description}</p>
              <div className={`mt-4 h-1 w-12 rounded-full bg-gradient-to-r ${game.color}`} />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}
