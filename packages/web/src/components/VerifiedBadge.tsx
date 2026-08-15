export default function VerifiedBadge({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg
      className={className + ' text-blue-500 shrink-0'}
      viewBox="0 0 24 24"
      aria-label="Verified"
    >
      <path
        fill="currentColor"
        d="M12 2l2.09 1.2 2.4-.24 1.06 2.16 2.16 1.06-.24 2.4L21 12l-1.2 2.09.24 2.4-2.16 1.06-1.06 2.16-2.4-.24L12 21l-2.09-1.2-2.4.24-1.06-2.16-2.16-1.06.24-2.4L3 12l1.2-2.09-.24-2.4 2.16-1.06 1.06-2.16 2.4.24L12 2z"
      />
      <path
        fill="#fff"
        d="M10.94 14.84L7.76 11.66l1.41-1.41 1.77 1.77 4.95-4.95 1.41 1.41-6.36 6.36z"
      />
    </svg>
  )
}
