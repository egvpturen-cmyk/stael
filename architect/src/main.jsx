import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import Kalibratie from './Kalibratie.jsx'
import KernTest from './kern/KernTest.jsx'
import Reis from './reis/Reis.jsx'
import './styles.css'

// /reis opent de begeleide klantreis met de Architect; /kalibratie de
// interne kalibratiepagina; ?kern de testpagina van de kern
const adres = location.pathname + location.search + location.hash
const pagina = /reis/.test(adres) ? <Reis />
  : /kern/.test(adres) ? <KernTest />
  : /kalibratie/.test(adres) ? <Kalibratie /> : <App />

createRoot(document.getElementById('wortel')).render(
  <React.StrictMode>{pagina}</React.StrictMode>
)
