import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { InputText } from 'primereact/inputtext'
import { Button } from 'primereact/button'
import { Avatar } from 'primereact/avatar'
import { useNavigate } from 'react-router-dom'
import PageTransition from '../components/PageTransition'
import SEO from '../components/SEO'
import BotonDenunciar from '../components/BotonDenunciar'
import { useBloqueo } from '../hooks/useModeracion'

const GlobalChatPage = ({ session }) => {
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [aviso, setAviso] = useState(null)
  const scrollRef = useRef(null)

  const { filtrar } = useBloqueo(session)

  /* Un mensaje no puede pasar de 1000 caracteres: lo impone tambien una
     restriccion en la base de datos, aqui solo se avisa antes. */
  const MAX = 1000

  const myUsername = session?.user?.user_metadata?.username

  useEffect(() => {
    if (!session) return

    const fetchMessages = async () => {
      // Intentar cargar mensajes de la tabla global
      const { data, error } = await supabase
        .from('global_messages')
        .select('*, profiles(username, avatar_url)')
        .order('created_at', { ascending: true })
        .limit(100) // solo últimos 100
      
      if (!error && data) {
        setMessages(data)
      } else if (error && error.code === '42P01') {
        console.error("Falta crear la tabla 'global_messages' en Supabase.")
      }
    }

    fetchMessages()

    const channel = supabase
      .channel('chat_global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'global_messages' },
        async (payload) => {
          if (payload.new.user_id === session.user.id) return

          const { data: profileData } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', payload.new.user_id)
            .single()
            
          const completeMessage = {
             ...payload.new,
             profiles: profileData || { username: 'Piloto' }
          }

          setMessages((prev) => {
            if (prev.some(m => m.id === completeMessage.id)) return prev
            return [...prev, completeMessage]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !session) return

    const msgToSend = newMessage.trim().slice(0, MAX)
    setNewMessage('')
    setAviso(null)

    const optimisticMessage = {
      id: Date.now(),
      user_id: session.user.id,
      mensaje: msgToSend,
      created_at: new Date().toISOString(),
      profiles: {
        username: myUsername || 'Tú',
        avatar_url: session.user.user_metadata?.avatar_url || null
      }
    }

    setMessages((prev) => [...prev, optimisticMessage])

    const { data: insertedMsg, error } = await supabase.from('global_messages').insert({
      user_id: session.user.id,
      mensaje: msgToSend,
    }).select().single()

    if (error) {
      /*
       * Se quita el mensaje optimista. Antes se quedaba pintado como si
       * se hubiera enviado aunque el insert hubiera fallado, asi que el
       * autor creia haber escrito algo que nadie recibio.
       */
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id))
      setNewMessage(msgToSend)

      // P0001 lo lanza el trigger de ritmo de la base de datos
      setAviso(
        error.code === 'P0001'
          ? 'Vas muy rapido. Espera unos segundos.'
          : 'No se ha podido enviar. Reintentalo.',
      )
      console.error('Error al enviar mensaje:', error)
    } else {
      setMessages(prev => prev.map(m => m.id === optimisticMessage.id ? { ...m, id: insertedMsg.id } : m))
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen flex align-items-center justify-content-center surface-ground">
        <div className="text-center surface-card p-5 border-round-2xl shadow-2 max-w-sm">
          <i className="pi pi-lock text-6xl text-blue-500 mb-4"></i>
          <h2 className="m-0 mb-3 text-color font-black">Chat Global</h2>
          <p className="text-color-secondary mb-4">Inicia sesión para hablar con toda la comunidad.</p>
          <Button label="Ir a Login" className="p-button-primary w-full border-round-xl font-bold" onClick={() => navigate('/login', { state: { returnUrl: '/chat-global' } })} />
        </div>
      </div>
    )
  }

  return (
    <>
      <SEO title='Chat Global' description='Habla en tiempo real con toda la comunidad de CarMeet.' url={window.location.href} />
      <PageTransition>
        <div className="min-h-screen surface-ground p-4 md:p-6 pb-8 flex flex-column align-items-center">
          <div className="w-full max-w-5xl h-full flex flex-column surface-card relative overflow-hidden" style={{ borderRadius: 'var(--r)', border: '1px solid var(--surface-border)', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', height: '80vh' }}>
            
            {/* HEADER DEL CHAT */}
            <div className="p-4 surface-card border-bottom-1 surface-border flex justify-content-between align-items-center shadow-1 z-1 relative">
              <div className="flex align-items-center gap-3">
                <div className="w-3rem h-3rem surface-hover border-circle flex align-items-center justify-content-center">
                  <i className="pi pi-globe text-blue-500 text-xl"></i>
                </div>
                <div>
                  <h1 className="m-0 font-black text-color text-2xl">Chat Global</h1>
                  <span className="text-green-500 font-bold text-sm flex align-items-center gap-1"><span className="w-1rem h-1rem bg-green-500 border-circle block" style={{ transform: 'scale(0.5)' }}></span> En línea</span>
                </div>
              </div>
            </div>

            {/* ZONA DE LECTURA */}
            <div ref={scrollRef} className="flex-1 p-4 md:p-6 overflow-y-auto" style={{ backgroundColor: 'var(--surface-ground)', backgroundImage: 'radial-gradient(var(--linea-viva) 1px, transparent 0)', backgroundSize: '20px 20px' }}>
              {messages.length === 0 ? (
                <div className="h-full flex flex-column align-items-center justify-content-center text-color-secondary">
                  <i className="pi pi-comments text-6xl mb-3 text-300"></i>
                  <h3 className="m-0 font-black text-xl text-color mb-2">Bienvenido al Chat Global</h3>
                  <p className="font-medium text-center max-w-sm">Manda un mensaje para saludar a la comunidad. (Nota: Requiere tabla 'global_messages' en Supabase)</p>
                </div>
              ) : (
                filtrar(messages).map((msg, idx) => {
                  const isMe = msg.user_id === session?.user?.id;
                  
                  return (
                    <div key={msg.id || idx} className={`mb-4 flex ${isMe ? 'justify-content-end' : 'justify-content-start'}`}>
                      <div className={`flex flex-column ${isMe ? 'align-items-end' : 'align-items-start'} max-w-20rem md:max-w-30rem`}>
                        
                        {!isMe && (
                          <div className='chat-autor'>
                            <button
                              type='button'
                              className='chat-nombre'
                              onClick={() => navigate(`/usuario/${msg.profiles?.username}`)}
                            >
                              {msg.profiles?.username || 'Piloto'}
                            </button>
                            <BotonDenunciar
                              tipo='mensaje_global'
                              id={msg.id}
                              autorId={msg.user_id}
                              autor={msg.profiles?.username || 'este piloto'}
                              session={session}
                              compacto
                            />
                          </div>
                        )}

                        <div className="flex align-items-end gap-2">
                          {!isMe && (
                            <Avatar 
                              image={msg.profiles?.avatar_url} 
                              icon={!msg.profiles?.avatar_url && 'pi pi-user'} 
                              shape="circle" 
                              size="large" 
                              className="shadow-1 flex-shrink-0 cursor-pointer" 
                              onClick={() => navigate(`/usuario/${msg.profiles?.username}`)}
                            />
                          )}
                          
                          <div 
                            className={`p-3 shadow-2 ${isMe ? 'text-white' : 'surface-card text-color border-1 surface-border'}`}
                            style={{ 
                              background: isMe ? 'linear-gradient(135deg, var(--librea) 0%, var(--librea) 100%)' : 'var(--surface-card)',
                              borderBottomLeftRadius: 'var(--r-media)',
                              borderBottomRightRadius: 'var(--r-media)',
                              borderTopRightRadius: isMe ? '0' : 'var(--r-media)', 
                              borderTopLeftRadius: !isMe ? '0' : 'var(--r-media)',
                              fontSize: '1rem',
                              lineHeight: '1.5'
                            }}
                          >
                            {msg.mensaje}
                            <div className={`text-right mt-1 ${isMe ? 'text-blue-200' : 'text-400'}`} style={{ fontSize: '0.7rem' }}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ZONA DE ESCRITURA */}
            {aviso && (
              <div className='chat-aviso' role='alert'>
                {aviso}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="p-4 surface-card border-top-1 surface-border flex gap-3 align-items-center shadow-1 z-1 relative">
              <InputText
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value.slice(0, MAX))}
                maxLength={MAX}
                placeholder="Escribe un mensaje para todos..."
                className="flex-1 surface-ground border-none px-4 py-3 text-color font-medium text-lg"
                style={{ borderRadius: 'var(--r)' }}
              />
              <Button 
                type="submit" 
                icon="pi pi-send" 
                className="shadow-3 border-none" 
                style={{ borderRadius: '50%', width: '3.5rem', height: '3.5rem', background: 'linear-gradient(135deg, var(--librea) 0%, var(--librea) 100%)' }}
                disabled={!newMessage.trim()} 
                aria-label="Enviar"
              />
            </form>
          </div>
        </div>
      </PageTransition>
    </>
  )
}

export default GlobalChatPage
