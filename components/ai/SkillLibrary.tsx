"use client";

import * as React from "react";
import { SKILLS, SKILL_CATEGORIES, type Skill } from "@/lib/llm/skills";
import { cn } from "@/lib/utils";

export function SkillLibrary({
  onPick,
}: {
  onPick: (skill: Skill) => void;
}) {
  const [cat, setCat] = React.useState<typeof SKILL_CATEGORIES[number]["id"]>(
    "ideation"
  );

  const skills = SKILLS.filter((s) => s.category === cat);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {SKILL_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={cn(
              "text-xs px-2 py-1 rounded-full transition-colors",
              cat === c.id
                ? "bg-app-fg text-app-bg"
                : "text-app-fg-muted hover:text-app-fg hover:bg-app-surface-hover"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {skills.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s)}
            className="flex items-start gap-2.5 text-left p-2.5 rounded-md hover:bg-app-surface-hover border border-transparent hover:border-app-border transition-colors"
          >
            <span className="text-base shrink-0 leading-none mt-0.5">{s.emoji}</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-app-fg">{s.name}</span>
              <span className="block text-[11px] text-app-fg-muted leading-snug mt-0.5">
                {s.short}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
