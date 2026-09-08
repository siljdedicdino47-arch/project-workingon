import React from "react";
import { AdmetResponse } from "../services/api";
import { Activity, ShieldCheck, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface AdmetCardProps {
  data: AdmetResponse;
}

export const AdmetCard: React.FC<AdmetCardProps> = ({ data }) => {
  if (!data || !data.valid || !data.properties || !data.lipinski) {
    return null;
  }

  const { properties, lipinski, smiles, source } = data;

  const getFlagBadge = (flag: "green" | "amber" | "red") => {
    switch (flag) {
      case "green":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> Optimal / Low Risk
          </span>
        );
      case "amber":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" /> Moderate
          </span>
        );
      case "red":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3.5 h-3.5" /> Poor / High Risk
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mt-4 bg-slate-900 text-slate-100 rounded-xl p-5 border border-slate-700/80 shadow-lg font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-base text-slate-100">ADMET Profile & Drug-Likeness</h4>
            <p className="text-xs text-slate-400 font-mono truncate max-w-xs sm:max-w-md">{smiles}</p>
          </div>
        </div>
        {source && (
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            {source}
          </span>
        )}
      </div>

      {/* Lipinski Rule of 5 */}
      <div className="mb-5 bg-slate-800/60 rounded-lg p-3.5 border border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Lipinski Rule of 5
          </span>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded ${
              lipinski.passes ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
            }`}
          >
            {lipinski.passes ? "PASS (Rule of 5)" : `FAIL (${lipinski.violations} Violations)`}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2 text-center text-xs">
          <div className="bg-slate-900/60 p-2 rounded border border-slate-700/40">
            <div className="text-slate-400 text-[10px] uppercase">MW</div>
            <div className="font-semibold text-slate-200">{lipinski.mw}</div>
            <div className="text-[9px] text-slate-500">≤ 500</div>
          </div>
          <div className="bg-slate-900/60 p-2 rounded border border-slate-700/40">
            <div className="text-slate-400 text-[10px] uppercase">LogP</div>
            <div className="font-semibold text-slate-200">{lipinski.logp}</div>
            <div className="text-[9px] text-slate-500">≤ 5.0</div>
          </div>
          <div className="bg-slate-900/60 p-2 rounded border border-slate-700/40">
            <div className="text-slate-400 text-[10px] uppercase">HBD</div>
            <div className="font-semibold text-slate-200">{lipinski.hbd}</div>
            <div className="text-[9px] text-slate-500">≤ 5</div>
          </div>
          <div className="bg-slate-900/60 p-2 rounded border border-slate-700/40">
            <div className="text-slate-400 text-[10px] uppercase">HBA</div>
            <div className="font-semibold text-slate-200">{lipinski.hba}</div>
            <div className="text-[9px] text-slate-500">≤ 10</div>
          </div>
          <div className="bg-slate-900/60 p-2 rounded border border-slate-700/40">
            <div className="text-slate-400 text-[10px] uppercase">TPSA</div>
            <div className="font-semibold text-slate-200">{lipinski.tpsa} Å²</div>
            <div className="text-[9px] text-slate-500">≤ 140</div>
          </div>
        </div>
      </div>

      {/* ADMET Property Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(properties).map(([key, prop]) => (
          <div key={key} className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/40 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-200">{prop.name}</div>
              <div className="text-[11px] text-slate-400">{prop.description}</div>
              <div className="mt-1 font-mono text-sm font-bold text-slate-100">
                {prop.value} <span className="text-xs font-normal text-slate-400">{prop.unit}</span>
              </div>
            </div>
            <div>{getFlagBadge(prop.flag)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
