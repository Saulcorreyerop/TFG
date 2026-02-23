import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Github, Twitter } from 'lucide-react'

// Componente fuera para evitar el error "Cannot create components during render"
const FooterLink = ({ label, to, navigate }) => (
  <li>
    <button onClick={() => navigate(to)} className='footer-link-btn'>
      <ChevronRight size={14} className='link-arrow' />
      <span>{label}</span>
    </button>
  </li>
)

const Footer = () => {
  const navigate = useNavigate()
  const currentYear = new Date().getFullYear()

  return (
    <footer className='footer-premium'>
      <div className='footer-container'>
        <div className='footer-grid'>
          {/* MARCA */}
          <div className='footer-brand'>
            <div className='footer-logo'>
              {/* Logo desde la carpeta public */}
              <img
                src='/logo.png'
                alt='CarMeet ESP Logo'
                style={{ width: '40px', height: 'auto', borderRadius: '8px' }}
              />
              <span className='logo-text'>
                CarMeet <span className='text-flag-esp'>ESP</span>
              </span>
            </div>
            <p className='brand-description'>
              La plataforma líder para entusiastas del motor en España.
              Encuentra rutas, eventos y conecta con la comunidad.
            </p>
            <div className='social-links'>
              <a href='#' className='social-btn'>
                <Twitter size={18} />
              </a>
              <a href='#' className='social-btn'>
                <Github size={18} />
              </a>
            </div>
          </div>

          {/* NAVEGACIÓN */}
          <div className='footer-nav-col'>
            <h4 className='nav-title'>Explorar</h4>
            <ul className='nav-list'>
              <FooterLink label='Mapa en Vivo' to='/mapa' navigate={navigate} />
              <FooterLink
                label='Eventos y KDDs'
                to='/eventos'
                navigate={navigate}
              />
              <FooterLink
                label='Comunidad'
                to='/comunidad'
                navigate={navigate}
              />
              <FooterLink label='Perfil' to='/perfil' navigate={navigate} />
            </ul>
          </div>

          {/* LEGAL */}
          <div className='footer-nav-col'>
            <h4 className='nav-title'>Soporte</h4>
            <ul className='nav-list'>
              <FooterLink
                label='Privacidad y Términos'
                to='/privacidad'
                navigate={navigate}
              />
              <FooterLink label='Contacto' to='/contacto' navigate={navigate} />
            </ul>
          </div>
        </div>

        {/* BARRA INFERIOR */}
        <div className='footer-bottom'>
          <div className='copyright'>
            © {currentYear} CarMeet ESP. Proyecto Final de Ciclo DAW.
          </div>
          <div className='version'>Saúl Correyero Pañero</div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
