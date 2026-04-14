import { useState, useRef } from 'react';

export default function DropZone({ onFile }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  const handleChange = (e) => {
    if (e.target.files[0]) onFile(e.target.files[0]);
  };

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${over ? '#6366f1' : '#252840'}`,
        borderRadius: 12,
        padding: '56px 32px',
        textAlign: 'center',
        cursor: 'pointer',
        background: over ? 'rgba(99,102,241,0.06)' : '#12141f',
        transition: 'all .2s',
        userSelect: 'none',
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16, filter: 'drop-shadow(0 0 16px rgba(99,102,241,0.5))' }}>🗼</div>
      <p style={{ fontSize: 16, fontWeight: 600, color: '#e2e4f0', marginBottom: 6 }}>
        Upuść plik tutaj lub kliknij, żeby wybrać
      </p>
      <p style={{ fontSize: 12, color: '#6b7280' }}>.txt / .csv / .log</p>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.csv,.log,text/plain"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </div>
  );
}
