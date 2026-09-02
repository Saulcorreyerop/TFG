import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Password } from 'primereact/password'
import { Button } from 'primereact/button'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import { supabase } from '../supabaseClient'
import PageTransition from '../components/PageTransition'
import SEO from '../components/SEO'
import './AuthPage.css'

/*
 * Destino del enlace de recuperación que llega por correo.
 *
 * Supabase manda al usuario aquí con un token en el fragmento de la URL.
 * El cliente lo detecta solo y abre una sesión temporal, avisando con el
 * evento PASSWORD_RECOVERY. A partir de ahí updateUser ya puede cambiar
 * la contraseña.
 *
 * Se escucha el evento en lugar de leer el hash a mano porque el cliente
 * puede haber procesado el token antes de que este componente monte; por
 * eso además se comprueba si ya hay sesión.
 */

const MINIMO = 8

const RecoverPage = () => {
  const navigate = useNavigate()

  const [estado, setEstado] = useState('comprobando') // comprobando | listo | invalido | hecho
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let activo = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (evento) => {
        if (!activo) return
        if (evento === 'PASSWORD_RECOVERY' || evento === 'SIGNED_IN') {
          setEstado('listo')
        }
      },
    )

    // Puede que el token ya se hubiera canjeado antes de montar
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!activo) return
      setEstado((previo) =>
        previo === 'comprobando' ? (session ? 'listo' : 'invalido') : previo,
      )
    })

    return () => {
      activo = false
      subscription.unsubscribe()
    }
  }, [])

  const guardar = async (e) => {
    e.preventDefault()
    setError(null)

    if (password.length < MINIMO) {
      return setError(`La contraseña debe tener al menos ${MINIMO} caracteres.`)
    }
    if (password !== confirmar) {
      return setError('Las dos contraseñas no coinciden.')
    }

    setGuardando(true)
    const { error: fallo } = await supabase.auth.updateUser({ password })
    setGuardando(false)

    if (fallo) {
      setError(
        fallo.message === 'New password should be different from the old password.'
          ? 'La contraseña nueva tiene que ser distinta de la anterior.'
          : 'No se ha podido cambiar la contraseña. Prueba a pedir un enlace nuevo.',
      )
      return
    }

    setEstado('hecho')
    setTimeout(() => navigate('/', { replace: true }), 2200)
  }

  return (
    <>
      <SEO
        title='Recuperar contraseña'
        description='Pon una contraseña nueva en tu cuenta de CarMeet.'
        url={window.location.href}
      />
      <PageTransition>
        <div className='recuperar-pagina'>
          <div className='recuperar-caja'>
            {estado === 'comprobando' && (
              <p className='auth-explica'>Comprobando el enlace…</p>
            )}

            {estado === 'invalido' && (
              <>
                <div className='recuperar-icono aviso'>
                  <AlertTriangle size={28} />
                </div>
                <h1 className='recuperar-titulo'>Enlace no válido</h1>
                <p className='auth-explica'>
                  El enlace ha caducado o ya se ha usado. Los enlaces de
                  recuperación duran una hora y solo sirven una vez.
                </p>
                <Button
                  label='Pedir uno nuevo'
                  className='auth-btn-primary'
                  onClick={() => navigate('/login')}
                />
              </>
            )}

            {estado === 'hecho' && (
              <>
                <div className='recuperar-icono bien'>
                  <ShieldCheck size={28} />
                </div>
                <h1 className='recuperar-titulo'>Contraseña cambiada</h1>
                <p className='auth-explica'>
                  Ya puedes usarla. Te llevamos al inicio…
                </p>
              </>
            )}

            {estado === 'listo' && (
              <>
                <div className='recuperar-icono'>
                  <ShieldCheck size={28} />
                </div>
                <h1 className='recuperar-titulo'>Nueva contraseña</h1>
                <p className='auth-explica'>
                  Elige una contraseña de al menos {MINIMO} caracteres.
                </p>

                <form onSubmit={guardar} className='flex flex-column gap-4 w-full'>
                  <span className='p-input-icon-left w-full'>
                    <i className='pi pi-lock' />
                    <Password
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder='Contraseña nueva'
                      toggleMask
                      promptLabel='Escribe una contraseña'
                      weakLabel='Débil'
                      mediumLabel='Aceptable'
                      strongLabel='Fuerte'
                      inputClassName='auth-input-modern w-full'
                      className='w-full'
                      autoComplete='new-password'
                    />
                  </span>

                  <span className='p-input-icon-left w-full'>
                    <i className='pi pi-lock' />
                    <Password
                      value={confirmar}
                      onChange={(e) => setConfirmar(e.target.value)}
                      placeholder='Repite la contraseña'
                      toggleMask
                      feedback={false}
                      inputClassName='auth-input-modern w-full'
                      className='w-full'
                      autoComplete='new-password'
                    />
                  </span>

                  {error && (
                    <div className='auth-error' role='alert'>
                      {error}
                    </div>
                  )}

                  <Button
                    label={guardando ? 'Guardando…' : 'Guardar contraseña'}
                    className='auth-btn-primary'
                    loading={guardando}
                  />
                </form>
              </>
            )}
          </div>
        </div>
      </PageTransition>
    </>
  )
}

export default RecoverPage
