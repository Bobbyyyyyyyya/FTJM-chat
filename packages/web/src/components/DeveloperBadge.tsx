const SHIELD =
  'M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z'

const WRENCH =
  'M22.7,19L13.6,9.9C14.5,7.6 14,4.9 12.1,3C10.2,1.1 7.5,0.6 5.2,1.5L8.6,4.9L4.9,8.6L1.5,5.2C0.6,7.5 1.1,10.2 3,12.1C4.9,14 7.6,14.5 9.9,13.6L19,22.7C19.4,23.1 20,23.1 20.4,22.7L22.7,20.4C23.1,20 23.1,19.4 22.7,19Z'

export default function DeveloperBadge({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg
      className={className + ' text-emerald-400 shrink-0'}
      viewBox="0 0 24 24"
      aria-label="Developer"
    >
      <path fill="currentColor" d={SHIELD} />
      <path fill="#fff" d={WRENCH} />
    </svg>
  )
}