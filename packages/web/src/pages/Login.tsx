import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'motion/react'
import type { User } from '@ftjm/shared'

function FloatingOrb({ delay, size, x, y, duration }: { delay: number; size: number; x: number; y: number; duration: number }) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        top: `${y}%`,
        background: 'radial-gradient(circle, rgba(59,130,246,0.4) 0%, rgba(37,99,235,0.1) 50%, transparent 70%)',
        filter: 'blur(40px)',
      }}
      animate={{
        x: [0, 80, -60, 40, 0],
        y: [0, -100, 60, -40, 0],
        scale: [1, 1.2, 0.9, 1.1, 1],
        opacity: [0.3, 0.6, 0.4, 0.5, 0.3],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}

function GridLines() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Horizontal lines */}
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={`h-${i}`}
          className="absolute h-px w-full"
          style={{
            top: `${(i + 1) * 8}%`,
            background: 'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.08) 20%, rgba(59,130,246,0.15) 50%, rgba(59,130,246,0.08) 80%, transparent 100%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 4, delay: i * 0.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {/* Vertical lines */}
      {Array.from({ length: 16 }).map((_, i) => (
        <motion.div
          key={`v-${i}`}
          className="absolute w-px h-full"
          style={{
            left: `${(i + 1) * 6}%`,
            background: 'linear-gradient(180deg, transparent 0%, rgba(59,130,246,0.08) 20%, rgba(59,130,246,0.15) 50%, rgba(59,130,246,0.08) 80%, transparent 100%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 5, delay: i * 0.15, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

function GlowParticle({ index }: { index: number }) {
  const size = 2 + Math.random() * 3
  const startX = Math.random() * 100
  const startY = Math.random() * 100

  return (
    <motion.div
      className="absolute rounded-full bg-blue-400/60"
      style={{
        width: size,
        height: size,
        left: `${startX}%`,
        top: `${startY}%`,
        boxShadow: `0 0 ${size * 3}px rgba(59,130,246,0.5)`,
      }}
      animate={{
        y: [0, -200 - Math.random() * 300],
        x: [0, (Math.random() - 0.5) * 100],
        opacity: [0, 0.8, 0],
        scale: [0.5, 1, 0.3],
      }}
      transition={{
        duration: 6 + Math.random() * 6,
        delay: index * 0.8,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSignup, setIsSignup] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [profilePreview, setProfilePreview] = useState<User | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [showPiracyWarning, setShowPiracyWarning] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const { login, signup } = useAuthStore()

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)

  const isPiracyName = (name: string): boolean => {
    const n = name.toLowerCase().replace(/[^a-z0-9]/g, '')
    const blocked = [
      // === JONATECH ===
      'jonatech', 'jonateck', 'jonatek', 'jonateq', 'jonatex', 'jonatechh',
      'jonateccc', 'jonatecch', 'jonatecchh', 'jonatecc', 'jonnatech',
      'jonatechh', 'jonatec', 'jonatech', 'j0natech', 'jon4tech',
      'jonatezh', 'jonat3ch', 'jonat3ck', 'jon4tek', 'jonatexh',
      'jonateccch', 'jonatechx', 'jonatechz', 'jonatech1', 'jonatech2',
      'xjonatech', 'jonatechx', 'ijonatech', 'jonatechi',
      'jonatechmarko', 'jonatechmarco', 'jonatechmarkohoksen',
      'jonatechmarcohoksen', 'jonatechmarcohoksen',

      // === MARKO ===
      'marko', 'marco', 'markoo', 'marccoo', 'marrko', 'marcko',
      'maarko', 'markoo', 'm4rko', 'm4rco', 'mark0', 'marc0',
      'marqo', 'marqoo', 'maarkoo', 'mmarko', 'markko', 'marckoo',
      'xmarko', 'markox', 'imarko', 'markoi',

      // === HOKSEN ===
      'hoksen', 'hokksen', 'hoxen', 'hokssen', 'hokkssen', 'hokseenn',
      'hoksen', 'h0ksen', 'hokz3n', 'hoksen', 'hokseenn', 'hokksenn',
      'xhoksen', 'hoksenx', 'ihoksen', 'hokseni',
      'hoxxen', 'hokzen', 'hoksen', 'hokssenn',

      // === COMBOS / FULL NAMES ===
      'jonatechmarko', 'jonatechmarco', 'jonatechm4rko',
      'jonatechm4rco', 'j0natechmarko', 'j0natechmarco',
      'jon4techmarko', 'jon4techmarco', 'jonatechmarkohoksen',
      'jonatechmarcohoksen', 'jonatechm4rk0h0ksen',
      'jmh', 'jmho', 'jmk', 'jonatechmh',
      'jonatech.marko.hoksen', 'jonatech-marko-hoksen',
      'jonatech_marko_hoksen', 'jonatechmarkohoksen',
    ]
    return blocked.some((v) => n.includes(v))
  }

  useEffect(() => {
    if (!email.trim() || isSignup) {
      setProfilePreview(null)
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLookingUp(true)
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email.trim())
          .maybeSingle()
        setProfilePreview(data || null)
      } catch {
        setProfilePreview(null)
      } finally {
        setLookingUp(false)
      }
    }, 500)
    return () => clearTimeout(debounceRef.current)
  }, [email, isSignup])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!isValidEmail(email.trim())) {
      setError('Voer een geldig e-mailadres in')
      return
    }
    setIsLoading(true)
    try {
      if (isSignup) {
        if (isPiracyName(displayName)) {
          setShowPiracyWarning(true)
          setIsLoading(false)
          return
        }
        await signup(email, password, displayName)
      } else {
        await login(email, password)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, #020617 0%, #0c1a3a 25%, #0f2847 50%, #0c1a3a 75%, #020617 100%)',
    }}>
      {/* Animated blue gradient overlay */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            'radial-gradient(ellipse at 20% 50%, rgba(37,99,235,0.15) 0%, transparent 60%)',
            'radial-gradient(ellipse at 80% 30%, rgba(59,130,246,0.2) 0%, transparent 60%)',
            'radial-gradient(ellipse at 40% 80%, rgba(37,99,235,0.15) 0%, transparent 60%)',
            'radial-gradient(ellipse at 20% 50%, rgba(37,99,235,0.15) 0%, transparent 60%)',
          ],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Second animated layer */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            'radial-gradient(ellipse at 70% 20%, rgba(59,130,246,0.12) 0%, transparent 50%)',
            'radial-gradient(ellipse at 30% 70%, rgba(37,99,235,0.18) 0%, transparent 50%)',
            'radial-gradient(ellipse at 80% 80%, rgba(59,130,246,0.12) 0%, transparent 50%)',
            'radial-gradient(ellipse at 70% 20%, rgba(59,130,246,0.12) 0%, transparent 50%)',
          ],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Floating orbs */}
      <FloatingOrb delay={0} size={300} x={10} y={20} duration={20} />
      <FloatingOrb delay={3} size={250} x={70} y={60} duration={25} />
      <FloatingOrb delay={6} size={200} x={40} y={70} duration={18} />
      <FloatingOrb delay={9} size={350} x={80} y={10} duration={22} />
      <FloatingOrb delay={2} size={180} x={20} y={80} duration={16} />

      {/* Grid lines */}
      <GridLines />

      {/* Floating particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <GlowParticle key={i} index={i} />
      ))}

      {/* Horizontal scan line */}
      <motion.div
        className="absolute left-0 right-0 h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.3) 30%, rgba(59,130,246,0.5) 50%, rgba(59,130,246,0.3) 70%, transparent 100%)',
        }}
        animate={{ y: ['-10vh', '110vh'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm z-10"
      >
        {/* Glow behind card */}
        <div className="absolute -inset-1 rounded-3xl opacity-50 blur-xl"
          style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(37,99,235,0.15), rgba(59,130,246,0.3))' }} />

        {/* Card */}
        <div className="relative rounded-3xl border border-blue-500/20 p-8 backdrop-blur-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(15,23,42,0.9) 50%, rgba(15,23,42,0.8) 100%)',
            boxShadow: '0 0 60px rgba(37,99,235,0.1), 0 25px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(59,130,246,0.1)',
          }}
        >
          {/* Brand */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotateY: 180 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="inline-block mb-5"
            >
              <div className="relative">
                {/* Glow behind logo */}
                <motion.div
                  className="absolute -inset-3 rounded-2xl"
                  animate={{
                    boxShadow: [
                      '0 0 30px rgba(59,130,246,0.4), 0 0 60px rgba(37,99,235,0.2)',
                      '0 0 40px rgba(59,130,246,0.6), 0 0 80px rgba(37,99,235,0.3)',
                      '0 0 30px rgba(59,130,246,0.4), 0 0 60px rgba(37,99,235,0.2)',
                    ],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="relative h-16 w-16 rounded-2xl flex items-center justify-center mx-auto overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
                    border: '1px solid rgba(59,130,246,0.3)',
                  }}>
                  <svg viewBox="0 0 512 512" className="h-11 w-11">
                    <defs>
                      <linearGradient id="loginAccent" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#60a5fa"/>
                        <stop offset="100%" stopColor="#3b82f6"/>
                      </linearGradient>
                      <linearGradient id="loginFg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffffff"/>
                        <stop offset="100%" stopColor="#e2e8f0"/>
                      </linearGradient>
                    </defs>
                    <rect x="0" y="0" width="512" height="512" rx="88" fill="#0f172a"/>
                    <ellipse cx="256" cy="240" rx="140" ry="120" fill="url(#loginAccent)" opacity="0.12"/>
                    <rect x="172" y="380" width="168" height="6" rx="3" fill="url(#loginAccent)"/>
                    <g transform="translate(-4,-18)">
                      <path d="M186 148h156v48h-102v64h88v46h-88v106h-54V148z" fill="url(#loginFg)"/>
                      <path d="M186 148h156v48h-102v64h88v46h-88v106h-54V148z" fill="url(#loginAccent)" opacity="0.35" transform="translate(3,3)"/>
                    </g>
                  </svg>
                </div>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-2xl font-bold tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              FTJM Chat
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-sm text-blue-300/60 mt-1.5"
            >
              {isSignup ? 'Create your account' : 'Welcome back'}
            </motion.p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                className="text-sm px-4 py-3 rounded-2xl mb-5 flex items-center gap-2.5"
                style={{
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.05))',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#fca5a5',
                }}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {isSignup && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <label className="block text-xs font-semibold text-blue-300/70 mb-1.5 uppercase tracking-wider">
                    Display Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      onFocus={() => setFocusedField('displayName')}
                      onBlur={() => setFocusedField(null)}
                      className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-blue-300/30 outline-none transition-all duration-300"
                      style={{
                        background: focusedField === 'displayName'
                          ? 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(37,99,235,0.06))'
                          : 'rgba(30,58,95,0.3)',
                        border: `1px solid ${focusedField === 'displayName' ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.1)'}`,
                        boxShadow: focusedField === 'displayName' ? '0 0 20px rgba(59,130,246,0.1)' : 'none',
                      }}
                      placeholder="Your name"
                      required
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-xs font-semibold text-blue-300/70 mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-blue-300/30 outline-none transition-all duration-300"
                  style={{
                    background: focusedField === 'email'
                      ? 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(37,99,235,0.06))'
                      : 'rgba(30,58,95,0.3)',
                    border: `1px solid ${email.trim() && !isValidEmail(email) ? 'rgba(239,68,68,0.5)' : focusedField === 'email' ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.1)'}`,
                    boxShadow: focusedField === 'email' ? '0 0 20px rgba(59,130,246,0.1)' : 'none',
                  }}
                  placeholder="you@example.com"
                  required
                />
                {email.trim() && !isValidEmail(email) && (
                  <p className="text-[11px] text-red-400/80 mt-1.5">Ongeldig e-mailadres</p>
                )}
              </div>
            </div>

            {/* Profile preview */}
            {!isSignup && email.trim() && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(37,99,235,0.04))',
                  border: '1px solid rgba(59,130,246,0.1)',
                }}
              >
                {lookingUp ? (
                  <div className="h-10 w-10 rounded-full animate-pulse shrink-0"
                    style={{ background: 'rgba(59,130,246,0.1)' }} />
                ) : profilePreview ? (
                  <>
                    {profilePreview.photo_url ? (
                      <img src={profilePreview.photo_url} alt="" className="h-10 w-10 rounded-full object-cover shrink-0 ring-2 ring-blue-500/30" />
                    ) : (
                      <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 ring-2 ring-blue-500/30"
                        style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                        <span className="text-sm font-bold text-white">
                          {(profilePreview.display_name || '?')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {profilePreview.display_name || profilePreview.email}
                      </p>
                      <p className="text-xs text-blue-300/50">{profilePreview.email}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-blue-300/40">No account found with this email</p>
                )}
              </motion.div>
            )}

            {!isSignup && (
              <div>
                <label className="block text-xs font-semibold text-blue-300/70 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-blue-300/30 outline-none transition-all duration-300"
                    style={{
                      background: focusedField === 'password'
                        ? 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(37,99,235,0.06))'
                        : 'rgba(30,58,95,0.3)',
                      border: `1px solid ${focusedField === 'password' ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.1)'}`,
                      boxShadow: focusedField === 'password' ? '0 0 20px rgba(59,130,246,0.1)' : 'none',
                    }}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            )}

            {isSignup && (
              <div>
                <label className="block text-xs font-semibold text-blue-300/70 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('signupPassword')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-blue-300/30 outline-none transition-all duration-300"
                    style={{
                      background: focusedField === 'signupPassword'
                        ? 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(37,99,235,0.06))'
                        : 'rgba(30,58,95,0.3)',
                      border: `1px solid ${focusedField === 'signupPassword' ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.1)'}`,
                      boxShadow: focusedField === 'signupPassword' ? '0 0 20px rgba(59,130,246,0.1)' : 'none',
                    }}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            )}

            <AnimatePresence mode="wait">
              {isSignup && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-start gap-2.5"
                >
                  <input
                    type="checkbox"
                    id="terms"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 rounded border-blue-500/30 bg-blue-500/10 text-blue-500 focus:ring-blue-500/30 shrink-0"
                  />
                  <label htmlFor="terms" className="text-xs text-blue-300/60 leading-relaxed">
                    I agree to the{' '}
                    <a
                      href="https://ais-pre-3d4qy6xrtw5vtu4g3hs7yo-160997107127.europe-west3.run.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
                    >
                      Terms of Service
                    </a>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={isLoading || !isValidEmail(email.trim()) || (isSignup && !agreedToTerms)}
              whileHover={{ scale: 1.01, boxShadow: '0 0 40px rgba(59,130,246,0.4)' }}
              whileTap={{ scale: 0.98 }}
              className="w-full font-semibold py-3 rounded-xl text-white text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #2563eb 100%)',
                backgroundSize: '200% 100%',
                boxShadow: '0 0 30px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
              }}
            >
              {/* Button shimmer */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
                }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              />
              <span className="relative z-10">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading...
                  </span>
                ) : isSignup ? 'Sign Up' : 'Login'}
              </span>
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => { setIsSignup(!isSignup); setError(''); setProfilePreview(null); setPassword(''); setDisplayName('') }}
              className="text-sm text-blue-300/40 hover:text-blue-300 transition-colors font-medium"
            >
              {isSignup
                ? 'Already have an account? '
                : "Don't have an account? "}
              <span className="text-blue-400 font-semibold">
                {isSignup ? 'Login' : 'Sign up'}
              </span>
            </button>
          </div>

          {/* Bottom accent line */}
          <motion.div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)',
              width: '60%',
            }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(2,6,23,0.8), transparent)' }} />

      {/* Anti Name Piracy Warning */}
      <AnimatePresence>
        {showPiracyWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,0.85)' }}
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -5 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.5, rotate: 5 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              className="relative max-w-lg w-full text-center p-10 rounded-3xl"
              style={{
                background: 'linear-gradient(135deg, rgba(220,38,38,0.15), rgba(220,38,38,0.05))',
                border: '2px solid rgba(220,38,38,0.4)',
                boxShadow: '0 0 80px rgba(220,38,38,0.3), 0 0 200px rgba(220,38,38,0.1)',
              }}
            >
              {/* Warning icon */}
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
                style={{
                  background: 'linear-gradient(135deg, rgba(220,38,38,0.3), rgba(220,38,38,0.1))',
                  border: '2px solid rgba(220,38,38,0.5)',
                }}
              >
                <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </motion.div>

              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-extrabold mb-3"
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #f87171)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                NAME PIRACY DETECTED
              </motion.h2>

              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="text-base mb-2"
                style={{ color: '#fca5a5' }}
              >
                Het gebruik van de naam <span className="font-bold text-red-300">"Jonatech Marko Hoksen"</span> of variaties daarvan is niet toegestaan.
              </motion.p>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-sm mb-8"
                style={{ color: '#f87171' }}
              >
                Kies een andere display name om door te gaan.
              </motion.p>

              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.65 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { setShowPiracyWarning(false); setDisplayName('') }}
                className="px-8 py-3 rounded-xl font-semibold text-white text-sm transition-all"
                style={{
                  background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                  boxShadow: '0 0 30px rgba(220,38,38,0.3)',
                }}
              >
                Ik begrijp het
              </motion.button>

              {/* Decorative scan lines */}
              <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none opacity-10">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute h-px w-full bg-red-500"
                    style={{ top: `${(i + 1) * 14}%` }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
