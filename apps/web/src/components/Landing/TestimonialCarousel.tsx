"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Testimonial = { quote: string; name: string; role: string };

export function TestimonialCarousel() {
  const items = useMemo<Testimonial[]>(
    () => [
      { quote: "Auto-categorization saved me hours every month.", name: "Gaurav", role: "Founder" },
      { quote: "Alerts caught a duplicate charge the same day.", name: "Mariam", role: "Product Manager" },
      { quote: "The insights actually changed my spending habits.", name: "Rahul", role: "Engineer" }
    ],
    []
  );

  const [i, setI] = useState(0);
  const item = items[i];

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Testimonials</div>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost h-9 w-9 p-0"
            onClick={() => setI((p) => (p - 1 + items.length) % items.length)}
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="btn-ghost h-9 w-9 p-0"
            onClick={() => setI((p) => (p + 1) % items.length)}
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-white/70">“{item.quote}”</p>
      <div className="mt-4 text-xs text-white/60">
        <span className="font-semibold text-white/80">{item.name}</span> • {item.role}
      </div>

      <div className="mt-4 flex gap-1">
        {items.map((_, idx) => (
          <span
            key={idx}
            className={`h-1.5 w-6 rounded-full ${idx === i ? "bg-white/60" : "bg-white/15"}`}
          />
        ))}
      </div>
    </div>
  );
}
