// Login.js
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${baseUrl}/login`, { email, password });
      localStorage.setItem('tenant_id', res.data.tenant_id);
      setMsg('Login successful');
      if (onLoginSuccess) onLoginSuccess();
      navigate('/');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100vw',
      padding: '40px',
      background: '#f9f9f9',
      boxSizing: 'border-box'
    }}>
      <form onSubmit={handleLogin} style={{
        background: 'white',
        padding: '40px 30px',
        borderRadius: '12px',
        boxShadow: '0 0 25px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '1500px',
        boxSizing: 'border-box',
        marginTop: '20px',
        marginBottom: '20px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '300px' }}>
          <img src="/OH_color-logomark_transparent.png" alt="Logo" style={{ height: '300px', marginBottom: '50px' }} />
          <h3 style={{ marginBottom: '48px', fontSize: '48px' }}>Welcome to bookIT Dashboard</h3>
          <h2 style={{ fontSize: '48px' }}>Login</h2>
          <p style={{ fontSize: '48px' }}>Don't have an account?</p>
          <p style={{ fontSize: '48px' }}>
            <Link to="/register" style={{ color: '#007bff', textDecoration: 'none' }}>
              Create an account
            </Link>
          </p>
        </div>
        <div style={{ marginBottom: '30px' }}>
          <label style={{ fontSize: '48px' }}>Email Address</label>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ccc', borderRadius: '5px', padding: '5px' }}>
            <span style={{ margin: '0 5px', fontSize: '48px' }}>📧</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ border: 'none', outline: 'none', width: '100%' }}
            />
          </div>
        </div>
        <div style={{ marginBottom: '48px' }}>
          <label style={{ fontSize: '48px' }}>Password</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', border: '1px solid #ccc', borderRadius: '5px', padding: '5px' }}>
            <span style={{ margin: '0 5px', fontSize: '48px' }}>🔒</span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ border: 'none', outline: 'none', width: '100%', fontSize: '24px' }}
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
        </div>
        <button type="submit" style={{ width: '100%', padding: '20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '32px' }}>
          Login
        </button>
        {msg && <p style={{ marginTop: '10px', color: 'red', textAlign: 'center' }}>{msg}</p>}
        <p style={{ textAlign: 'center', marginTop: '15px' }}>
          <a href="/forgot-password" style={{ color: '#007bff', textDecoration: 'none', fontSize: '48px' }}>Forgot your password?</a>
        </p>
        <footer style={{ fontSize: '24px', marginTop: '40px', textAlign: 'center', color: '#666' }}>
          <p>Copyright © 2025 Naveon® is a registered trademark of Naveon, LLC.</p>
          
        </footer>
      </form>
    </div>
  );
};

export default Login;
