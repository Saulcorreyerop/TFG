import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { Button } from 'primereact/button'
import { Toast } from 'primereact/toast'
import PageTransition from '../components/PageTransition'
import { Zap, ShieldCheck } from 'lucide-react'

import './AuthPage.css'
import SEO from '../components/SEO'

const LOGIN_IMAGE =
  'https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?auto=format&fit=crop&q=80&w=1200'
const REGISTER_IMAGE =
  'https://images.unsplash.com/photo-1493238792000-8113da705763?auto=format&fit=crop&q=80&w=1200'

const AuthPage = ({ session }) => {
  const toast = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [isLogin, setIsLogin] = useState(true)

  const [loginInput, setLoginInput] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')

  // Recuperación de contraseña
  const [recuperando, setRecuperando] = useState(false)
  const [emailRecuperar, setEmailRecuperar] = useState('')
  const [enviadoRecuperar, setEnviadoRecuperar] = useState(false)

  useEffect(() => {
    if (session) {
      setLoading(false)

      if (location.state?.returnUrl) {
        navigate(location.state.returnUrl, { replace: true })
      } else if (window.history.length > 2) {
        navigate(-1)
      } else {
        navigate('/', { replace: true })
      }
    }
  }, [session, navigate, location.state])

  useEffect(() => {
    if (location.state && location.state.activeIndex === 1) {
      setIsLogin(false)
    }
  }, [location.state])

  /*
   * Entrada con nombre de usuario.
   *
   * Antes esto se resolvía aquí, en el navegador, leyendo la columna
   * `email` de `profiles`. Esa columna hacía que el correo de todos los
   * usuarios fuese descargable por cualquiera con una sola petición a la
   * API. Ahora lo hace netlify/functions/loginUsuario.js, que busca el
   * correo en el servidor y devuelve solo los tokens de sesión.
   */
  const entrarConUsuario = async (usuario, password) => {
    const res = await fetch('/.netlify/functions/loginUsuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password }),
    })

    const tipo = res.headers.get('content-type') || ''
    const datos = tipo.includes('application/json')
      ? await res.json().catch(() => ({}))
      : null

    /* Dos casos en los que la función no está disponible: en `npm run
       dev` no existe (responde el index.html de Vite), y en Netlify
       responde 501 mientras falten las variables de entorno. En ambos se
       usa el camino antiguo, que sigue funcionando hasta que se elimine
       la columna. */
    if (datos === null || (res.status === 501 && datos.sinConfigurar)) {
      return entrarLeyendoPerfiles(usuario, password)
    }

    if (!res.ok || !datos.access_token) {
      throw new Error(datos.error || 'Usuario o contraseña incorrectos.')
    }

    const { error } = await supabase.auth.setSession({
      access_token: datos.access_token,
      refresh_token: datos.refresh_token,
    })
    if (error) throw error
  }

  /* Camino antiguo. Se puede borrar en cuanto `profiles.email` deje de
     existir y las variables estén puestas en Netlify. */
  const entrarLeyendoPerfiles = async (usuario, password) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', usuario)
      .maybeSingle()

    if (error || !data?.email) {
      throw new Error('Usuario o contraseña incorrectos.')
    }

    const { error: fallo } = await supabase.auth.signInWithPassword({
      email: data.email,
      password,
    })
    if (fallo) throw fallo
  }

  // --- LOGIN ---
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const entrada = loginInput.trim()

      if (entrada.includes('@')) {
        const { error } = await supabase.auth.signInWithPassword({
          email: entrada,
          password: loginPassword,
        })
        if (error) {
          setLoading(false)
          throw error
        }
      } else {
        await entrarConUsuario(entrada, loginPassword)
      }

      toast.current.show({
        severity: 'success',
        summary: 'Bienvenido',
        detail: 'Autenticando...',
        life: 2000,
      })
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: error.message,
      })
      setLoading(false)
    }
  }

  // --- RECUPERAR CONTRASEÑA ---
  const handleRecuperar = async (e) => {
    e.preventDefault()

    const correo = emailRecuperar.trim()
    if (!correo) {
      return toast.current.show({
        severity: 'warn',
        summary: 'Falta el correo',
        detail: 'Escribe el correo con el que te registraste',
      })
    }

    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${window.location.origin}/recuperar`,
    })

    setLoading(false)

    /*
     * Se dice lo mismo haya cuenta o no. Si aquí se distinguiera, esta
     * pantalla se convertiría en una forma de averiguar qué correos
     * están registrados en CarMeet.
     */
    if (error) {
      console.error('Error al pedir la recuperación:', error.message)
    }
    setEnviadoRecuperar(true)
  }

  // --- REGISTRO ---
  const handleRegister = async (e) => {
    e.preventDefault()

    // 🚀 LIMPIEZA: Quitamos espacios accidentales
    const usernameLimpio = regUsername.trim()
    const emailLimpio = regEmail.trim()

    if (regPassword !== regConfirmPassword) {
      return toast.current.show({
        severity: 'warn',
        summary: 'Cuidado',
        detail: 'Las contraseñas no coinciden',
      })
    }
    if (!usernameLimpio) {
      return toast.current.show({
        severity: 'warn',
        summary: 'Faltan datos',
        detail: 'El nombre de usuario es obligatorio',
      })
    }

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: emailLimpio,
      password: regPassword,
      options: { data: { username: usernameLimpio } },
    })

    if (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: error.message,
      })
    } else {
      toast.current.show({
        severity: 'success',
        summary: '¡Cuenta Creada!',
        detail: 'Revisa tu correo para verificar la cuenta.',
      })
      setIsLogin(true)
    }
    setLoading(false)
  }

  return (
    <>
      <SEO
        title={isLogin ? 'Iniciar Sesión' : 'Únete a la Comunidad'}
        description='Crea tu cuenta gratis en CarMeet ESP. Únete a miles de conductores, sube tu proyecto al garaje y encuentra KDDs.'
        noindex
      />
      <PageTransition>
        <Toast ref={toast} />
        <div className={`auth-wrapper ${!isLogin ? 'reverse' : ''}`}>
          <div className='auth-image-side'>
            <img
              src={LOGIN_IMAGE}
              alt='Login Background'
              className='auth-bg-img'
              style={{ opacity: isLogin ? 0.8 : 0 }}
                          loading='lazy'
              decoding='async'
            />
            <img
              src={REGISTER_IMAGE}
              alt='Register Background'
              className='auth-bg-img'
              style={{ opacity: !isLogin ? 0.8 : 0 }}
                          loading='lazy'
              decoding='async'
            />

            <div className='auth-image-overlay'>
              <h2 className='text-5xl font-black m-0 mb-3 text-white line-height-1'>
                {isLogin ? 'Tu Garaje.' : 'La Comunidad.'}
                <br />
                <span className='text-blue-400'>
                  {isLogin ? 'Tus Reglas.' : 'Te Espera.'}
                </span>
              </h2>
              <p className='text-gray-300 text-lg m-0 max-w-20rem'>
                {isLogin
                  ? 'Conéctate para organizar rutas, gestionar tus vehículos y descubrir eventos cerca de ti.'
                  : 'Únete a miles de entusiastas del motor en toda España y lleva tu pasión al siguiente nivel.'}
              </p>
            </div>
          </div>

          <div className='auth-form-side'>
            <div className='auth-form-container'>
              <div className='text-center mb-6'>
                <div className='inline-flex align-items-center justify-content-center w-4rem h-4rem surface-hover text-blue-600 border-circle mb-3'>
                  {isLogin ? <ShieldCheck size={32} /> : <Zap size={32} />}
                </div>
                <h1 className='text-4xl font-black m-0 text-color tracking-tight'>
                  {isLogin ? 'Bienvenido' : 'Crear Cuenta'}
                </h1>
                <p className='text-color-secondary text-lg font-medium mt-2 mb-0'>
                  {isLogin
                    ? 'Introduce tus credenciales para acceder'
                    : 'Regístrate en menos de 1 minuto'}
                </p>
              </div>

              {recuperando ? (
                <div className='flex flex-column gap-4 w-full'>
                  {enviadoRecuperar ? (
                    <div className='auth-aviso'>
                      <i className='pi pi-check-circle' aria-hidden='true'></i>
                      <div>
                        <strong>Revisa tu correo</strong>
                        <p>
                          Si hay una cuenta con esa dirección, te acaba de
                          llegar un enlace para poner una contraseña nueva.
                          Caduca en una hora.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <form
                      onSubmit={handleRecuperar}
                      className='flex flex-column gap-4 w-full'
                    >
                      <p className='auth-explica'>
                        Escribe tu correo y te mandamos un enlace para poner
                        una contraseña nueva.
                      </p>

                      <span className='p-input-icon-left w-full'>
                        <i className='pi pi-envelope' />
                        <InputText
                          value={emailRecuperar}
                          onChange={(e) => setEmailRecuperar(e.target.value)}
                          placeholder='Tu correo electrónico'
                          type='email'
                          autoComplete='email'
                          className='auth-input-modern w-full'
                        />
                      </span>

                      <Button
                        label={loading ? 'Enviando...' : 'Enviar enlace'}
                        className='auth-btn-primary'
                        loading={loading}
                      />
                    </form>
                  )}

                  <button
                    type='button'
                    className='auth-enlace'
                    onClick={() => setRecuperando(false)}
                  >
                    Volver a iniciar sesión
                  </button>
                </div>
              ) : isLogin ? (
                <form
                  onSubmit={handleLogin}
                  className='flex flex-column gap-4 w-full'
                >
                  <span className='p-input-icon-left w-full'>
                    <i className='pi pi-user' />
                    <InputText
                      value={loginInput}
                      onChange={(e) => setLoginInput(e.target.value)}
                      placeholder='Correo o Nombre de Usuario'
                      className='auth-input-modern w-full'
                    />
                  </span>

                  <span className='p-input-icon-left w-full'>
                    <i className='pi pi-lock' />
                    <Password
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder='Contraseña'
                      toggleMask
                      feedback={false}
                      inputClassName='auth-input-modern w-full'
                      className='w-full'
                    />
                  </span>

                  <div className='flex justify-content-end w-full mb-2'>
                    <button
                      type='button'
                      className='auth-enlace'
                      onClick={() => {
                        setEmailRecuperar(
                          loginInput.includes('@') ? loginInput.trim() : '',
                        )
                        setEnviadoRecuperar(false)
                        setRecuperando(true)
                      }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  <Button
                    label={loading ? 'Verificando...' : 'Iniciar Sesión'}
                    className='auth-btn-primary'
                    loading={loading}
                  />
                </form>
              ) : (
                <form
                  onSubmit={handleRegister}
                  className='flex flex-column gap-4 w-full'
                >
                  <span className='p-input-icon-left w-full'>
                    <i className='pi pi-at' />
                    <InputText
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder='Nombre de Usuario (Nickname)'
                      className='auth-input-modern w-full'
                    />
                  </span>

                  <span className='p-input-icon-left w-full'>
                    <i className='pi pi-envelope' />
                    <InputText
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder='Correo Electrónico'
                      type='email'
                      className='auth-input-modern w-full'
                    />
                  </span>

                  <span className='p-input-icon-left w-full'>
                    <i className='pi pi-lock' />
                    <Password
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder='Contraseña'
                      toggleMask
                      promptLabel='Introduce una contraseña segura'
                      weakLabel='Débil'
                      mediumLabel='Media'
                      strongLabel='Fuerte'
                      inputClassName='auth-input-modern w-full'
                      className='w-full'
                    />
                  </span>

                  <span className='p-input-icon-left w-full'>
                    <i className='pi pi-check-circle' />
                    <Password
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder='Confirmar Contraseña'
                      toggleMask
                      feedback={false}
                      inputClassName='auth-input-modern w-full'
                      className='w-full'
                    />
                  </span>

                  <Button
                    label={
                      loading ? 'Creando cuenta...' : 'Unirse a la Comunidad'
                    }
                    className='auth-btn-primary mt-2'
                    loading={loading}
                  />
                </form>
              )}

              <div className='auth-switch-text'>
                {isLogin ? '¿Aún no tienes cuenta?' : '¿Ya eres miembro?'}
                <span
                  className='auth-switch-link'
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin ? 'Regístrate gratis' : 'Inicia Sesión'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </PageTransition>
    </>
  )
}

export default AuthPage
