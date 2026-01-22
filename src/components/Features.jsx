import React from 'react'
import { Card } from 'primereact/card'

const Features = () => {
  const featuresData = [
    {
      title: 'Radar de KDDs',
      icon: 'pi pi-compass',
      color: '#ef4444',
      desc: 'Geolocalización en tiempo real. Filtra por tipo: Stance, JDM, Off-road, Clásicos.',
    },
    {
      title: 'Garaje Virtual',
      icon: 'pi pi-car',
      color: '#3b82f6',
      desc: 'Sube tu proyecto. Detalla modificaciones (Mods), potencia y añade una galería de fotos.',
    },
    {
      title: 'Alertas',
      icon: 'pi pi-bell',
      color: '#eab308',
      desc: 'No te pierdas nada. Sincronización automática con Google Calendar y avisos push.',
    },
  ]

  return (
    <section id='features' className='py-8 px-4 surface-section'>
      <div className='text-center mb-6'>
        <h3 className='text-4xl font-bold text-white mb-2'>Funcionalidades</h3>
        <p className='text-gray-400 text-lg'>
          Todo lo que necesitas para tu vida sobre ruedas
        </p>
      </div>

      <div className='grid'>
        {featuresData.map((item, index) => (
          <div key={index} className='col-12 md:col-4 p-3'>
            <Card
              className='h-full surface-card shadow-4 border-round-xl'
              style={{ background: 'var(--bg-card)' }}
            >
              <div className='text-center'>
                <i
                  className={`${item.icon} text-5xl mb-3`}
                  style={{ color: item.color }}
                ></i>
                <h4 className='text-xl font-bold mb-3 text-white'>
                  {item.title}
                </h4>
                <p className='text-gray-400 line-height-3 m-0'>{item.desc}</p>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </section>
  )
}

export default Features
