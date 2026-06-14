"use client";
import { ChevronRight } from "lucide-react";
import type { Category } from "~/lib/categories";
import { cn } from "~/lib/utils";

interface Props {
  category: Category;
  selected: boolean;
  onClick: () => void;
  index: number;
}

export default function CategoryCard({ category, selected, onClick, index }: Props) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-start text-left",
        "p-5 sm:p-6 rounded-lg bg-paper border",
        "transition-all duration-300 ease-out",
        "min-h-[148px] outline-none",
        "animate-fade-in-up opacity-0",
        selected
          ? "border-ink shadow-[0_2px_0_oklch(0%_0_0_/_0.04)]"
          : "border-rule-faint hover:border-rule hover:-translate-y-0.5",
      )}
      style={{
        animationDelay: `${100 + index * 40}ms`,
        animationFillMode: "forwards",
      }}
    >
      <div className="w-full flex items-start justify-between mb-4">
        <span
          className="text-mono"
          style={{ color: selected ? "var(--color-vermillion)" : "var(--color-text-muted)" }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className="font-display text-3xl leading-none"
          style={{
            color: selected ? "oklch(50% 0.19 25)" : "oklch(28% 0.03 55 / 0.55)",
            transition: "color 0.3s ease",
          }}
        >
          {category.mark}
        </span>
      </div>

      <h3
        className="text-title mb-1"
        style={{ fontSize: "1.375rem", lineHeight: 1.1 }}
      >
        {category.name}
      </h3>

      <p className="text-jp text-body-sm mb-3" style={{ color: "var(--color-text-faint)" }}>
        {category.jp}
      </p>

      <p
        className="text-body-sm"
        style={{
          color: "var(--color-text-secondary)",
          lineHeight: 1.5,
        }}
      >
        {category.blurb}
      </p>

      {selected && (
        <div
          className="absolute left-0 right-0 bottom-0 h-[2px] rounded-b-lg"
          style={{ background: "var(--color-vermillion)" }}
        />
      )}

      <div
        className={cn(
          "absolute right-4 bottom-4 transition-all duration-300",
          "flex items-center gap-1 text-xs",
          selected ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2",
        )}
        style={{ color: "var(--color-vermillion)" }}
      >
        <span className="text-eyebrow" style={{ color: "var(--color-vermillion)" }}>
          Selected
        </span>
        <ChevronRight size={14} />
      </div>
    </button>
  );
}
