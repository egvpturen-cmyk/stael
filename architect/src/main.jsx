import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import Kalibratie from './Kalibratie.jsx'
import './styles.css'

// /kalibratie (of ?kalibratie lokaal) opent de interne kalibratiepagina
const kalibratie = /kalibratie/.test(location.pathname + location.search + location.hash)

createRoot(document.getElementById('wortel')).render(
  <React.StrictMode>
    {kalibratie ? <Kalibratie /> : <App />}
  </React.StrictMode>
)
