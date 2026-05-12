export default function Guide() {
  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.pageTitle}>HOW TO USE THE PLATFORM</span>
      </div>

      <div style={s.body}>
        <div style={s.content}>

          <Section step="1" title="Track Pool — Submitting a track">
            <p>When you have a track to put forward, add it here with <strong>+ add track</strong>. Fill in as much as you know — nothing is mandatory except the title and the WAV file. If you don't have the splits or producer name yet, leave it blank and come back to edit it later using the ✎ button on the track row.</p>
            <p style={{ marginTop: '8px' }}>The form asks for:</p>
            <ul>
              <li>Song file (WAV), instrumental, and TikTok audio</li>
              <li>Track title and artist name</li>
              <li>Featured artist (if any)</li>
              <li>Writer(s) — full legal names</li>
              <li>Songwriter splits (e.g. 50/50) — leave blank if unknown</li>
              <li>Producer(s) — leave blank if unknown</li>
              <li>BPM (auto-detects from the file), key, length, genre</li>
              <li>Explicit or Clean</li>
              <li>Any notes</li>
            </ul>
            <p style={{ marginTop: '8px' }}>Once submitted, the track sits in the pool until Howard decides to move it forward.</p>
          </Section>

          <Section step="2" title="Pipeline — Selected">
            <p>Howard reviews the track and confirms it's the right pick. Hit <strong>Ready to Prepare</strong> to move it into the preparing stage.</p>
          </Section>

          <Section step="3" title="Pipeline — Preparing">
            <p>Howard handles the pre-release checklist — this is all internal admin:</p>
            <ul>
              <li>Master quality check</li>
              <li>Artwork (delivered and approved)</li>
              <li>Writer agreement signed and filed</li>
              <li>Ownership and sample clearance confirmed</li>
              <li>Copyright year confirmed</li>
            </ul>
            <p style={{ marginTop: '8px' }}>Once all items are ticked off, Howard briefs the content creator and moves the track to market.</p>
          </Section>

          <Section step="4" title="Pipeline — In Market">
            <p>The track is live. Howard downloads the <strong>Co-Brand release pack</strong> and sends it to the distributor.</p>
            <ul>
              <li>If proceeding with release — confirm pack sent to Co-Brand and move to Reporting</li>
              <li>If not proceeding — the track is binned at this point</li>
            </ul>
            <p style={{ marginTop: '8px' }}>ISRC and DSP details are handled by Co-Brand at this stage — not before.</p>
          </Section>

          <Section step="5" title="Reporting">
            <p>Once the track is out, log weekly performance using <strong>+ log update</strong> on the card:</p>
            <ul>
              <li>Streams</li>
              <li>TikTok uses</li>
              <li>TikTok views</li>
            </ul>
            <p style={{ marginTop: '8px' }}>Pull the <strong>weekly PDF</strong> or <strong>copy report</strong> to share with the partners.</p>
          </Section>

          <div style={s.divider} />

          <Section step="" title="Other pages">
            <ul>
              <li><strong>Releases</strong> — view of everything currently active</li>
              <li><strong>Reports</strong> — performance overview across all releases</li>
              <li><strong>Profile</strong> — update your name, photo, and password</li>
            </ul>
          </Section>

          <div style={s.divider} />

          <Section step="" title="Chat">
            <ul>
              <li>The <strong>💬</strong> button in the bottom right opens the chat</li>
              <li><strong>All Team</strong> — everyone sees these messages</li>
              <li><strong>Direct messages</strong> — click a person's name to message them privately</li>
              <li>Green dot means they're currently online</li>
              <li>Messages are saved so you can message someone even if they're offline</li>
              <li>Click <strong>✎</strong> next to your own message to edit it</li>
              <li>You'll get a ping sound and browser notification when a new message comes in</li>
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
  page:          { display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 48px)' },
  header:        { padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' },
  pageTitle:     { fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-muted)', fontWeight: 500 },
  body:          { flex: 1, padding: '40px 24px', display: 'flex', justifyContent: 'center' },
  content:       { width: '100%', maxWidth: '680px', display: 'flex', flexDirection: 'column' },
  section:       { padding: '24px 0', borderBottom: '1px solid var(--border)' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' },
  step:          { width: '24px', height: '24px', background: 'var(--bronze)', color: '#fff', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--font)' },
  sectionTitle:  { fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em', color: 'var(--text)', margin: 0 },
  sectionBody:   { fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.7', paddingLeft: '36px' },
  divider:       { height: '1px', background: 'var(--border)', margin: '8px 0' },
}
