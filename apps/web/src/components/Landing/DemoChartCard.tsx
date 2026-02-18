
"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = [
  { name: "Jan", v: 240 },
  { name: "Feb", v: 320 },
  { name: "Mar", v: 460 },
  { name: "Apr", v: 380 }
];

export function DemoChartCard() {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-sm font-semibold">Start a Live Demo</div>
      <p className="mt-2 text-xs text-white/60">
        Add transactions and instantly see charts update (UI mock for now).
      </p>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3">
        <div className="mb-2 text-xs text-white/60">Monthly Spend</div>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.12)" }}
                labelStyle={{ color: "rgba(255,255,255,0.75)" }}
              />
              <Bar dataKey="v" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <button className="btn-primary mt-3 w-full">Add Transaction</button>
      </div>
    </div>
  );
}
