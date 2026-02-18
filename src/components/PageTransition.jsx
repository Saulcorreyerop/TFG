import React from 'react'
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'

const PageTransition = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} // Empieza invisible y un poco abajo
      animate={{ opacity: 1, y: 0 }} // Se vuelve visible y sube a su sitio
      exit={{ opacity: 0, y: -20 }} // Al salir, se desvanece hacia arriba
      transition={{ duration: 0.3, ease: 'easeOut' }} // Dura 0.3 segundos
      className='w-full h-full'
    >
      {children}
    </motion.div>
  )
}

export default PageTransition
