import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Production-ready main entry point

createRoot(document.getElementById('root')).render(
  <StrictMode>
  
      <App />

  </StrictMode>,
)
