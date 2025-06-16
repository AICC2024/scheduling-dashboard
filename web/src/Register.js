// Register.js
import React, { useState } from 'react';
import axios from 'axios';

const baseUrl = process.env.REACT_APP_API_BASE_URL;

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      // Register the user
      await axios.post(`${baseUrl}/register`, { email, password });

      // Immediately log in with the same credentials
      const loginRes = await axios.post(`${baseUrl}/login`, { email, password });

      // Store tenant ID and redirect
      sessionStorage.setItem('tenant_id', loginRes.data.tenant_id);
      window.location.href = '/';
    } catch (err) {
      setMsg(err.response?.data?.error || 'Registration or login failed');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <form onSubmit={handleRegister} style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '1500px',
        padding: '40px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9',
        boxSizing: 'border-box'
      }}>
        <img src="/OH_color-logomark_transparent.png" alt="Logo" style={{ height: '300px', marginBottom: '20px', alignSelf: 'center' }} />
        <h3 style={{ marginBottom: '48px', fontSize: '48px', textAlign: 'center' }}>Welcome to bookIT Dashboard</h3>
        <h2 style={{ fontSize: '48px', textAlign: 'center', marginBottom: '32px' }}>Create Account</h2>
        <input
          type="email"
          placeholder="📧 Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ marginBottom: '16px', padding: '12px', fontSize: '48px' }}
        />
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="🔒 Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: '12px', fontSize: '48px', width: '99%', paddingRight: '1px' }}
          />
          <span
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '48px',
              top: '50%',
              transform: 'translateY(-50%)',
              cursor: 'pointer',
              fontSize: '36px'
            }}
            role="button"
            aria-label="Toggle password visibility"
          >
            {showPassword ? '🙈' : '👁️'}
          </span>
        </div>
        <button type="submit" style={{ padding: '12px', fontSize: '48px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px' }}>
          Continue
        </button>
        <p style={{ marginTop: '16px', color: 'green', textAlign: 'center' }}>{msg}</p>
        <footer style={{ fontSize: '24px', marginTop: '40px', textAlign: 'center', color: '#666' }}>
          <p>Copyright © 2025 Naveon® is a registered trademark of Naveon, LLC.</p>
        </footer>
      </form>
    </div>
  );
};

export default Register;