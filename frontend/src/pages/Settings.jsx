import { useState, useEffect } from 'react';
import { authFetch } from '../utils/auth.js';
import { useAuth } from '../context/AuthContext.jsx';
import Card, { CardTitle } from '../components/Card.jsx';
import Btn from '../components/Btn.jsx';
import Alert from '../components/Alert.jsx';

const inputStyle = {
  flex: 1,
  background: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 'var(--radius-sm)',
  padding: '.5rem .75rem', fontSize: '.9rem', outline: 'none',
};

const labelStyle = {
  display: 'block', marginBottom: '.5rem',
  fontSize: '.85rem', color: 'var(--muted)', fontWeight: 600,
};

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

function TimePicker({ value, onChange, disabled }) {
  const [h, m] = (value || '09:00').split(':');
  return (
    <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
      <select
        value={h}
        onChange={e => onChange(`${e.target.value}:${m}`)}
        disabled={disabled}
        style={{ ...inputStyle, flex: 'none', width: 70 }}
      >
        {HOURS.map(hh => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <span style={{ color: 'var(--muted)' }}>:</span>
      <select
        value={m}
        onChange={e => onChange(`${h}:${e.target.value}`)}
        disabled={disabled}
        style={{ ...inputStyle, flex: 'none', width: 70 }}
      >
        {MINUTES.map(mm => <option key={mm} value={mm}>{mm}</option>)}
      </select>
      <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>UTC</span>
    </div>
  );
}

export default function Settings() {
  const { brandName } = useAuth();

  // Bosta credentials
  const [apiKey,              setApiKey]              = useState('');
  const [bostaEmail,          setBostaEmail]          = useState('');
  const [bostaPassword,       setBostaPassword]       = useState('');
  const [bostaEmailPassword,  setBostaEmailPassword]  = useState('');
  const [showKey,             setShowKey]             = useState(false);
  const [showPass,            setShowPass]            = useState(false);
  const [showEmailPass,       setShowEmailPass]       = useState(false);

  // Stock alert config
  const [alertEnabled,  setAlertEnabled]  = useState(true);
  const [alertTime1,    setAlertTime1]    = useState('09:00');
  const [alertTime2,    setAlertTime2]    = useState('18:00');
  const [alertTime2On,  setAlertTime2On]  = useState(true);
  const [alertDays,     setAlertDays]     = useState('30');

  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [savingAlert,  setSavingAlert]  = useState(false);
  const [msg,          setMsg]          = useState(null);

  // SMS integration
  const [smsToken,       setSmsToken]       = useState('');
  const [smsIntakeUrl,   setSmsIntakeUrl]   = useState('');
  const [loadingSms,     setLoadingSms]     = useState(true);
  const [regenerating,   setRegenerating]   = useState(false);
  const [copied,         setCopied]         = useState(false);

  useEffect(() => {
    authFetch('/sms/token')
      .then(r => r.json())
      .then(d => { setSmsToken(d.token || ''); setSmsIntakeUrl(d.intake_url || ''); })
      .catch(() => {})
      .finally(() => setLoadingSms(false));
  }, []);

  async function regenerateToken() {
    setRegenerating(true);
    const res = await authFetch('/sms/token/regenerate', { method: 'POST' });
    const d   = await res.json();
    setSmsToken(d.token || '');
    setSmsIntakeUrl(d.intake_url || '');
    setRegenerating(false);
  }

  function copyUrl() {
    navigator.clipboard.writeText(smsIntakeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    authFetch('/settings')
      .then(r => r.json())
      .then(d => {
        setApiKey(d.bosta_api_key || '');
        setBostaEmail(d.bosta_email || '');
        setBostaPassword(d.bosta_password || '');
        setBostaEmailPassword(d.bosta_email_password || '');
        setAlertEnabled(d.alert_enabled !== 'false');
        setAlertTime1(d.alert_time_1 || '09:00');
        const t2 = d.alert_time_2 || '';
        setAlertTime2On(!!t2);
        setAlertTime2(t2 || '18:00');
        setAlertDays(d.alert_low_stock_days || '30');
      })
      .catch(() => setMsg({ type: 'error', text: 'Failed to load settings.' }))
      .finally(() => setLoading(false));
  }, []);

  const _alertPayload = () => ({
    alert_enabled:        alertEnabled ? 'true' : 'false',
    alert_time_1:         alertTime1,
    alert_time_2:         alertTime2On ? alertTime2 : '',
    alert_low_stock_days: alertDays,
  });

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await authFetch('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bosta_api_key:        apiKey.trim(),
        bosta_email:          bostaEmail.trim(),
        bosta_password:       bostaPassword,
        bosta_email_password: bostaEmailPassword,
        ..._alertPayload(),
      }),
    });
    setSaving(false);
    setMsg(res.ok
      ? { type: 'success', text: 'Settings saved.' }
      : { type: 'error',   text: 'Failed to save settings.' });
  }

  async function saveAlert() {
    setSavingAlert(true);
    setMsg(null);
    const res = await authFetch('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bosta_api_key:        apiKey.trim(),
        bosta_email:          bostaEmail.trim(),
        bosta_password:       bostaPassword,
        bosta_email_password: bostaEmailPassword,
        ..._alertPayload(),
      }),
    });
    setSavingAlert(false);
    setMsg(res.ok
      ? { type: 'success', text: 'Alert settings saved.' }
      : { type: 'error',   text: 'Failed to save alert settings.' });
  }

  const toggleBtn = (show, setShow) => (
    <button
      onClick={() => setShow(s => !s)}
      style={{
        background: 'transparent', border: '1px solid var(--border)',
        color: 'var(--muted)', borderRadius: 'var(--radius-sm)',
        padding: '.5rem .75rem', cursor: 'pointer', fontSize: '.85rem',
        whiteSpace: 'nowrap',
      }}
    >
      {show ? 'Hide' : 'Show'}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {msg && <Alert type={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {/* ── Bosta Integration ── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0' }}>
          <CardTitle>Bosta Integration</CardTitle>
          {brandName && (
            <span style={{
              fontSize: '.78rem', fontWeight: 600, color: 'var(--accent)',
              background: 'rgba(249,115,22,.1)', border: '1px solid rgba(249,115,22,.25)',
              borderRadius: '20px', padding: '.2rem .65rem',
            }}>
              {brandName}
            </span>
          )}
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '.9rem', marginBottom: '1.5rem', marginTop: '.5rem' }}>
          Configure your Bosta credentials to enable live stock value fetching and daily automation.
        </p>

        {/* API Key */}
        <label style={labelStyle}>Bosta API Key</label>
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={loading ? '••••••••' : apiKey}
            onChange={e => setApiKey(e.target.value)}
            disabled={loading}
            placeholder="Enter your Bosta API key…"
            style={{ ...inputStyle, fontFamily: 'monospace' }}
          />
          {toggleBtn(showKey, setShowKey)}
        </div>

        {/* Bosta Email */}
        <label style={labelStyle}>Bosta Login Email</label>
        <div style={{ marginBottom: '1.25rem' }}>
          <input
            type="email"
            value={loading ? '' : bostaEmail}
            onChange={e => setBostaEmail(e.target.value)}
            disabled={loading}
            placeholder="email@example.com"
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* Bosta Password */}
        <label style={labelStyle}>Bosta Login Password</label>
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem' }}>
          <input
            type={showPass ? 'text' : 'password'}
            value={loading ? '' : bostaPassword}
            onChange={e => setBostaPassword(e.target.value)}
            disabled={loading}
            placeholder="Your Bosta account password…"
            style={inputStyle}
          />
          {toggleBtn(showPass, setShowPass)}
        </div>

        {/* Gmail App Password */}
        <label style={labelStyle}>Gmail App Password <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(for report email download)</span></label>
        <p style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: '.5rem', marginTop: '-.25rem' }}>
          Generate at Gmail → Settings → Security → 2-Step Verification → App Passwords. Not your Gmail login password.
        </p>
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem' }}>
          <input
            type={showEmailPass ? 'text' : 'password'}
            value={loading ? '' : bostaEmailPassword}
            onChange={e => setBostaEmailPassword(e.target.value)}
            disabled={loading}
            placeholder="xxxx xxxx xxxx xxxx"
            style={{ ...inputStyle, fontFamily: 'monospace' }}
          />
          {toggleBtn(showEmailPass, setShowEmailPass)}
        </div>

        <Btn onClick={save} disabled={saving || loading}>
          {saving ? 'Saving…' : 'Save Settings'}
        </Btn>
      </Card>

      {/* ── Stock Alert Settings ── */}
      <Card>
        <CardTitle>Stock Alert Settings</CardTitle>
        <p style={{ color: 'var(--muted)', fontSize: '.9rem', marginBottom: '1.5rem', marginTop: '.5rem' }}>
          Receive email alerts when items are out of stock or running low. Emails are sent to your Bosta login email above.
        </p>

        {/* Enable toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', marginBottom: '1.5rem' }}>
          <input
            id="alert-enabled"
            type="checkbox"
            checked={alertEnabled}
            onChange={e => setAlertEnabled(e.target.checked)}
            disabled={loading}
            style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <label htmlFor="alert-enabled" style={{ fontSize: '.9rem', color: 'var(--text)', cursor: 'pointer' }}>
            Enable stock alert emails
          </label>
        </div>

        {/* Alert Times */}
        <label style={labelStyle}>Alert Times (UTC)</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '.85rem', color: 'var(--muted)', minWidth: 48 }}>Time 1</span>
            <TimePicker value={alertTime1} onChange={setAlertTime1} disabled={loading || !alertEnabled} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.85rem', color: 'var(--muted)', minWidth: 48 }}>Time 2</span>
            <TimePicker value={alertTime2} onChange={setAlertTime2} disabled={loading || !alertEnabled || !alertTime2On} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.85rem', color: 'var(--muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!alertTime2On}
                onChange={e => setAlertTime2On(!e.target.checked)}
                disabled={loading || !alertEnabled}
                style={{ accentColor: 'var(--accent)' }}
              />
              Disable
            </label>
          </div>
        </div>

        {/* Threshold */}
        <label style={labelStyle}>Low stock threshold</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', marginBottom: '1.5rem' }}>
          <input
            type="number"
            min="1"
            max="365"
            value={alertDays}
            onChange={e => setAlertDays(e.target.value)}
            disabled={loading || !alertEnabled}
            style={{ ...inputStyle, flex: 'none', width: 80, textAlign: 'center' }}
          />
          <span style={{ fontSize: '.9rem', color: 'var(--muted)' }}>days remaining</span>
        </div>

        <Btn onClick={saveAlert} disabled={savingAlert || loading}>
          {savingAlert ? 'Saving…' : 'Save Alert Settings'}
        </Btn>
      </Card>

      {/* ── Bank SMS Integration ── */}
      <Card>
        <CardTitle>Bank SMS Integration</CardTitle>
        <p style={{ color: 'var(--muted)', fontSize: '.9rem', marginBottom: '1.5rem', marginTop: '.5rem' }}>
          Automatically capture CIB deduction messages as cashflow suggestions. Set up an iOS Shortcut that posts each bank SMS to this webhook.
        </p>

        <label style={labelStyle}>Webhook URL (paste into iOS Shortcut)</label>
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
          <input
            readOnly
            value={loadingSms ? 'Loading…' : smsIntakeUrl}
            style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '.78rem', color: 'var(--muted)' }}
            onFocus={e => e.target.select()}
          />
          <button
            onClick={copyUrl}
            disabled={loadingSms || !smsIntakeUrl}
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              color: copied ? 'var(--success)' : 'var(--muted)', borderRadius: 'var(--radius-sm)',
              padding: '.5rem .75rem', cursor: 'pointer', fontSize: '.85rem', whiteSpace: 'nowrap',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <Btn variant="outline" onClick={regenerateToken} disabled={regenerating || loadingSms} style={{ marginBottom: '1.5rem' }}>
          {regenerating ? 'Regenerating…' : 'Regenerate Token'}
        </Btn>

        <details style={{ marginTop: '.25rem' }}>
          <summary style={{ fontSize: '.85rem', color: 'var(--muted)', cursor: 'pointer', fontWeight: 600, marginBottom: '.75rem' }}>
            iOS Shortcut setup instructions
          </summary>
          <ol style={{ fontSize: '.85rem', color: 'var(--muted)', lineHeight: 1.8, paddingLeft: '1.2rem', marginTop: '.5rem' }}>
            <li>Open the <strong>Shortcuts</strong> app → <strong>Automation</strong> tab → <strong>New Automation</strong></li>
            <li>Trigger: <strong>Message</strong> → filter <em>Message Contains</em> → type <code>19666</code></li>
            <li>Add action: <strong>Get Contents of URL</strong>
              <ul style={{ marginTop: '.25rem', listStyle: 'disc', paddingLeft: '1rem' }}>
                <li>URL: paste the webhook URL above</li>
                <li>Method: <strong>POST</strong></li>
                <li>Request Body: <strong>JSON</strong></li>
                <li>Add field <code>body</code> → value: tap <em>Shortcut Input</em></li>
              </ul>
            </li>
            <li>Turn off <strong>"Ask Before Running"</strong> so it fires silently</li>
          </ol>
        </details>
      </Card>
    </div>
  );
}
