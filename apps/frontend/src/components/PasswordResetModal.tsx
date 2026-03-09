import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function PasswordResetModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSendReset = async () => {
    setStatus('loading');
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password'
    });
    if (error) {
      setStatus('error');
      setError(error.message);
    } else {
      setStatus('sent');
    }
  };

  return (
    <div className="modal-bg">
      <div className="modal">
        <h2>Reset Password</h2>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button onClick={handleSendReset} disabled={status === 'loading'}>
          Send Reset Link
        </button>
        {status === 'sent' && <p>Check your email for a reset link.</p>}
        {status === 'error' && <p className="error">{error}</p>}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
