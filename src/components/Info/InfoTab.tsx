export function InfoTab() {
  return (
    <div className="flex flex-col gap-5 pt-1 pb-24 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div>
        <span className="sw-display-accent text-[14px] uppercase tracking-[0.14em] text-[var(--muted)]">
          How Your Status Window Works
        </span>
      </div>

      <Section title="Timer">
        <Row label="Stopwatch" detail="Runs until you stop it: logs any length." />
        <Row label="Timer" detail="Counts down to a target duration, auto-saves when done." />
        <Row label="Min save" detail="Sessions under 30s ask before saving to keep history clean." />
      </Section>

      <Section title="Health (HP)">
        <Row label="+1 HP" detail="Study ≥ 1 hour on a given day." />
        <Row label="−1 HP" detail="Study < 1 hour (or skip) on a given day." />
        <Row label="Challenges" detail="Challenge HP only drops after a missed day fully ends in your selected time zone, not while today is still in progress." />
        <Row label="Goal" detail="Keep positive HP: it tracks your daily consistency from day one." />
        <Row label="Danger zone" detail="HP goes red when negative." />
      </Section>

      <Section title="Level">
        <Row label="Formula" detail="Total hours ÷ 1000, rounded. (1000h = lvl 1)" />
        <Row label="All-time" detail="Level counts every session ever logged; it never resets." />
      </Section>

      <Section title="Stats">
        <Row label="History" detail="Every saved session is listed with subject and duration." />
        <Row label="Radar" detail="Subject breakdown across up to 4 topics." />
        <Row label="Weekly" detail="Bar chart of study hours over the past 7 days." />
        <Row label="Challenges" detail="Daily challenge resets and deadlines follow your selected time zone." />
      </Section>

      <Section title="Friends">
        <Row label="Add" detail="Copy your User ID and share it; paste a friend's ID to invite." />
        <Row label="Online" detail="Green dot = they have a timer running right now" />
        <Row label="Today" detail="Hours each friend has studied since midnight in your selected time zone." />
      </Section>

      <Section title="Subjects">
        <Row label="Custom" detail="Name and color your own subjects in Settings." />
        <Row label="Archive" detail="Archived subjects are hidden from the timer but kept in stats." />
      </Section>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="sw-display-accent text-[10px] uppercase tracking-widest text-[var(--sky)]">
          {title}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--paper)] px-4 py-3">
        {children}
      </div>
    </section>
  );
}

function Row({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="sw-display-accent w-20 shrink-0 text-[10px] uppercase tracking-wide text-[var(--ink)]">
        {label}
      </span>
      <span className="text-[10px] font-bold leading-4 text-[var(--muted)]">{detail}</span>
    </div>
  );
}
