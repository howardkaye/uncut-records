export default function Guide() {
  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.pageTitle}>HOW IT WORKS</div>
      </div>
      <div style={s.body}>
        <div style={s.content}>

          <Section step="1" title="Track Pool">
            <p>Where tracks come in. Hit <strong>+ Upload</strong> to add a track — drop in the audio file and fill in what you know. BPM and length auto-detect from the file. You can always edit it later.</p>
            <p style={{ marginTop: '8px' }}>Click ▶ on any row to preview the track in the player at the bottom. When you're happy with a track, hit <strong>Select</strong> in the player to send it straight to the pipeline.</p>
          </Section>

          <Section step="2" title="Pipeline — four stages">
            <p><strong>Selected</strong> — Track is queued. Hit the → button on the card when you're ready to start work.</p>
            <p style={{ marginTop: '10px' }}><strong>Preparing</strong> — Work through the distribution checklist: audio sign-off, artwork upload, writer agreement, rights clearance. Once the checklist is done, use the <strong>Send to Content Creator</strong> and <strong>Send to Ads Team</strong> buttons to brief the team, then advance to In Market.</p>
            <p style={{ marginTop: '10px' }}><strong>In Market</strong> — Track is live and being promoted. The distribution checklist is visible here too. When the release is confirmed and ready to report on, advance to Reporting.</p>
            <p style={{ marginTop: '10px' }}><strong>Reporting</strong> — Track is out. Weekly performance data gets logged here.</p>
          </Section>

          <Section step="3" title="Reports">
            <p>Two tabs:</p>
            <ul style={{ marginTop: '8px' }}>
              <li><strong>Performance</strong> — streaming stats and checklist progress across all releases. Copy or export as a weekly PDF.</li>
              <li><strong>Tease Reports</strong> — TikTok performance reports submitted by the content team. Shows total videos, views, likes, and like-to-view ratio per account and combined. Top 5 by views and top 5 by likes. Export as CSV or PDF to send to Marc.</li>
            </ul>
          </Section>

          <Section step="4" title="Submitting a tease report">
            <p>Go to <strong>Reports → Tease Reports</strong> and scroll to the active release. Hit <strong>+ add account</strong>, enter the account name, then add a row for each video — just views and likes. Add as many accounts and videos as needed. Submit. You can submit multiple times across the week — each one appends to the running report.</p>
          </Section>

          <div style={s.divider} />

          <Section step="" title="Vault">
            <p>Archived releases with their final performance data. Tracks land here when removed from the pipeline.</p>
          </Section>

          <Section step="" title="Chat">
            <ul>
              <li>The <strong>💬</strong> button in the bottom right opens the chat</li>
              <li><strong>All Team</strong> — everyone sees these messages</li>
              <li><strong>Direct messages</strong> — click a name to message privately</li>
              <li>Green dot means they're currently online</li>
              <li>Click <strong>✎</strong> next to your own message to edit it</li>
            </ul>
          </Section>

        </div>
      </div>
    </div>
  )
}

function Section({ step, title, children }) {
  return (
    <div style={s.section}>
      <div style={s.sectionHeader}>
        {step && <span style={s.step}>{step}</span>}
        <h2 style={s.sectionTitle}>{title}</h2>
      </div>
      <div style={s.sectionBody}>{children}</div>
    </div>
  )
}

const s = {
  page:          { display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 60px)', background: '#fff' },
  header:        { padding: '20px 32px 16px', borderBottom: '1px solid var(--border)' },
  pageTitle:     { fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 900, color: 'var(--green)', letterSpacing: '-0.01em', lineHeight: 0.9, fontVariationSettings: '"YEAR" 2050' },
  body:          { flex: 1, padding: '40px 32px', display: 'flex', justifyContent: 'center' },
  content:       { width: '100%', maxWidth: '680px', display: 'flex', flexDirection: 'column' },
  section:       { padding: '24px 0', borderBottom: '1px solid var(--border)' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' },
  step:          { width: '26px', height: '26px', background: 'var(--pink)', color: 'var(--green)', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--font)', borderRadius: '50%' },
  sectionTitle:  { fontFamily: 'var(--font)', fontSize: '14px', fontWeight: 600, color: 'var(--green)', margin: 0, letterSpacing: '0.02em' },
  sectionBody:   { fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, paddingLeft: '40px' },
  divider:       { height: '1px', background: 'var(--border)', margin: '8px 0' },
}
