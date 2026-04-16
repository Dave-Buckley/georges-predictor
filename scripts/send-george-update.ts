/**
 * One-shot script: email George a summary of the changes made in the
 * 16 Apr 2026 update session, plus a how-to for moving fixtures between
 * gameweeks. Uses Resend via env vars.
 *
 * Usage: npx tsx scripts/send-george-update.ts
 */
import { Resend } from 'resend'
import * as fs from 'node:fs'
import * as path from 'node:path'

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const contents = fs.readFileSync(envPath, 'utf8')
  for (const line of contents.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const k = trimmed.slice(0, eq).trim()
    let v = trimmed.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnvLocal()

const apiKey = process.env.RESEND_API_KEY
// Resend test mode only permits delivery to the verified account owner.
// Until a custom domain is verified on resend.com, we send to Dave so he
// can forward to George. Toggle via TO_GEORGE_DIRECT=1 if the domain is
// verified and you want to skip the forward.
const sendDirect = process.env.TO_GEORGE_DIRECT === '1'
const to = sendDirect ? process.env.ADMIN_EMAIL_GEORGE : process.env.ADMIN_EMAIL_DAVE
const from = process.env.EMAIL_FROM ?? "George's Predictor <onboarding@resend.dev>"

if (!apiKey || !to) {
  console.error('Missing RESEND_API_KEY or recipient env var')
  process.exit(1)
}

const resend = new Resend(apiKey)

const subject = sendDirect
  ? "George's Predictor — updates shipped + fixture move how-to"
  : "[Forward to George] Predictor — updates shipped + fixture move how-to"

const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1a1a1a;">
  <div style="background:linear-gradient(135deg,#3D195B,#5a2e7c);color:#fff;padding:24px;border-radius:12px;margin-bottom:24px;">
    <h1 style="margin:0;font-size:22pt;letter-spacing:-0.5px;">Predictor — update shipped</h1>
    <p style="color:#00FF87;margin:6px 0 0 0;font-weight:600;">16 April 2026</p>
  </div>

  <h2 style="color:#3D195B;border-bottom:2px solid #00FF87;padding-bottom:4px;">What's new</h2>
  <ul style="line-height:1.6;">
    <li><strong>Bonus rules</strong> now match your final list — all 9 descriptions confirmed.</li>
    <li><strong>Double Bubble</strong> is now one of the rotating bonuses. Pick it from the admin dropdown and members don't have to choose a fixture — their whole gameweek total doubles automatically.</li>
    <li><strong>Prizes synced</strong> to your final list: Smart One Standing, Jackpot 1st (£30/wk), Jackpot 2nd (£10/wk), Last One Standing (£50 per LOS game). Christmas Present bumped to £20. Bore Draw + Fantastic 4 removed.</li>
    <li><strong>Copy to WhatsApp button</strong> on the predictions page — builds a clean message, copies to clipboard, and locks the member's picks for the week. There's a warning dialog before it locks.</li>
    <li><strong>"This week" points column</strong> on the league table and dashboard.</li>
    <li><strong>Predictions page</strong> now sorts fixtures strictly by date (no more Monday-night first).</li>
    <li><strong>How It Works page</strong> and printable members guide rewritten with the new bonus + prize list.</li>
    <li><strong>LOS reminder</strong> pops up when a member taps Update Predictions, so they double-check their LOS pick before resubmitting.</li>
    <li><strong>Rescheduled fixtures</strong> for GW33 bundled in — Brighton vs Chelsea, Bournemouth vs Leeds, Burnley vs Man City moved from GW34.</li>
  </ul>

  <h2 style="color:#3D195B;border-bottom:2px solid #00FF87;padding-bottom:4px;">Moving a fixture into a different gameweek</h2>
  <p>Sometimes a match gets rescheduled or you want to bundle a re-run into the "predictor week" you're actually running. Here's how:</p>
  <ol style="line-height:1.7;">
    <li>Go to <a href="https://georges-predictor.vercel.app/admin/gameweeks">Admin → Gameweeks</a> and open the gameweek the fixture is <em>currently</em> in (e.g. GW34).</li>
    <li>Find the fixture in the list. Each fixture row has action buttons on the right.</li>
    <li>Tap <strong>Move</strong>. A dialog opens letting you pick a target gameweek number.</li>
    <li>Choose the target gameweek (e.g. 33) and confirm.</li>
    <li>The fixture now shows in the target gameweek immediately. Members will see it there the next time they open the predictions page.</li>
  </ol>
  <p><strong>Important:</strong> any fixture you move manually now stays moved. The fifteen-minute API sync used to undo manual moves every run — I fixed that. Your decision wins over what football-data.org says about matchdays.</p>

  <h2 style="color:#3D195B;border-bottom:2px solid #00FF87;padding-bottom:4px;">Adding a brand-new fixture</h2>
  <p>If a match is missing from the API feed entirely:</p>
  <ol style="line-height:1.7;">
    <li>Go to <a href="https://georges-predictor.vercel.app/admin/gameweeks">Admin → Gameweeks</a> and open the gameweek you want to add it to.</li>
    <li>Top-right of the page — tap the purple <strong>+ Add fixture</strong> button.</li>
    <li>Pick home + away teams, enter kickoff date/time, hit Save. Done.</li>
  </ol>

  <h2 style="color:#3D195B;border-bottom:2px solid #00FF87;padding-bottom:4px;">Quick checks weekly</h2>
  <ul style="line-height:1.6;">
    <li>Check <a href="https://georges-predictor.vercel.app/admin/bonuses">Admin → Bonuses</a> each week to confirm or change the active bonus before Friday.</li>
    <li>If a bonus auto-scores wrong (most don't — only Jose Park The Bus and Golden Glory score automatically), you can manually confirm or reject each member's bonus award on that same page.</li>
    <li>After kickoff weekend, peek at the standings to make sure scores look right before sending the weekly PDF pack.</li>
  </ul>

  <p style="margin-top:24px;color:#555;font-size:9pt;">
    Any problems, ping Dave. Keep scoring.<br/>
    — Auto-generated from the deploy on 16 Apr
  </p>
</div>
`

async function main() {
  const { data, error } = await resend.emails.send({
    from,
    to: [to!],
    subject,
    html,
  })

  if (error) {
    console.error('  [fail]', error)
    process.exit(1)
  }

  console.log(`  [ok]   sent to ${to} (id=${data?.id})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
