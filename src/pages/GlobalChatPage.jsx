import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import PageTransition from '../components/PageTransition'
import SEO from '../components/SEO'
import CanalChat from '../components/CanalChat'
import './GlobalChatPage.css'

/*
 * Chat global.
 *
 * La página es solo el marco: quién puede entrar y cuánto espacio ocupa.
 * El registro en sí vive en CanalChat, que comparte con el chat de cada
 * crew: mismo comportamiento, distinta tabla.
 */

const GlobalChatPage = ({ session }) => {
  const navigate = useNavigate()

  if (!session) {
    return (
      <>
        <SEO
          title='Chat Global'
          description='Habla en directo con toda la comunidad de CarMeet.'
          url={window.location.href}
        />
        <PageTransition>
          <div className='chat-cerrado'>
            <div className='chat-cerrado-caja'>
              <Lock size={28} aria-hidden='true' />
              <h1>Canal cerrado</h1>
              <p>
                El chat global es solo para gente registrada. Entra y únete a
                la conversación.
              </p>
              <button
                type='button'
                className='btn-librea'
                onClick={() =>
                  navigate('/login', { state: { returnUrl: '/chat-global' } })
                }
              >
                Iniciar sesión
              </button>
            </div>
          </div>
        </PageTransition>
      </>
    )
  }

  return (
    <>
      <SEO
        title='Chat Global'
        description='Habla en directo con toda la comunidad de CarMeet.'
        url={window.location.href}
      />
      <PageTransition>
        <div className='chat'>
          <CanalChat
            session={session}
            tabla='global_messages'
            tipoDenuncia='mensaje_global'
            titulo='Canal abierto'
            estado='En directo'
          />
        </div>
      </PageTransition>
    </>
  )
}

export default GlobalChatPage
