import { useState, useEffect } from 'react';
import { authFetch } from '../utils/auth.js';
import { S } from '../styles.js';
import Card, { CardTitle } from '../components/Card.jsx';
import Btn from '../components/Btn.jsx';
import Alert from '../components/Alert.jsx';

export default function Settings() {
  const [apiKey,   setApiKey]   = useState('');
  const [show,     setShow]     = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState(null); // {type, text}

  useEffect(() => {
    authFetch('/settings')
      .then(r => r.json())
      .then(d => { setApiKey(d.bosta_api_key || ''); setLoading(false); });
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await authFetch('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bosta_api_key: apiKey.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      setMsg({ type: 'success', text: 'Settings saved.' });
    } else {
      setMsg({ type: 'error', text: 'Failed to save settings.' });
    }
  }

  return (
    <div>
      {msg && <Alert type={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Card>
        <CardTitle>Bosta Integration</CardTitle>
        <p style={{ color: 'var(--muted)', fontSize: '.9rem', marginBottom: '1.25rem' }}>
          Enter your Bosta API key to enable live stock value fetching.
          Find it in your Bosta dashboard under Settings → API.
        </p>

        <label style={{ display: 'block', marginBottom: '.5rem', fontSize: '.85rem', color: 'var(--muted)', fontWeight: 600 }}>
          Bosta API Key
        </label>
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem' }}>
          <input
            type={show ? 'text' : 'password'}
            value={loading ? '••••••••' : apiKey}
            onChange={e => setApiKey(e.target.value)}
            disabled={loading}
            placeholder="Enter your Bosta API key..."
            style={{
              flex: 1,
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text)', borderRadius: 'var(--radius-sm)',
              padding: '.5rem .75rem', fontSize: '.9rem', outline: 'none',
              fontFamily: 'monospace'
            }}
          />
          <button
            onClick={() => setShow(s => !s)}
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--muted)', borderRadius: 'var(--radius-sm)',
              padding: '.5rem .75rem', cursor: 'pointer', fontSize: '.85rem',
              whiteSpace: 'nowrap'
            }}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        </div>

        <Btn onClick={save} disabled={saving || loading}>
          {saving ? 'Saving…' : 'Save Settings'}
        </Btn>
      </Card>
    </div>
  );
}
