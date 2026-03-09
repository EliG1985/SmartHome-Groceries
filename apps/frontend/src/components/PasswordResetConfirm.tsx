import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function PasswordResetConfirm() {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    setStatus('loading');
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus('error');
      setError(error.message);
    } else {
      setStatus('success');
    }
  };

  return (
    <div className="modal-bg">
      <div className="modal">
        <h2>Set New Password</h2>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button onClick={handleReset} disabled={status === 'loading'}>
          Reset Password
        </button>
        {status === 'success' && <p>Password updated! You can now log in.</p>}
        {status === 'error' && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
