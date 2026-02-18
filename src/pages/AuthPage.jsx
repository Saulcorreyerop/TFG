import React, { useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { TabView, TabPanel } from 'primereact/tabview'
import { Toast } from 'primereact/toast'
import PageTransition from '../components/PageTransition'

const AuthPage = () => {
  const toast = useRef(null)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  // Estados Login
  const [loginInput, setLoginInput] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Estados Registro
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')

  // --- LÓGICA DE LOGIN ---
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      let emailToUse = loginInput.trim()

      if (!loginInput.includes('@')) {
        const { data, error } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', loginInput)
          .single()

        if (error || !data) {
          throw new Error('Usuario no encontrado. Intenta con tu correo.')
        }
        emailToUse = data.email
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: loginPassword,
      })

      if (error) throw error
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  // --- LÓGICA DE REGISTRO ---
  const handleRegister = async (e) => {
    e.preventDefault()

    if (regPassword !== regConfirmPassword) {
      toast.current.show({
        severity: 'warn',
        summary: 'Cuidado',
        detail: 'Las contraseñas no coinciden',
      })
      return
    }

    if (!regUsername) {
      toast.current.show({
        severity: 'warn',
        summary: 'Falta datos',
        detail: 'El nombre de usuario es obligatorio',
      })
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: {
        data: {
          username: regUsername,
        },
      },
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
        summary: 'Éxito',
        detail: 'Registro exitoso! Revisa tu correo.',
      })
      setRegEmail('')
      setRegPassword('')
      setRegConfirmPassword('')
      setRegUsername('')
    }
    setLoading(false)
  }

  return (
    <PageTransition>
      <div className='flex justify-content-center align-items-center min-h-screen surface-ground p-4'>
        <Toast ref={toast} />
        <Card className='w-full md:w-30rem shadow-4 border-round-xl'>
          <div className='text-center mb-5'>
            <h2 className='text-900 font-bold mb-2'>
              Bienvenido a CarMeet ESP
            </h2>
            <p className='text-600'>Tu comunidad de motor te espera</p>
          </div>

          <TabView
            activeIndex={activeIndex}
            onTabChange={(e) => setActiveIndex(e.index)}
          >
            {/* --- PANEL DE INICIO DE SESIÓN --- */}
            <TabPanel header='Iniciar Sesión'>
              {/* AÑADIDO: p-fluid en el form para forzar ancho completo */}
              <form
                onSubmit={handleLogin}
                className='flex flex-column gap-4 pt-2 p-fluid'
              >
                <span className='p-float-label'>
                  <InputText
                    id='login-input'
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                  />
                  <label htmlFor='login-input'>
                    Correo o Nombre de Usuario
                  </label>
                </span>

                <span className='p-float-label'>
                  <Password
                    id='login-pass'
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    toggleMask
                    feedback={false}
                  />
                  <label htmlFor='login-pass'>Contraseña</label>
                </span>

                <Button
                  label={loading ? 'Verificando...' : 'Entrar'}
                  icon='pi pi-sign-in'
                  loading={loading}
                />

                <div className='text-center text-600 mt-2'>
                  ¿No tienes cuenta aún?{' '}
                  <span
                    className='font-bold text-primary cursor-pointer hover:underline'
                    onClick={() => setActiveIndex(1)}
                  >
                    Regístrate aquí
                  </span>
                </div>
              </form>
            </TabPanel>

            {/* --- PANEL DE REGISTRO --- */}
            <TabPanel header='Registrarse'>
              {/* AÑADIDO: p-fluid en el form para forzar ancho completo */}
              <form
                onSubmit={handleRegister}
                className='flex flex-column gap-4 pt-2 p-fluid'
              >
                <span className='p-float-label'>
                  <InputText
                    id='reg-user'
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                  />
                  <label htmlFor='reg-user'>Nombre de Usuario</label>
                </span>

                <span className='p-float-label'>
                  <InputText
                    id='reg-email'
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                  />
                  <label htmlFor='reg-email'>Correo Electrónico</label>
                </span>

                <span className='p-float-label'>
                  <Password
                    id='reg-pass'
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    toggleMask
                    promptLabel='Introduce una contraseña'
                    weakLabel='Débil'
                    mediumLabel='Media'
                    strongLabel='Fuerte'
                  />
                  <label htmlFor='reg-pass'>Contraseña</label>
                </span>

                <span className='p-float-label'>
                  <Password
                    id='reg-confirm'
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    toggleMask
                    feedback={false}
                  />
                  <label htmlFor='reg-confirm'>Confirmar Contraseña</label>
                </span>

                <Button
                  label={loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                  icon='pi pi-user-plus'
                  severity='success'
                  loading={loading}
                />

                <div className='text-center text-600 mt-2'>
                  ¿Ya tienes cuenta?{' '}
                  <span
                    className='font-bold text-primary cursor-pointer hover:underline'
                    onClick={() => setActiveIndex(0)}
                  >
                    Inicia sesión
                  </span>
                </div>
              </form>
            </TabPanel>
          </TabView>
        </Card>
      </div>
    </PageTransition>
  )
}

export default AuthPage
