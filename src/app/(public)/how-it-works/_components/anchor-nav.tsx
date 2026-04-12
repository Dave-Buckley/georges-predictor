/**
 * AnchorNav — 9 jump-links to the sections of the /how-it-works page.
 *
 * Layout:
 *   - Desktop: sticky-top pill bar, flex-wrap
 *   - Mobile:  horizontal-scroll strip (overflow-x-auto + whitespace-nowrap)
 *
 * Pure markup; no JS needed for anchor navigation.
 */

interface NavItem {
  id: string
  label: string
}

const ITEMS: NavItem[] = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'how-to-play', label: 'How to play' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'bonuses', label: 'Bonuses' },
  { id: 'last-one-standing', label: 'Last One Standing' },
  { id: 'h2h-steals', label: 'H2H Steals' },
  { id: 'pre-season', label: 'Pre-Season' },
  { id: 'prizes', label: 'Prizes' },
  { id: 'faq', label: 'FAQ' },
]

export function AnchorNav() {
  return (
    <nav
      aria-label="Jump to section"
      className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-slate-800"
    >
      <div className="max-w-4xl mx-auto px-4 py-3 overflow-x-auto">
        <ul className="flex gap-2 whitespace-nowrap">
          {ITEMS.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="inline-block px-3 py-2 rounded-full text-sm font-medium text-slate-300 hover:text-white hover:bg-pl-purple/40 transition border border-slate-700 hover:border-pl-green"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
