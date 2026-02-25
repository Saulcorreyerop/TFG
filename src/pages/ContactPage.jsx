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
      <div className='contact-premium-v3'>
        <Toast ref={toast} position='top-center' />

        <div className='backfire-system'>
          {[...Array(20)].map((_, i) => (
            <div key={i} className={`flame-v3 f-${i % 10}`}></div>
          ))}
        </div>

        <div className='v3-container'>
          <div className='v3-header'>
            <div className='flex align-items-center justify-content-center gap-2 mb-1'>
              <Flame className='text-orange-500' size={20} />
              <span className='v3-tag'>Soporte Técnico</span>
            </div>
            <h1 className='v3-aura-title'>¿Pisamos a fondo?</h1>
            <span className='v3-tag'>
              ¿Tienes alguna recomendación, duda o quieres colaborar? No dudes
              en mandar tu mensaje ahora mismo.
            </span>
          </div>

          <div className='v3-card grid grid-nogutter shadow-4'>
            <div className='col-12 lg:col-4 v3-sidebar p-5 flex flex-column justify-content-center'>
              <div className='flex flex-column gap-5'>
                <div className='v3-info-row'>
                  <div className='v3-icon-box'>
                    <Mail size={22} />
                  </div>
                  <div className='flex flex-column'>
                    <label>Escríbenos</label>
                    <span>carmeetespa@gmail.com</span>
                  </div>
                </div>
                <div className='flex gap-4 pt-3 justify-content-center lg:justify-content-start v3-socials'>
                  <div className='v3-info-row'>
                    <div className='flex flex-column'>
                      <label>Redes Sociales</label>
                      <span>Sigueme</span>
                    </div>
                  </div>
                  <Instagram
                    size={24}
                    className='cursor-pointer hover:text-blue-600 transition-colors'
                    onClick={() =>
                      window.open(
                        'https://www.instagram.com/saulcorreyerop/',
                        '_blank',
                      )
                    }
                  />
                  <Twitter
                    size={24}
                    className='cursor-pointer hover:text-blue-400 transition-colors'
                    onClick={() =>
                      window.open(
                        'https://twitter.com/saulcorreyerop8',
                        '_blank',
                      )
                    }
                  />
                  <Globe
                    size={24}
                    className='cursor-pointer hover:text-purple-600 transition-colors'
                    onClick={() =>
                      window.open('https:/extreweb.ct.ws', '_blank')
                    }
                  />
                </div>
              </div>
            </div>

            <div className='col-12 lg:col-8 p-5 md:p-6 bg-white'>
              <form
                ref={form}
                onSubmit={sendEmail}
                className='flex flex-column gap-4'
              >
                <div className='grid m-0'>
                  <div className='col-12 md:col-6 p-0 md:pr-2 field m-0'>
                    <label className='v3-label'>
                      <User size={14} /> Piloto
                    </label>
                    <InputText
                      name='user_name'
                      required
                      className='v3-input'
                      placeholder='Tu nombre'
                    />
                  </div>
                  <div className='col-12 md:col-6 p-0 md:pl-2 field m-0'>
                    <label className='v3-label'>
                      <Mail size={14} /> Correo
                    </label>
                    <InputText
                      name='user_email'
                      type='email'
                      required
                      className='v3-input'
                      placeholder='tu@email.com'
                    />
                  </div>
                </div>

                <div className='field m-0'>
                  <label className='v3-label'>
                    <Tag size={14} /> Asunto
                  </label>
                  <InputText
                    name='subject'
                    required
                    className='v3-input'
                    placeholder='¿Qué necesitas?'
                  />
                </div>

                <div className='field m-0'>
                  <label className='v3-label'>
                    <MessageSquare size={14} /> Detalles técnicos
                  </label>
                  <InputTextarea
                    name='message'
                    required
                    rows={8}
                    className='v3-input'
                    placeholder='Escribe aquí...'
                    style={{ resize: 'none' }}
                  />
                </div>

                <Button
                  type='submit'
                  loading={loading}
                  className='v3-nitro-btn mt-2'
                >
                  <span>INICIAR ENVÍO</span>
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
