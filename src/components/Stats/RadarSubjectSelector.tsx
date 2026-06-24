import type { Subject } from "../../types";

interface RadarSubjectSelectorProps {
  subjects: Subject[];
  selectedSubjectIds: string[];
  onChange: (selectedIds: string[]) => void;
}

export function RadarSubjectSelector({
  subjects,
  selectedSubjectIds,
  onChange,
}: RadarSubjectSelectorProps) {
  const active = subjects.filter((s) => s.is_active);

  const toggle = (id: string) => {
    if (selectedSubjectIds.includes(id)) {
      onChange(selectedSubjectIds.filter((x) => x !== id));
    } else {
      onChange([...selectedSubjectIds, id]);
    }
  };

  const count = selectedSubjectIds.length;
  const countLabel =
    count >= 3
      ? `${count} selected`
      : `Select at least ${3 - count} more`;

  return (
    <div>
      {/* Label row */}
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
          Radar Subjects
        </span>
        <span
          className={`text-[9px] font-bold uppercase tracking-wide ${
            count >= 3 ? "text-[var(--leaf)]" : "text-[var(--muted)]"
          }`}
        >
          {countLabel}
        </span>
      </div>

      {/* Chips */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {active.map((subject) => {
          const selected = selectedSubjectIds.includes(subject.id);
          const subjectColor = subject.color ?? "var(--sky)";
          return (
            <button
              key={subject.id}
              type="button"
              onClick={() => toggle(subject.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide transition-all duration-150 active:scale-95 ${
                selected
                  ? "border-transparent text-white shadow-sm"
                  : "border-[var(--border)] bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
              style={
                selected
                  ? { backgroundColor: subjectColor, borderColor: subjectColor }
                  : {}
              }
            >
              {/* Color dot (visible when deselected) */}
              {!selected && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: subjectColor }}
                />
              )}
              {subject.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
