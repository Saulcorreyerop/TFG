import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { TabView, TabPanel } from 'primereact/tabview'

const AuthPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) alert(error.message)
    setLoading(false)
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) alert(error.message)
    else alert('¡Registro exitoso! Revisa tu correo para confirmar.')
    setLoading(false)
  }

  return (
    <div className='flex justify-content-center align-items-center min-h-screen surface-ground p-4'>
      <Card className='w-full md:w-30rem shadow-4 border-round-xl'>
        <div className='text-center mb-5'>
          <h2 className='text-900 font-bold mb-2'>Bienvenido a CarMeet ESP</h2>
          <p className='text-600'>Tu comunidad de motor te espera</p>
        </div>

        <TabView>
          <TabPanel header='Iniciar Sesión'>
            <form onSubmit={handleLogin} className='flex flex-column gap-3'>
              <span className='p-float-label mt-3'>
                <InputText
                  id='login-email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className='w-full'
                />
                <label htmlFor='login-email'>Correo Electrónico</label>
              </span>
              <span className='p-float-label'>
                <Password
                  id='login-pass'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  toggleMask
                  feedback={false}
                  className='w-full'
                  inputClassName='w-full'
                />
                <label htmlFor='login-pass'>Contraseña</label>
              </span>
              <Button
                label={loading ? 'Cargando...' : 'Entrar'}
                icon='pi pi-sign-in'
                className='w-full mt-2'
                loading={loading}
              />
            </form>
          </TabPanel>

          <TabPanel header='Registrarse'>
            <form onSubmit={handleRegister} className='flex flex-column gap-3'>
              <span className='p-float-label mt-3'>
                <InputText
                  id='reg-email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className='w-full'
                />
                <label htmlFor='reg-email'>Correo Electrónico</label>
              </span>
              <span className='p-float-label'>
                <Password
                  id='reg-pass'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  toggleMask
                  className='w-full'
                  inputClassName='w-full'
                />
                <label htmlFor='reg-pass'>Contraseña</label>
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
