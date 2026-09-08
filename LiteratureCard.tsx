import React from "react";
import { ReferenceItem } from "../services/api";

interface LiteratureCardProps {
  references: ReferenceItem[];
}

export const LiteratureCard: React.FC<LiteratureCardProps> = ({ references }) => {
  if (!references || references.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border border-line rounded bg-surface overflow-hidden">
      <div className="px-4 py-2.5 border-b border-line text-xs text-ink-muted">
        {references.length} PubMed reference{references.length === 1 ? "" : "s"}
      </div>
      <div className="max-h-72 overflow-y-auto thin-scroll">
        {references.map((ref, idx) => (
          <div key={ref.pmid || idx} className="px-4 py-3 border-b border-line last:border-b-0">
            <div className="flex gap-2.5">
              <span className="text-xs font-mono text-ink-faint flex-shrink-0 mt-0.5">[{idx + 1}]</span>
              <div className="min-w-0">
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent hover:text-accent-strong hover:underline"
                >
                  {ref.title}
                </a>
                <div className="text-xs text-ink-muted mt-0.5">{ref.authors}</div>
                <div className="text-[11px] text-ink-faint font-mono mt-0.5">
                  {ref.journal}, {ref.year} — PMID {ref.pmid}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
