import { useState, useRef } from 'react';

export default function DropZone({ onFile, file }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const handle = f => {
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) onFile(f);
  };

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${drag ? 'var(--accent)' : 'var(--border2)'}`,
        borderRadius: 'var(--radius)',
        padding: '2.5rem 1rem', textAlign: 'center', cursor: 'pointer',
        background: drag ? 'rgba(249,115,22,.08)' : 'var(--surface2)',
        transition: 'all .2s', position: 'relative'
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={e => handle(e.target.files[0])}
      />
      <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📊</div>
      <p style={{ color: 'var(--text)', fontWeight: 500, fontSize: '.9rem' }}>
        {file ? file.name : <><strong>Click to choose</strong> or drag &amp; drop</>}
      </p>
      <p style={{ color: 'var(--muted)', fontSize: '.8rem', marginTop: '.25rem' }}>
        {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Accepts .xlsx / .xls'}
      </p>
    </div>
  );
}
