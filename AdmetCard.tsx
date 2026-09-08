import React from "react";
import { AdmetResponse } from "../services/api";

interface AdmetCardProps {
  data: AdmetResponse;
}

const flagColor: Record<string, string> = {
  green: "#2F7D5A",
  amber: "#A9762E",
  red: "#AE3B3B",
};

const flagLabel: Record<string, string> = {
  green: "favorable",
  amber: "borderline",
  red: "problematic",
};

export const AdmetCard: React.FC<AdmetCardProps> = ({ data }) => {
  if (!data || !data.valid || !data.properties || !data.lipinski) {
    return null;
  }

  const { properties, lipinski, smiles, source } = data;
  const lipinskiRows: [string, number | string, string][] = [
    ["MW", lipinski.mw, "≤ 500"],
    ["LogP", lipinski.logp, "≤ 5.0"],
    ["HBD", lipinski.hbd, "≤ 5"],
    ["HBA", lipinski.hba, "≤ 10"],
    ["TPSA", `${lipinski.tpsa} Å²`, "≤ 140"],
  ];

  return (
    <div className="mt-3 border border-line rounded bg-surface overflow-hidden">
      <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
        <span className="text-xs font-mono text-ink-muted truncate">{smiles}</span>
        {source && <span className="text-[10px] text-ink-faint whitespace-nowrap ml-3">{source}</span>}
      </div>

      <div className="px-4 py-3 border-b border-line">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-ink-muted">Lipinski Rule of Five</span>
          <span className={`text-xs ${lipinski.passes ? "text-flag-good" : "text-flag-risk"}`}>
            {lipinski.passes ? "pass" : `fail — ${lipinski.violations} violation${lipinski.violations === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="grid grid-cols-5 text-center">
          {lipinskiRows.map(([label, value, limit]) => (
            <div key={label} className="border-l border-line first:border-l-0 px-1">
              <div className="text-[10px] text-ink-faint">{label}</div>
              <div className="text-sm font-mono">{value}</div>
              <div className="text-[10px] text-ink-faint">{limit}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        {Object.entries(properties).map(([key, prop]) => (
          <div key={key} className="px-4 py-2.5 flex items-center justify-between border-b border-line last:border-b-0">
            <div className="min-w-0">
              <div className="text-sm">{prop.name}</div>
              <div className="text-[11px] text-ink-faint truncate">{prop.description}</div>
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0 ml-3">
              <span className="text-sm font-mono">
                {prop.value}
                <span className="text-ink-faint text-xs ml-1">{prop.unit}</span>
              </span>
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: flagColor[prop.flag] }}
                title={flagLabel[prop.flag]}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
