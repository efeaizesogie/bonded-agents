// The site logo: the two linked rings mark plus the name. On narrow screens
// only the mark shows (see .logo-name in globals.css); the link keeps its label.
export function Logo({ className }: { className: string }) {
  return (
    <a className={`logo ${className}`} href="/" aria-label="Bonded Agents, home">
      <svg className="logo-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <rect width="64" height="64" rx="14" fill="#1f1b17" />
        <rect x="10" y="22" width="26" height="20" rx="10" fill="none" stroke="#f0763c" strokeWidth="5" />
        <rect x="28" y="22" width="26" height="20" rx="10" fill="none" stroke="#fdfbf8" strokeWidth="5" />
        <path d="M33 22.5 a10 10 0 0 1 3 7" fill="none" stroke="#f0763c" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <span className="logo-name">Bonded Agents</span>
    </a>
  );
}
