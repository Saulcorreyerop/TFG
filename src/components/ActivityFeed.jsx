import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { motion } from 'framer-motion'
import { Activity, Car, Calendar } from 'lucide-react'
import { Avatar } from 'primereact/avatar'
import { useNavigate } from 'react-router-dom'

const MotionDiv = motion.div

const ActivityFeed = () => {
  const navigate = useNavigate()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActivities = async () => {
      setLoading(true)
      
      const { data: cars } = await supabase
        .from('vehicles')
        .select('*, profiles(username, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(5)
      
      const { data: events } = await supabase
        .from('events')
        .select('*, profiles(username, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(5)

      let combined = []
      if (cars) {
        combined = [...combined, ...cars.map(c => ({
          id: `car-${c.id}`,
          type: 'vehicle',
          title: `${c.marca} ${c.modelo}`,
          user: c.profiles?.username || 'Usuario',
          avatar: c.profiles?.avatar_url,
          created_at: new Date(c.created_at),
          image: c.image_url,
          userId: c.user_id
        }))]
      }
      if (events) {
        combined = [...combined, ...events.map(e => ({
          id: `ev-${e.id}`,
          type: 'event',
          title: e.titulo,
          user: e.profiles?.username || 'Usuario',
          avatar: e.profiles?.avatar_url,
          created_at: new Date(e.created_at),
          image: e.image_url,
          eventId: e.id
        }))]
      }

      combined.sort((a, b) => b.created_at - a.created_at)
      setActivities(combined.slice(0, 8))
      setLoading(false)
    }

    fetchActivities()
  }, [])

  if (loading || activities.length === 0) return null

  return (
    <section className='py-8 px-4 relative z-10' style={{ backgroundColor: 'var(--surface-ground)' }}>
      <div className='max-w-7xl mx-auto'>
        <div className='flex align-items-center justify-content-between mb-6'>
          <div>
            <h2 className='text-4xl md:text-5xl font-black text-color m-0 tracking-tighter flex align-items-center gap-3'>
              <Activity className="text-blue-600" size={40} /> Muro en Directo
            </h2>
            <p className='text-color-secondary text-lg font-medium mt-2 mb-0'>
              Lo último que está pasando en la comunidad.
            </p>
          </div>
        </div>

        <div className='grid m-0'>
          {activities.map((act, index) => (
            <MotionDiv
              key={act.id}
              className='col-12 md:col-6 lg:col-3 p-2'
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <div 
                className='surface-card hover:shadow-4 transition-all cursor-pointer overflow-hidden h-full flex flex-column'
                style={{ 
                  borderRadius: '24px', 
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.04)' 
                }}
                onClick={() => act.type === 'event' ? navigate(`/evento/${act.eventId}`) : navigate(`/usuario/${act.user}`)}
              >
                <div className='p-3 flex align-items-center gap-3'>
                  <Avatar image={act.avatar} icon={!act.avatar && 'pi pi-user'} shape='circle' />
                  <div>
                    <div className='font-bold text-sm text-color'>{act.user}</div>
                    <div className='text-xs text-color-secondary font-medium'>{act.type === 'vehicle' ? 'ha añadido un coche' : 'ha creado un evento'}</div>
                  </div>
                </div>
                {act.image ? (
                  <div className='w-full relative' style={{ height: '180px' }}>
                    <img src={act.image} alt={act.title} className='w-full h-full' style={{ objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div className='w-full surface-hover flex align-items-center justify-content-center text-blue-300' style={{ height: '180px' }}>
                    {act.type === 'vehicle' ? <Car size={48} /> : <Calendar size={48} />}
                  </div>
                )}
                <div className='p-4 mt-auto surface-card'>
                  <h4 className='m-0 font-black text-lg text-color line-clamp-1'>{act.title}</h4>
                </div>
              </div>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ActivityFeed
