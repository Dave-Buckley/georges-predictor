/**
 * Tests for the public /how-it-works page (Phase 11 Plan 03 Task 1).
 *
 * The page is a RSC long-scroll explainer with 9 sections, an anchor nav
 * with 9 jump-links, and a FAQ with 4 expandable Q/As.
 *
 * We render the RSC by invoking the default export synchronously and walk
 * the returned element tree — same `extractText` idiom used in standings
 * tests and Phase 10 Plan 02 PDF tests.
 */
import { describe, it, expect } from 'vitest'
import type { ReactElement } from 'react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractText(node: unknown, depth = 0): string {
  if (depth > 80) return ''
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map((n) => extractText(n, depth + 1)).join(' ')
  }
  if (typeof node === 'object' && 'type' in (node as object)) {
    const el = node as ReactElement & {
      type: unknown
      props?: { children?: unknown }
    }
    const children = el.props?.children
    if (typeof el.type === 'function') {
      try {
        const result = (el.type as (p: unknown) => unknown)(el.props ?? {})
        return extractText(result, depth + 1)
      } catch {
        return extractText(children, depth + 1)
      }
    }
    return extractText(children, depth + 1)
  }
  return ''
}

/**
 * Collect all elements of a given HTML tag name (lowercase) from the tree.
 */
function collectByTag(
  node: unknown,
  tag: string,
  acc: Array<{ props: Record<string, unknown> }> = [],
  depth = 0,
): Array<{ props: Record<string, unknown> }> {
  if (depth > 80) return acc
  if (node == null || typeof node === 'boolean') return acc
  if (typeof node === 'string' || typeof node === 'number') return acc
  if (Array.isArray(node)) {
    for (const n of node) collectByTag(n, tag, acc, depth + 1)
    return acc
  }
  if (typeof node === 'object' && 'type' in (node as object)) {
    const el = node as ReactElement & {
      type: unknown
      props?: Record<string, unknown>
    }
    if (typeof el.type === 'string' && el.type === tag) {
      acc.push({ props: (el.props ?? {}) as Record<string, unknown> })
    }
    if (typeof el.type === 'function') {
      try {
        const result = (el.type as (p: unknown) => unknown)(el.props ?? {})
        collectByTag(result, tag, acc, depth + 1)
        return acc
      } catch {
        // Fall through to children
      }
    }
    collectByTag(
      (el.props as { children?: unknown } | undefined)?.children,
      tag,
      acc,
      depth + 1,
    )
  }
  return acc
}

async function renderHowItWorks(): Promise<unknown> {
  const mod = await import('@/app/(public)/how-it-works/page')
  return await mod.default()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('/how-it-works public page', () => {
  it('Test 1: renders without auth (no session/redirect thrown)', async () => {
    const jsx = await renderHowItWorks()
    expect(extractText(jsx).length).toBeGreaterThan(0)
  })

  it('Test 2: contains all 9 section ids matching the spec', async () => {
    const jsx = await renderHowItWorks()
    // Sections use <section id="..."> per plan
    const sections = collectByTag(jsx, 'section')
    const ids = sections.map((s) => s.props.id).filter(Boolean)
    const expected = [
      'welcome',
      'how-to-play',
      'scoring',
      'bonuses',
      'last-one-standing',
      'h2h-steals',
      'pre-season',
      'prizes',
      'faq',
    ]
    for (const id of expected) {
      expect(ids).toContain(id)
    }
  })

  it('Test 3: renders 9 h2 section headings', async () => {
    const jsx = await renderHowItWorks()
    const h2s = collectByTag(jsx, 'h2')
    expect(h2s.length).toBeGreaterThanOrEqual(9)
  })

  it('Test 4: anchor-nav has 9 jump links matching the section ids', async () => {
    const jsx = await renderHowItWorks()
    const anchors = collectByTag(jsx, 'a')
    const hrefs = anchors
      .map((a) => a.props.href)
      .filter((h): h is string => typeof h === 'string')
    const expected = [
      '#welcome',
      '#how-to-play',
      '#scoring',
      '#bonuses',
      '#last-one-standing',
      '#h2h-steals',
      '#pre-season',
      '#prizes',
      '#faq',
    ]
    for (const href of expected) {
      expect(hrefs).toContain(href)
    }
  })

  it('Test 5: scoring section contains the worked example from CONTEXT.md', async () => {
    const jsx = await renderHowItWorks()
    const text = extractText(jsx)
    expect(text).toMatch(/Arsenal/)
    expect(text).toMatch(/Chelsea/)
    expect(text).toMatch(/\b10\b/)
    expect(text).toMatch(/\b30\b/)
  })

  it('Test 6: bonuses section explains Double Bubble and Golden Glory', async () => {
    const jsx = await renderHowItWorks()
    const text = extractText(jsx)
    expect(text).toMatch(/Double Bubble/i)
    expect(text).toMatch(/Golden Glory/i)
    // GW10/20/30 doubling frame
    expect(text).toMatch(/10/)
    expect(text).toMatch(/20/)
    expect(text).toMatch(/30/)
  })

  it('Test 7: FAQ renders 4 <details> disclosures', async () => {
    const jsx = await renderHowItWorks()
    const details = collectByTag(jsx, 'details')
    expect(details.length).toBe(4)
  })

  it('Test 8: FAQ contains the 4 prescribed questions', async () => {
    const jsx = await renderHowItWorks()
    const text = extractText(jsx)
    expect(text).toMatch(/postponed/i)
    expect(text).toMatch(/tie at the top/i)
    expect(text).toMatch(/change my prediction/i)
    expect(text).toMatch(/past seasons/i)
  })

  it('Test 9: includes screenshot img tags referencing /how-it-works/*.png', async () => {
    const jsx = await renderHowItWorks()
    const imgs = collectByTag(jsx, 'img')
    const srcs = imgs
      .map((i) => i.props.src)
      .filter((s): s is string => typeof s === 'string')
    // At least the 5 screenshots called out in the runbook
    const shots = srcs.filter((s) => s.startsWith('/how-it-works/'))
    expect(shots.length).toBeGreaterThanOrEqual(5)
  })
})
