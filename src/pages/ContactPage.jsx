import React, { useRef, useState } from 'react'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { Button } from 'primereact/button'
import { Toast } from 'primereact/toast'
import emailjs from '@emailjs/browser'
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'
import {
  Mail,
  User,
  MessageSquare,
  Tag,
  MapPin,
  Instagram,
  Twitter,
  Globe,
  Flame,
  Send,
} from 'lucide-react'
import PageTransition from '../components/PageTransition'
import './ContactPage.css'

const ContactPage = () => {
  const isSubmitting = useRef(false)
  const form = useRef()
  const toast = useRef(null)
  const [loading, setLoading] = useState(false)

  const sendEmail = (e) => {
    e.preventDefault()
    if (isSubmitting.current) return
    isSubmitting.current = true
    setLoading(true)

    emailjs
      .sendForm(
        'service_0u7vr1c',
        'template_utn8ayn',
        form.current,
        'RX8fmYTr8Xsvkmn7D',
      )
      .then(() => {
        isSubmitting.current = false
        toast.current.show({
          severity: 'success',
          summary: 'Nitro Activado',
          detail: 'Mensaje en boxes.',
          life: 3000,
        })
        form.current.reset()
        setLoading(false)
      })
      .catch(() => {
        isSubmitting.current = false
        setLoading(false)
      })
  }

  return (
    <PageTransition>
      <div className='contact-fire-container'>
        <Toast ref={toast} position='top-center' />

        {/* FONDO DE PETARDEOS (BACKFIRE) */}
        <div className='exhaust-particles-bg'>
          {[...Array(20)].map((_, i) => (
            <div key={i} className={`fire-flame p-${i % 10}`}></div>
          ))}
        </div>

        {/* MARGEN SUPERIOR REDUCIDO: pt-2 para pegar más al header */}
        <div
          className='max-w-7xl mx-auto px-4 w-full flex flex-column align-items-center justify-content-start pt-2 pb-4'
          style={{ minHeight: '85vh' }}
        >
          <div className='text-center mb-3 mt-2'>
            <div className='flex align-items-center justify-content-center gap-2 mb-1'>
              <Flame className='text-orange-500' size={20} />
              <span className='text-blue-700 font-black uppercase text-xs tracking-tighter'>
                Línea Directa
              </span>
            </div>
            <h1 className='title-aura-electric-v2'>¿Pisamos a fondo?</h1>
            <p className='text-gray-600 mt-2'>
              ¿Tienes alguna duda, sugerencia o quieres colaborar? No dudes en
              dejar tu mensaje.
            </p>
          </div>

          <div className='contact-form-card grid grid-nogutter shadow-4'>
            {/* IZQUIERDA: INFO BOX */}
            <div className='col-12 lg:col-4 racing-sidebar-v2 p-5'>
              <div className='flex flex-column gap-6 h-full justify-content-center'>
                <div className='racing-info-row'>
                  <div className='icon-circle-aura'>
                    <Mail size={20} />
                    <label className='r-label-v2'>Email:</label>
                  </div>
                  <div className='flex flex-column'>
                    <span className='r-value-v2'>carmeetespa@gmail.com</span>
                  </div>
                </div>

                <div className='racing-info-row'>
                  <div className='flex flex-column'>
                    <span className='r-value-v2'>
                      Por y para todos los aficionados y amantes del mundo
                      motor.
                    </span>
                  </div>
                </div>

                <div className='flex gap-4 pt-3 justify-content-center lg:justify-content-start'>
                  <Instagram
                    className='social-racing-btn'
                    size={24}
                    onClick={() =>
                      window.open(
                        'https://www.instagram.com/saulcorreyerop/',
                        '_blank',
                      )
                    }
                  />
                  <Twitter
                    className='social-racing-btn'
                    size={24}
                    onClick={() =>
                      window.open(
                        'https://twitter.com/saulcorreyerop',
                        '_blank',
                      )
                    }
                  />
                  <Globe
                    className='social-racing-btn'
                    size={24}
                    onClick={() =>
                      window.open('https://extreweb.ct.ws', '_blank')
                    }
                  />
                </div>
              </div>
            </div>

            {/* DERECHA: FORMULARIO TODO AL 100% DE ANCHO */}
            <div className='col-12 lg:col-8 p-5 md:p-6 bg-white'>
              <form
                ref={form}
                onSubmit={sendEmail}
                className='flex flex-column gap-4'
              >
                {/* PILOTO Y CORREO AHORA VAN POR SEPARADO (100% ANCHO) */}
                <div className='field m-0'>
                  <label className='form-label-v2'>
                    <User size={14} /> Piloto
                  </label>
                  <InputText
                    name='user_name'
                    required
                    className='input-racing-v2'
                    placeholder='Tu nombre'
                  />
                </div>

                <div className='field m-0'>
                  <label className='form-label-v2'>
                    <Mail size={14} /> Correo
                  </label>
                  <InputText
                    name='user_email'
                    type='email'
                    required
                    className='input-racing-v2'
                    placeholder='tu@email.com'
                  />
                </div>

                <div className='field m-0'>
                  <label className='form-label-v2'>
                    <Tag size={14} /> Asunto de la transmisión
                  </label>
                  <InputText
                    name='subject'
                    required
                    className='input-racing-v2'
                    placeholder='¿Qué necesitas?'
                  />
                </div>

                <div className='field m-0'>
                  <label className='form-label-v2'>
                    <MessageSquare size={14} /> Detalles técnicos
                  </label>
                  <InputTextarea
                    name='message'
                    required
                    rows={8}
                    className='input-racing-v2'
                    placeholder='Escribe aquí...'
                    style={{ resize: 'none' }}
                  />
                </div>

                <Button
                  type='submit'
                  loading={loading}
                  className='btn-nitro-v2 mt-2'
                >
                  <span>Enviar mensaje</span>
                  <Send size={20} className='ml-3' />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}

export default ContactPage
