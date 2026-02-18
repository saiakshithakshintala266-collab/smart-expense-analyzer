
"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles, ShieldCheck, Zap, LineChart, Stars } from "lucide-react";
import { DemoChartCard } from "./DemoChartCard";
import { TestimonialCarousel } from "./TestimonialCarousel";

type Feature = {
  title: string;
  desc: string;
  icon: React.ReactNode;
};

const features: Feature[] = [
  {
    title: "Auto-Categorization",
    desc: "Rules-first categorization with AI fallback when merchants are unknown.",
    icon: <Sparkles className="h-5 w-5" />
  },
  {
    title: "Real-time Alerts",
    desc: "Duplicate charges, unusual merchants, and budget thresholds—caught early.",
    icon: <Zap className="h-5 w-5" />
  },
  {
    title: "Future Forecasting",
    desc: "Monthly insights and trends to keep spending predictable and intentional.",
    icon: <LineChart className="h-5 w-5" />
  }
];

export function LandingPage() {
  return (
    <div className="min-h-screen glow-border">
      <BackgroundOrbs />
      <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <NavBar />

        <section className="mt-10 grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
                <Stars className="h-4 w-4 text-white/90" />
              </span>
              Interactive data visualizing • AI insights • Team-ready
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl"
            >
              Master Your Money with{" "}
              <span className="bg-gradient-to-r from-violet-400 via-sky-300 to-emerald-300 bg-clip-text text-transparent">
                AI-Powered Insights
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="mt-4 max-w-xl text-base leading-relaxed text-white/70"
            >
              Upload receipts and bank exports. We extract, normalize, categorize, detect anomalies, and generate
              monthly insights—securely and workspace-scoped.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15 }}
              className="mt-7 flex flex-wrap items-center gap-3"
            >
              <button className="btn-primary">
                Start Tracking Free <ArrowRight className="ml-2 h-4 w-4" />
              </button>
              <button className="btn-ghost">Log in</button>
              <div className="ml-1 flex items-center gap-2 text-xs text-white/55">
                <ShieldCheck className="h-4 w-4" />
                Encrypted uploads • RBAC workspaces
              </div>
            </motion.div>

            <div id="features" className="mt-10 grid gap-4 sm:grid-cols-3">
              {features.map((f, idx) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.15 + idx * 0.05 }}
                  className="glass rounded-2xl p-4"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                      <span className="text-white/90">{f.icon}</span>
                    </div>
                    <h3 className="text-sm font-semibold">{f.title}</h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-white/65">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <LaptopHeroFrame />
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <DemoChartCard />
                <AsSeenOn />
              </div>
              <div className="mt-4">
                <TestimonialCarousel />
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  );
}

function NavBar() {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-emerald-400 p-[1px] shadow-glow">
          <div className="flex h-full w-full items-center justify-center rounded-xl bg-black/70">
            <Sparkles className="h-5 w-5 text-white/90" />
          </div>
        </div>
        <div className="text-sm font-semibold tracking-wide">SmartExpense.ai</div>
      </div>

      <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
        <a className="hover:text-white" href="#features">
          Features
        </a>
        <a className="hover:text-white" href="#about">
          About
        </a>
        <a className="hover:text-white" href="#support">
          Support
        </a>
        <a className="hover:text-white" href="#blog">
          Blog
        </a>
        <a className="hover:text-white" href="#pricing">
          Prices
        </a>
      </nav>

      <div className="flex items-center gap-2">
        <button className="btn-ghost hidden sm:inline-flex">Log in</button>
        <button className="btn-primary">Start Tracking Free</button>
      </div>
    </header>
  );
}

function LaptopHeroFrame() {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/40 shadow-glass">
      <div className="absolute inset-0 opacity-80">
        <GlobeBackdrop />
      </div>

      <div className="relative px-6 pb-10 pt-10 sm:px-10">
        <div className="mx-auto max-w-md text-center">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/75">
            Interactive Data Visualizing
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Master Your Money with{" "}
            <span className="bg-gradient-to-r from-violet-400 to-emerald-300 bg-clip-text text-transparent">
              AI Insights
            </span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            See trends, spot anomalies, and understand where your money goes—without manual work.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button className="btn-primary">Start Tracking Free</button>
            <button className="btn-ghost">Learn more</button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <MiniCard title="Auto-Categorization" />
          <MiniCard title="Real-time Alerts" />
          <MiniCard title="Future Forecasting" />
        </div>
      </div>
    </div>
  );
}

function MiniCard({ title }: { title: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2 text-xs text-white/60">
        Clean dashboards, secure workspaces, and insights that actually help.
      </div>
    </div>
  );
}

function AsSeenOn() {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-sm font-semibold">As seen on</div>
      <div className="mt-4 flex items-center gap-6 text-white/70">
        <span className="text-lg font-semibold tracking-tight">Forbes</span>
        <span className="text-lg font-semibold tracking-tight">TechCrunch</span>
        <span className="text-lg font-semibold tracking-tight">Wired</span>
      </div>
      <p className="mt-3 text-xs text-white/60">
        (Placeholder logos for now — we’ll replace with your brand assets later.)
      </p>
    </div>
  );
}

function BackgroundOrbs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-violet-500/15 blur-3xl" />
      <div className="absolute -right-48 -top-24 h-[520px] w-[520px] rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="absolute left-1/3 top-[60%] h-[520px] w-[520px] rounded-full bg-sky-400/10 blur-3xl" />
    </div>
  );
}

function GlobeBackdrop() {
  return (
    <svg viewBox="0 0 1200 700" className="h-full w-full">
      <defs>
        <radialGradient id="glow1" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="rgba(124,58,237,0.38)" />
          <stop offset="45%" stopColor="rgba(59,130,246,0.22)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <radialGradient id="glow2" cx="55%" cy="40%" r="60%">
          <stop offset="0%" stopColor="rgba(16,185,129,0.30)" />
          <stop offset="55%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      <rect width="1200" height="700" fill="rgba(0,0,0,0.35)" />
      <circle cx="650" cy="260" r="240" fill="url(#glow1)" />
      <circle cx="620" cy="260" r="220" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.10)" />

      {Array.from({ length: 28 }).map((_, i) => {
        const t = i / 28;
        const y = 260 + (t - 0.5) * 360;
        const a = Math.cos((t - 0.5) * Math.PI);
        const rx = 210 * a;
        const ry = 48;
        return (
          <ellipse
            key={i}
            cx="620"
            cy={y}
            rx={Math.max(20, rx)}
            ry={ry}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
          />
        );
      })}

      <path
        d="M410,250 C520,120 740,110 860,240"
        fill="none"
        stroke="rgba(124,58,237,0.55)"
        strokeWidth="3"
      />
      <path
        d="M450,330 C560,450 760,460 880,340"
        fill="none"
        stroke="rgba(16,185,129,0.50)"
        strokeWidth="3"
      />

      <circle cx="620" cy="260" r="280" fill="url(#glow2)" />
    </svg>
  );
}
