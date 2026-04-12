/**
 * FAQ — 4 expandable question/answer pairs using native <details>.
 *
 * Zero JS, zero libraries. Questions sourced from CONTEXT.md §FAQ.
 */

interface QA {
  q: string
  a: string
}

const ITEMS: QA[] = [
  {
    q: 'What happens if a fixture is postponed?',
    a: "George can mark a fixture as voided or reschedule it. Voided fixtures don't count toward your predictions or Last One Standing pick — if your LOS team had their game voided, your pick stands for the rescheduled fixture or slides to whatever replaces it. No one gets penalised for an act-of-god postponement.",
  },
  {
    q: "What if there's a tie at the top of the gameweek?",
    a: "H2H Steal kicks in. If two or more members tie for the weekly prize, they duke it out the following gameweek — whoever scores more in that next GW takes the weekly prize from the tied week. If they tie again, the steal cascades forward until someone breaks it.",
  },
  {
    q: 'Can I change my prediction after kickoff?',
    a: "No. Lockout is enforced at kick-off per fixture (not per gameweek) — you can keep editing predictions for Tuesday's game after Saturday's matches have already started. Once a fixture's kick-off time passes, that fixture's score, bonus star, and LOS pick are all locked.",
  },
  {
    q: 'How do I see my past seasons?',
    a: "Click your name anywhere in the app — league table, gameweek results, admin panel, anywhere a name is rendered it's a link to your profile. Your profile shows this season's stats and a history of every previous season you played, with rank, total points, and any trophies you won.",
  },
]

export function FAQ() {
  return (
    <div className="space-y-3">
      {ITEMS.map((item) => (
        <details
          key={item.q}
          className="group rounded-xl border border-slate-700 bg-slate-900/60 overflow-hidden"
        >
          <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4 font-medium text-white hover:bg-slate-800/50 transition">
            <span>{item.q}</span>
            <span className="text-pl-green text-xl font-bold group-open:rotate-45 transition-transform">
              +
            </span>
          </summary>
          <div className="px-5 pb-4 pt-1 text-slate-300 text-sm leading-relaxed">
            {item.a}
          </div>
        </details>
      ))}
    </div>
  )
}
