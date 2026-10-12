/** Jemná ilustrace pro uvítací panel – otevřená kniha a studentská čepice. */
export function WelcomeIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 180" className={className} aria-hidden fill="none">
      <circle cx="170" cy="92" r="78" fill="#DCE9FF" opacity=".55" />
      <circle cx="226" cy="40" r="10" fill="#FFE8A3" />
      <circle cx="74" cy="44" r="6" fill="#CFF7E8" />
      {/* kniha */}
      <path d="M86 128c22-10 46-10 68 2v-62c-22-12-46-12-68-2v62Z" fill="#fff" stroke="#2F68FF" strokeWidth="3" strokeLinejoin="round" />
      <path d="M222 128c-22-10-46-10-68 2v-62c22-12 46-12 68-2v62Z" fill="#fff" stroke="#2F68FF" strokeWidth="3" strokeLinejoin="round" />
      <path d="M100 84c12-4 26-4 40 1M100 98c12-4 26-4 40 1M100 112c12-4 26-4 40 1" stroke="#BFD3FF" strokeWidth="3" strokeLinecap="round" />
      <path d="M168 85c14-5 28-5 40-1M168 99c14-5 28-5 40-1" stroke="#BFD3FF" strokeWidth="3" strokeLinecap="round" />
      <path d="M154 70v60" stroke="#2F68FF" strokeWidth="3" strokeLinecap="round" />
      {/* čepice */}
      <path d="M154 22 112 40l42 18 42-18-42-18Z" fill="#14213D" />
      <path d="M130 48v12c0 6 11 11 24 11s24-5 24-11V48l-24 10-24-10Z" fill="#14213D" opacity=".9" />
      <path d="M190 42v18" stroke="#FFE8A3" strokeWidth="3" strokeLinecap="round" />
      <circle cx="190" cy="63" r="4" fill="#FFE8A3" />
    </svg>
  );
}
