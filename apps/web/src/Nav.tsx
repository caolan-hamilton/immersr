export type NavScreen = "home" | "account";

/** The Streak pill, in the phone header and the desktop top bar. */
export function StreakPill({ streak }: { streak: number }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border-[2.5px] border-line bg-you px-3 py-[5px] text-[13px] font-bold text-[#141414] shadow-chunk-sm">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 3 3 5 0-3 0-6 0-9z"
          fill="#E8641E"
          stroke="#141414"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      {streak === 0 ? "No streak yet" : `${streak}-day streak`}
    </span>
  );
}

interface NavProps {
  current: NavScreen;
  go(screen: NavScreen): void;
}

/** The desktop top bar: logo, Home, Account, then the Streak. Hidden below the desktop breakpoint. */
export function TopBar({ current, go, streak }: NavProps & { streak: number }) {
  return (
    <header className="hidden items-center gap-7 border-b-[3px] border-line bg-body px-8 py-3 text-on-body desk:flex">
      <span className="font-display text-[28px] font-black">Immersr</span>
      <nav aria-label="Main" className="flex gap-1.5">
        <button type="button" className="toplink" aria-current={current === "home" ? "page" : undefined} onClick={() => go("home")}>
          Home
        </button>
        <button type="button" className="toplink" aria-current={current === "account" ? "page" : undefined} onClick={() => go("account")}>
          Account
        </button>
      </nav>
      <div className="grow" />
      <StreakPill streak={streak} />
    </header>
  );
}

/** The phone bottom Nav. Hidden from the desktop breakpoint up, where the top bar takes over. */
export function BottomNav({ current, go }: NavProps) {
  const item = "nav-item flex min-h-11 flex-col items-center justify-center gap-1 px-6 text-[13px] font-bold";
  return (
    <nav aria-label="Main" className="flex justify-around border-t-[3px] border-line bg-card pb-5 pt-2.5 desk:hidden">
      <button
        type="button"
        className={`${item} ${current === "home" ? "text-ink" : "text-muted"}`}
        aria-current={current === "home" ? "page" : undefined}
        onClick={() => go("home")}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        Home
      </button>
      <button
        type="button"
        className={`${item} ${current === "account" ? "text-ink" : "text-muted"}`}
        aria-current={current === "account" ? "page" : undefined}
        onClick={() => go("account")}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M4 21c1-4 4-6 8-6s7 2 8 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Account
      </button>
    </nav>
  );
}
