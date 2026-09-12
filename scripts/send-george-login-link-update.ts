/**
 * One-shot script: email George about the new "Login link" option for members
 * whose login-code emails don't arrive (added 12 Sep 2026 after Stu got locked
 * out), plus a note that Stu's GW4 picks were entered for him.
 *
 * Resend's sandbox sender can only deliver to Dave, so by default this goes to
 * Dave marked [Forward to George]. Set TO_GEORGE_DIRECT=1 once a verified
 * sending domain exists.
 *
 * Usage: npx tsx scripts/send-george-login-link-update.ts
 */
import { Resend } from 'resend'
import * as fs from 'node:fs'
import * as path from 'node:path'

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnvLocal()

const apiKey = process.env.RESEND_API_KEY
const sendDirect = process.env.TO_GEORGE_DIRECT === '1'
const to = sendDirect ? process.env.ADMIN_EMAIL_GEORGE : process.env.ADMIN_EMAIL_DAVE
const from = process.env.EMAIL_FROM ?? 'King Predictor <onboarding@resend.dev>'

if (!apiKey || !to) {
  console.error('Missing RESEND_API_KEY or recipient env var')
  process.exit(1)
}

const resend = new Resend(apiKey)

const subject = sendDirect
  ? 'King Predictor — new way to get members logged in'
  : '[Forward to George] King Predictor — new way to get members logged in'

const h2 = 'color:#3D195B;border-bottom:2px solid #00FF87;padding-bottom:4px;'

const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1a1a1a;">
  <div style="background:linear-gradient(135deg,#3D195B,#5a2e7c);color:#fff;padding:24px;border-radius:12px;margin-bottom:24px;">
    <h1 style="margin:0;font-size:22pt;letter-spacing:-0.5px;">New: send a member a login link</h1>
    <p style="color:#00FF87;margin:6px 0 0 0;font-weight:600;">12 September 2026</p>
  </div>

  <p>Hi George,</p>
  <p>Stu couldn't get into the app this week — his login code email never arrived, and the login page wrongly told him he didn't have an account. Two things have changed so this doesn't leave anyone stuck again.</p>

  <h2 style="${h2}">1. You can now send someone a login link on WhatsApp</h2>
  <p>If a member says their login code isn't coming through:</p>
  <ol style="line-height:1.7;">
    <li>Go to <a href="https://kingpredictor.vercel.app/admin/members">Admin → Members</a>.</li>
    <li>Find the member and tap <strong>Actions</strong> → <strong>Login link</strong>.</li>
    <li>Tap <strong>Create login link</strong>.</li>
    <li>Tap <strong>Send on WhatsApp</strong> and pick the member's chat. (Or tap <strong>Copy link</strong> and paste it anywhere.)</li>
    <li>They tap the link, then tap <strong>Log me in</strong> — and they're in.</li>
  </ol>
  <p><strong>Good to know:</strong> each link works <strong>once</strong> and runs out after about an hour, so send it straight away. If it's too late, just create a new one — it only takes a second. No email is involved at all.</p>

  <h2 style="${h2}">2. The login page gives better messages</h2>
  <ul style="line-height:1.6;">
    <li>It only says <em>"No account found"</em> if the email really isn't signed up (usually a typo).</li>
    <li>If the email is right but the code can't be sent, it now says so and tells them to try again, use their password if they have one, or <strong>ask you for a login link</strong>.</li>
  </ul>

  <h2 style="${h2}">Stu's GW4 picks</h2>
  <p>The picks Stu sent you on WhatsApp have been entered for him, including his London Derby bonus on Man Utd v Man City. They all count towards his points like everyone else's — you don't need to do anything.</p>

  <p style="margin-top:24px;color:#555;font-size:9pt;">
    Any problems, ping Dave.
  </p>
</div>
`

async function main() {
  const { data, error } = await resend.emails.send({ from, to: [to!], subject, html })
  if (error) {
    console.error('  [fail]', error)
    process.exit(1)
  }
  console.log(`  [ok]   sent to ${sendDirect ? 'George' : 'Dave (to forward)'} (id=${data?.id})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
