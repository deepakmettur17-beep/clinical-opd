import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button, Input } from '../components/UI';

/**
 * VerifyPage - Medico-Legal Document Verification Portal (v3.1)
 * -------------------------------------------------------------
 * Allows clinicians, insurers, and administrators to verify the 
 * cryptographic authenticity of hospital reports.
 */
export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const [docId, setDocId] = useState(searchParams.get('docId') || '');
  const [version, setVersion] = useState(searchParams.get('v') || '');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Auto-verify if params are present in URL (from QR code)
  useEffect(() => {
    if (searchParams.get('docId') && searchParams.get('v')) {
       handleVerify();
    }
    // eslint-disable-next-line
  }, []);

  const handleVerify = async () => {
    if (!docId || !version) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/clinical/verify/${docId}?v=${version}`);
      if (!res.ok) throw new Error("Registry query failed");
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError("System connection error. Unable to reach clinical registry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', color: '#1a237e', marginBottom: '8px' }}>🛡️ Clinical Document Verification</h1>
        <p style={{ color: '#666' }}>Verify the authenticity of Medico-Legal Grade hospital reports (v3.1)</p>
      </header>

      <Card style={{ padding: '32px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', backgroundColor: '#fff' }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}>Document ID</label>
            <Input 
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              placeholder="e.g., discharge-123456"
              style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}>Version</label>
            <Input 
              type="number"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="v1"
              style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}
            />
          </div>
        </div>
        
        <Button 
          onClick={handleVerify} 
          disabled={loading || !docId || !version}
          style={{ 
            width: '100%', 
            padding: '14px', 
            backgroundColor: '#1a237e', 
            fontSize: '15px', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? "⌛ Querying Registry..." : "Verify Document"}
        </Button>
      </Card>

      {result && (
        <section className="fade-in" style={{ marginTop: '32px' }}>
          {result.status === 'VALID' ? (
            <Card style={{ borderLeft: '8px solid #43a047', backgroundColor: '#f1f8e9', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                 <div style={{ fontSize: '40px' }}>✅</div>
                 <div>
                    <h2 style={{ color: '#2e7d32', margin: 0, fontSize: '24px' }}>DOCUMENT AUTHENTIC</h2>
                    <p style={{ margin: 0, fontSize: '14px', color: '#555' }}>Cryptographic signature verified by server registry snaphot.</p>
                 </div>
              </div>
              <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '16px', fontSize: '14px', color: '#333' }}>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
                    <strong>Generated At:</strong> <span>{new Date(result.metadata.generatedAt).toLocaleString()}</span>
                    <strong>Document Type:</strong> <span>{result.metadata.type?.toUpperCase()}</span>
                    <strong>Version:</strong> <span>v{result.metadata.version}</span>
                    <strong>Signatory:</strong> <span>{result.metadata.generatedBy?.name} ({result.metadata.generatedBy?.role})</span>
                    <strong>Case ID:</strong> <span>{result.metadata.caseId}</span>
                 </div>
                 <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fff', borderRadius: '8px', border: '1px dashed #ccc' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#999', marginBottom: '4px' }}>SHA256 FINGERPRINT</div>
                    <code style={{ wordBreak: 'break-all', fontSize: '12px', color: '#1a237e' }}>{result.metadata.hash}</code>
                 </div>
              </div>
            </Card>
          ) : result.status === 'REVOKED' ? (
            <Card style={{ borderLeft: '8px solid #fbc02d', backgroundColor: '#fffde7', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                 <div style={{ fontSize: '40px' }}>⚠️</div>
                 <div>
                    <h2 style={{ color: '#f57f17', margin: 0, fontSize: '24px' }}>DOCUMENT REVOKED</h2>
                    <p style={{ margin: 0, fontSize: '14px', color: '#555' }}>This version has been superseded by a newer generation or manually revoked.</p>
                 </div>
              </div>
            </Card>
          ) : (
            <Card style={{ borderLeft: '8px solid #e53935', backgroundColor: '#ffebee', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                 <div style={{ fontSize: '40px' }}>❌</div>
                 <div>
                    <h2 style={{ color: '#c62828', margin: 0, fontSize: '24px' }}>INVALID DOCUMENT</h2>
                    <p style={{ margin: 0, fontSize: '14px', color: '#b71c1c' }}>{result.message || result.reason}</p>
                 </div>
              </div>
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fff', borderRadius: '8px', fontSize: '13px', color: '#666' }}>
                SECURITY NOTICE: This document ID does not match any current or past cryptographic snapshots in our clinical registry.
              </div>
            </Card>
          )}
        </section>
      )}

      {error && (
        <div className="fade-in" style={{ marginTop: '24px', padding: '16px', backgroundColor: '#ffebee', borderRadius: '8px', color: '#c62828', textAlign: 'center', fontWeight: 'bold' }}>
          {error}
        </div>
      )}

      <footer style={{ marginTop: '60px', textAlign: 'center', fontSize: '12px', color: '#999' }}>
        <p>© 2026 Metropolitan General Hospital - Clinical OS. All documents are cryptographically signed.</p>
      </footer>
    </div>
  );
}
