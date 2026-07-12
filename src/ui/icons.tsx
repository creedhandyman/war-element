// Small inline SVG icons (single-color, scale with font-size via 1em).

/** Speed — a swept wing (three feathers). Cleaner than the 👟 emoji and reads
 *  well at the tiny sizes used in stat rows. */
export function SpIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      fill="currentColor"
      style={{ verticalAlign: "-0.1em" }}
    >
      <path d="M2 7c6-1 12 0 19 4-6-1-12-1-18 0-.6 0-1-.3-1-.8s.4-3.1 0-3.2z" opacity="0" />
      <path d="M2.5 7.2c6.2-1.1 12.4.2 18.5 4-5.6-1-11-1-16.5-.2-1 .1-1.7-.2-2-1-.2-.7-.3-2-0-2.8z" />
      <path d="M3.5 12c5.4-.9 10.6.3 15.5 3.4-4.8-.9-9.4-.8-13.9-.1-.9.2-1.5-.1-1.8-.9-.1-.5.1-1.9.2-2.4z" />
      <path d="M5 16.4c4-.7 7.8.2 11.4 2.6-3.6-.7-7-.6-10.3-.1-.7.1-1.2-.1-1.4-.7-.1-.4.1-1.4.3-1.8z" />
    </svg>
  );
}
