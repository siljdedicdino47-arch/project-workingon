import React from "react";
import { ReferenceItem } from "../services/api";
import { BookOpen, ExternalLink, FileText } from "lucide-react";

interface LiteratureCardProps {
  references: ReferenceItem[];
}

export const LiteratureCard: React.FC<LiteratureCardProps> = ({ references }) => {
  if (!references || references.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 bg-slate-900 text-slate-100 rounded-xl p-5 border border-slate-700/80 shadow-lg font-sans">
      <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800">
        <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-400">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-base text-slate-100">PubMed Cited Literature ({references.length})</h4>
          <p className="text-xs text-slate-400">Verified NCBI PubMed articles and citations</p>
        </div>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {references.map((ref, idx) => (
          <div key={ref.pmid || idx} className="bg-slate-800/50 hover:bg-slate-800 rounded-lg p-3 border border-slate-700/50 transition">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  [{idx + 1}]
                </span>
                <div>
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-cyan-300 hover:text-cyan-200 hover:underline flex items-center gap-1.5"
                  >
                    {ref.title} <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  </a>
                  <p className="text-xs text-slate-300 mt-1">{ref.authors}</p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-mono">
                    <span>{ref.journal}</span>
                    <span>•</span>
                    <span>{ref.year}</span>
                    <span>•</span>
                    <span className="text-slate-400">PMID: {ref.pmid}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
