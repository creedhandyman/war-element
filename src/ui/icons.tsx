// Small inline SVG icons (single-color, scale with font-size via 1em).

/** Speed — a winged running shoe. Cleaner than the 👟 emoji, matching the
 *  crisp ⚔/♥/🛡 stat glyphs. */
export function SpIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      style={{ verticalAlign: "-0.12em", marginRight: "1px" }}
    >
      {/* speed wing — swept-back feathers trailing the heel */}
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M1.5 7.5 6 9" />
        <path d="M1 10.5 6.5 11.5" />
        <path d="M2 13.5 5.5 14" />
      </g>
      {/* shoe body (running shoe, toe to the right) */}
      <path
        fill="currentColor"
        d="M11.6 6.4c-.6-.2-1.2.1-1.4.7-.4 1.2-1 2.3-2 3.2-.9.8-1.4 1.9-1.4 3.1v.9c0 .8.7 1.5 1.5 1.5h9.9c1.1 0 2.1-.9 2.1-2.1 0-1.6-1.2-2.6-3-2.9-1.3-.3-2.3-.8-3.1-1.7-.6-.7-1-1.5-1.2-2.3-.1-.2-.2-.4-.4-.4z"
      />
      {/* sole */}
      <path
        fill="currentColor"
        d="M8.5 16.6h11c.5 0 .9.4.9.9s-.4.9-.9.9H9.9c-1 0-1.8-.6-2.1-1.5-.1-.4.2-.9.7-.9z"
        opacity="0.8"
      />
    </svg>
  );
}
