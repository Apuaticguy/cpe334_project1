import { useState, useEffect } from 'react';

interface HealthStatus {
  status: string;
  service: string;
  timestamp: string;
}

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to QuickOrder API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container">
          <a className="navbar-brand fw-bold" href="#">
            <i className="bi bi-bag-check-fill me-2 text-primary"></i>QuickOrder
          </a>
          <span className="navbar-text text-light small">
            Theme 4: E-Commerce & Ordering System
          </span>
        </div>
      </nav>

      <main className="container my-5">
        <div className="card shadow-sm p-4">
          <h2 className="h4 fw-bold mb-3">System Baseline Verification</h2>
          <p className="text-muted">
            Sprint 1 baseline initialized. The service status below verifies connectivity to the Express backend.
          </p>

          <div className="mt-3">
            <button 
              className="btn btn-primary" 
              onClick={checkHealth}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Checking...
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-repeat me-1"></i> Check Health Status
                </>
              )}
            </button>
          </div>

          <div className="mt-4">
            {health && (
              <div className="alert alert-success d-flex align-items-center" role="alert">
                <i className="bi bi-check-circle-fill fs-4 me-3"></i>
                <div>
                  <strong>Status:</strong> {health.status.toUpperCase()} &bull; <strong>Service:</strong> {health.service}
                  <div className="small text-muted">{health.timestamp}</div>
                </div>
              </div>
            )}

            {error && (
              <div className="alert alert-danger d-flex align-items-center" role="alert">
                <i className="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
                <div>
                  <strong>Backend Offline:</strong> {error}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
