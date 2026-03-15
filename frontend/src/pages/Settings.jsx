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

export default function Settings() {
  const { brandName } = useAuth();
  const [apiKey,              setApiKey]              = useState('');
  const [bostaEmail,          setBostaEmail]          = useState('');
  const [bostaPassword,       setBostaPassword]       = useState('');
  const [bostaEmailPassword,  setBostaEmailPassword]  = useState('');
  const [showKey,             setShowKey]             = useState(false);
  const [showPass,            setShowPass]            = useState(false);
  const [showEmailPass,       setShowEmailPass]       = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [msg,           setMsg]           = useState(null);

  useEffect(() => {
    authFetch('/settings')
      .then(r => r.json())
      .then(d => {
        setApiKey(d.bosta_api_key || '');
        setBostaEmail(d.bosta_email || '');
        setBostaPassword(d.bosta_password || '');
        setBostaEmailPassword(d.bosta_email_password || '');
      })
      .catch(() => setMsg({ type: 'error', text: 'Failed to load settings.' }))
      .finally(() => setLoading(false));
  }, []);

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
      }),
    });
    setSaving(false);
    setMsg(res.ok
      ? { type: 'success', text: 'Settings saved.' }
      : { type: 'error',   text: 'Failed to save settings.' });
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
    <div>
      {msg && <Alert type={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

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
    </div>
  );
}
