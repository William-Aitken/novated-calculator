"use client";
import React, { useState, useRef, useCallback } from 'react';
import type { NovatedLeaseInputs } from '@/utils/leaseMath';

export default function UploadExtract({ onExtract, onResponse }: { onExtract: (fields: Partial<NovatedLeaseInputs> | null) => void, onResponse?: (res: any) => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [debugResponse, setDebugResponse] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const uploadFile = useCallback(async (f: File) => {
    setFileName(f.name);
    setLoading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append('file', f);

      const res = await fetch('/api/extract', {
        method: 'POST',
        body: form,
      });

      // Some server errors or crashes may return empty/non-JSON responses.
      // Read as text first and try JSON.parse, falling back to raw text.
      const text = await res.text();
      let json: any = null;
      try {
        if (text) json = JSON.parse(text);
      } catch (err) {
        json = null;
      }

      if (!res.ok) {
        const errMsg = json?.error || (json ? JSON.stringify(json) : 'Extraction failed');
        setMessage(errMsg);
        onExtract(null);
        const debug = json ?? { rawText: text, status: res.status };
        setDebugResponse(debug);
        if (onResponse) onResponse(debug);
      } else {
        // The server returns a `parsedFields` object which may itself contain
        // a `parsedFields` key (model returned top-level). Unwrap if present.
        const parsed = json?.parsedFields?.parsedFields ?? json?.parsedFields ?? null;
        setMessage(parsed ? 'Extraction succeeded' : 'No fields found');
        onExtract(parsed);
        const debug = json ?? { rawText: text, status: res.status };
        setDebugResponse(debug);
        if (onResponse) onResponse(debug);
      }
    } catch (err: any) {
      setMessage(err?.message || 'Upload failed');
      onExtract(null);
    } finally {
      setLoading(false);
    }
  }, [onExtract]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (f) uploadFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) uploadFile(f);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  return (
    <div className={`upload-extract`}>
      <div
        className={`upload-dropzone ${dragActive ? 'is-dragging' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      >
        <input ref={inputRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} style={{ display: 'none' }} />
        <div className="upload-button-content">
          <img src="/gemini.svg" alt="Gemini" className="upload-icon" aria-hidden />
          <div className="upload-label-wrap">
            <strong className="upload-label">{loading ? 'Uploading...' : 'Upload quote'}</strong>
            <span className="upload-subtext">Use Gemini to analyse</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
        {fileName && <span style={{ fontSize: 12, color: '#666' }}>{fileName}</span>}
        {message && <span style={{ fontSize: 12, color: '#333' }}>{message}</span>}
      </div>
      {/* debugResponse removed to avoid persistent top-right debug panel */}
    </div>
  );
}
