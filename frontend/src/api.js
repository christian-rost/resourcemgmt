// API base URL: in production set via VITE_API_URL env var,
// in development the vite proxy handles /api → localhost:8003
export const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
  : ''
