import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { TabView, TabPanel } from 'primereact/tabview'
import { Toast } from 'primereact/toast' // Para mensajes más bonitos
import { useRef } from 'react'

const AuthPage = () => {
  const toast = useRef(null)
  const [loading, setLoading] = useState(false)

  // Estados para Login
  const [loginInput, setLoginInput] = useState('') // Puede ser email o usuario
  const [loginPassword, setLoginPassword] = useState('')

  // Estados para Registro
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

      // 1. Si NO parece un email, asumimos que es un nombre de usuario
      if (!loginInput.includes('@')) {
        // Buscamos el email asociado a este usuario en la tabla 'profiles'
        // NOTA: Debes tener una tabla 'profiles' con columnas 'username' y 'email'
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

      // 2. Iniciamos sesión con el email (sea el escrito o el encontrado)
      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: loginPassword,
      })

      if (error) throw error

      // Si usas react-router, aquí harías navigate('/mapa')
      // window.location.href = '/'
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

    // 1. Validar contraseñas
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

    // 2. Crear usuario en Supabase Auth
    // Guardamos el username en 'options.data' para que vaya a la metadata
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
      // Limpiar formulario
      setRegEmail('')
      setRegPassword('')
      setRegConfirmPassword('')
      setRegUsername('')
    }
    setLoading(false)
  }

  return (
    <div className='flex justify-content-center align-items-center min-h-screen surface-ground p-4'>
      <Toast ref={toast} />
      <Card className='w-full md:w-30rem shadow-4 border-round-xl'>
        <div className='text-center mb-5'>
          <h2 className='text-900 font-bold mb-2'>Bienvenido a CarMeet ESP</h2>
          <p className='text-600'>Tu comunidad de motor te espera</p>
        </div>

        <TabView>
          {/* --- PANEL DE INICIO DE SESIÓN --- */}
          <TabPanel header='Iniciar Sesión'>
            <form onSubmit={handleLogin} className='flex flex-column gap-3'>
              <span className='p-float-label mt-3'>
                <InputText
                  id='login-input'
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  className='w-full'
                />
                <label htmlFor='login-input'>Correo o Nombre de Usuario</label>
              </span>

              <span className='p-float-label'>
                <Password
                  id='login-pass'
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  toggleMask
                  feedback={false}
                  className='w-full'
                  inputClassName='w-full'
                />
                <label htmlFor='login-pass'>Contraseña</label>
              </span>

              <Button
                label={loading ? 'Verificando...' : 'Entrar'}
                icon='pi pi-sign-in'
                className='w-full mt-2'
                loading={loading}
              />
            </form>
          </TabPanel>

          {/* --- PANEL DE REGISTRO --- */}
          <TabPanel header='Registrarse'>
            <form onSubmit={handleRegister} className='flex flex-column gap-3'>
              <span className='p-float-label mt-3'>
                <InputText
                  id='reg-user'
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className='w-full'
                />
                <label htmlFor='reg-user'>Nombre de Usuario</label>
              </span>

              <span className='p-float-label'>
                <InputText
                  id='reg-email'
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className='w-full'
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
                  className='w-full'
                  inputClassName='w-full'
                />
                <label htmlFor='reg-pass'>Contraseña</label>
              </span>

              <span className='p-float-label'>
                <Password
                  id='reg-confirm'
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  toggleMask
                  feedback={false} // No mostramos fortaleza en la confirmación
                  className='w-full'
                  inputClassName='w-full'
                />
                <label htmlFor='reg-confirm'>Confirmar Contraseña</label>
              </span>

              <Button
                label={loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                icon='pi pi-user-plus'
                severity='success'
                className='w-full mt-2'
                loading={loading}
              />
            </form>
          </TabPanel>
        </TabView>
      </Card>
    </div>
  )
}

export default AuthPage
