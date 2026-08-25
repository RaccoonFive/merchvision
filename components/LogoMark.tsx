type LogoMarkProps = {
  className?: string;
};

export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="merchvision-mark-verdant" x1="10" x2="54" y1="18" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#abc69a" />
          <stop offset="1" stopColor="#3e745a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#24332a" />
      <path d="M8 32 21 11h22l13 21-13 21H21L8 32Z" fill="url(#merchvision-mark-verdant)" />
      <path d="m15 32 9-13h16l9 13-9 13H24L15 32Z" fill="#24332a" />
      <path d="m21 41 7-9 6 5 9-15" fill="none" stroke="#d2a85c" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" />
    </svg>
  );
}
