import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import Kalibratie from './Kalibratie.jsx'
import KernTest from './kern/KernTest.jsx'
import './styles.css'

// /kalibratie opent de interne kalibratiepagina; ?kern de testpagina
// van de gebouwmodel-kern
const adres = location.pathname + location.search + location.hash
const pagina = /kern/.test(adres) ? <KernTest />
  : /kalibratie/.test(adres) ? <Kalibratie /> : <App />

createRoot(document.getElementById('wortel')).render(
  <React.StrictMode>{pagina}</React.StrictMode>
)
