import { cn } from "@/lib/cn";

interface KahucikLogoProps {
  variant?: "full" | "compact";
  className?: string;
}

/** Abstract rooster mark inspired by the Kahúcik mascot palette (red / gold / blue / green). */
function RoosterMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 86"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={true}
    >
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .k-comb { animation: k-bounce 2.4s ease-in-out infinite; transform-origin: 56px 22px; }
          .k-tail { animation: k-wag 2.2s ease-in-out infinite; transform-origin: 28px 48px; }
          .k-eye { animation: k-blink 4.8s step-end infinite; transform-origin: 58px 30px; }
        }
        @keyframes k-bounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-2px) rotate(-5deg); }
        }
        @keyframes k-wag {
          0%, 100% { transform: rotate(0deg); }
          35% { transform: rotate(6deg); }
          70% { transform: rotate(-4deg); }
        }
        @keyframes k-blink {
          0%, 92%, 100% { transform: scaleY(1); }
          94% { transform: scaleY(0.1); }
        }
      `}</style>

      {/* Tail plumes — emerald arcs */}
      <g className="k-tail">
        <path
          d="M30 46 C12 28, 4 18, 8 10 C18 14, 26 30, 34 44Z"
          fill="#15803D"
        />
        <path
          d="M32 48 C14 36, 2 30, 2 20 C14 22, 28 36, 36 48Z"
          fill="#16A34A"
        />
        <path
          d="M34 50 C18 42, 6 40, 4 32 C16 34, 30 42, 38 52Z"
          fill="#4ADE80"
        />
        <ellipse cx="34" cy="50" rx="5" ry="3.5" fill="#FEF3C7" opacity="0.95" />
      </g>

      {/* Body / breast — cobalt with scallops */}
      <ellipse cx="44" cy="54" rx="18" ry="16" fill="#1D4ED8" />
      <path
        d="M34 48 Q38 52 34 56 Q38 60 34 64"
        fill="none"
        stroke="#3B82F6"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M40 46 Q44 50 40 54 Q44 58 40 62"
        fill="none"
        stroke="#3B82F6"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />

      {/* Wing layers */}
      <path
        d="M46 46 C58 42, 66 48, 64 58 C58 62, 48 60, 44 54Z"
        fill="#9A3412"
      />
      <path
        d="M46 44 C56 38, 64 42, 62 52 C56 54, 48 52, 44 48Z"
        fill="#EA580C"
      />
      <path
        d="M46 42 C54 36, 60 38, 58 46 C54 48, 48 46, 45 44Z"
        fill="#EF4444"
      />

      {/* Neck hackles — gold → orange flame points */}
      <path d="M48 40 L42 22 L50 34Z" fill="#FACC15" />
      <path d="M52 38 L50 18 L56 32Z" fill="#FBBF24" />
      <path d="M56 36 L58 16 L62 30Z" fill="#F59E0B" />
      <path d="M50 40 L46 28 L54 36Z" fill="#FB923C" />

      {/* Head */}
      <circle cx="56" cy="30" r="9" fill="#F97316" />
      <circle cx="56" cy="30" r="9" fill="#EA580C" opacity="0.25" />

      {/* Comb */}
      <g className="k-comb">
        <path
          d="M50 24 C50 14, 54 12, 56 20 C58 12, 62 12, 62 22 C64 14, 68 16, 66 24 C62 26, 52 26, 50 24Z"
          fill="#DC2626"
        />
      </g>

      {/* Beak + wattle */}
      <path d="M64 30 L74 32 L64 35Z" fill="#FBBF24" />
      <path d="M58 36 C58 42, 54 44, 52 40 C54 38, 56 36, 58 36Z" fill="#DC2626" />

      {/* Eye */}
      <circle cx="58" cy="29" r="2.4" fill="#FDE68A" />
      <ellipse className="k-eye" cx="58.4" cy="29" rx="1.1" ry="1.5" fill="#1E293B" />

      {/* Legs */}
      <path
        d="M38 68 L36 78 M36 78 L30 82 M36 78 L36 84 M36 78 L42 82"
        fill="none"
        stroke="#D6A86A"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M48 68 L50 78 M50 78 L44 82 M50 78 L50 84 M50 78 L56 82"
        fill="none"
        stroke="#D6A86A"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KahucikLogo({ variant = "full", className }: KahucikLogoProps) {
  const compact = variant === "compact";

  if (compact) {
    return (
      <RoosterMark
        className={cn("select-none", className)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label="Kahúcik"
      className={cn("flex select-none items-center justify-center gap-3", className)}
    >
      <RoosterMark className="h-full w-auto max-h-full" />
      <div className="font-logo text-left leading-none">
        <p className="text-4xl font-bold tracking-tight text-slate-800 sm:text-5xl">
          Kah<span className="text-coral-500">ú</span>cik
        </p>
        <p className="mt-1.5 text-[0.7rem] font-semibold tracking-[0.12em] text-slate-400 sm:text-xs">
          PLAY · LEARN · CROW
        </p>
      </div>
    </div>
  );
}
