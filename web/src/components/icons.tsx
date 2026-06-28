interface IconProps {
  size?: number;
}

export function HeartIcon({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 21s-6.7-4.35-9.33-8.06C.9 10.3 1.4 6.9 4.1 5.6c1.97-.95 4.3-.3 5.6 1.4L12 9.4l2.3-2.4c1.3-1.7 3.63-2.35 5.6-1.4 2.7 1.3 3.2 4.7 1.43 7.34C18.7 16.65 12 21 12 21z" />
    </svg>
  );
}

export function CrossIcon({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function UndoIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
    </svg>
  );
}

export function TrashIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

/** Generic file/document icon for non-previewable files. */
export function FileIcon({ size = 72 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

/** Simple checkmark — success / "Done". */
export function CheckIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/** Circular arrows — "review again" / start another pass. */
export function RefreshIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

/** Folder icon for the picker cards. */
export function FolderIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h6a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

/** Magnifier with a plus — tap-to-zoom affordance. */
export function ZoomIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
    </svg>
  );
}

/** App logo mark: flat coral squircle with a bin flanked by swipe chevrons. */
export function Logo({ size = 30 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="#fe5f55" />
      <g stroke="#fff" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* swipe-left / swipe-right chevrons */}
        <path d="M12 19L8 24l4 5" strokeWidth="2.4" />
        <path d="M37 19l4 5-4 5" strokeWidth="2.4" />
        {/* trash bin */}
        <g strokeWidth="2.6">
          <path d="M16 18.5h17" />
          <path d="M21 18.5v-2.2a1.6 1.6 0 0 1 1.6-1.6h3.8a1.6 1.6 0 0 1 1.6 1.6v2.2" />
          <path d="M18.2 18.5l1.2 13.2a2 2 0 0 0 2 1.8h6.2a2 2 0 0 0 2-1.8l1.2-13.2" />
        </g>
      </g>
    </svg>
  );
}

/** Celebration badge for the end screen: flat check with palette confetti. */
export function CelebrateGraphic({ size = 104 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden className="celebrate">
      <g className="celebrate__confetti">
        <circle cx="22" cy="34" r="4" fill="#e63462" />
        <rect x="92" y="26" width="7" height="7" rx="1.5" fill="#c7efcf" transform="rotate(20 95 29)" />
        <circle cx="100" cy="70" r="3.5" fill="#fe5f55" />
        <rect x="16" y="74" width="6" height="6" rx="1.5" fill="#eef5db" transform="rotate(-15 19 77)" />
        <circle cx="34" cy="16" r="3" fill="#c7efcf" />
        <circle cx="86" cy="96" r="3" fill="#e63462" />
        <rect x="58" y="10" width="5" height="5" rx="1.2" fill="#fe5f55" transform="rotate(30 60 12)" />
      </g>
      <circle cx="60" cy="60" r="33" fill="#fe5f55" />
      <path d="M46 61l10 10 19-22" stroke="#fff" strokeWidth="6.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
