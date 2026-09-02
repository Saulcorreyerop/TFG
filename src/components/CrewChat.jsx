import React from 'react'
import CanalChat from './CanalChat'

/*
 * Chat de una crew. Es el mismo registro de canal que el chat global,
 * apuntando a crew_messages y filtrado por crew.
 *
 * Quién puede verlo lo decide CrewDetailPage (solo miembros aprobados) y,
 * por debajo, las políticas RLS de crew_messages: aunque alguien llegue
 * aquí sin ser miembro, la base de datos no le devuelve ni le acepta
 * nada.
 */

const CrewChat = ({ crewId, crewName, session }) => (
  <CanalChat
    session={session}
    tabla='crew_messages'
    crewId={crewId}
    tipoDenuncia='mensaje_crew'
    titulo={crewName ? `Canal de ${crewName}` : 'Canal de la crew'}
    estado='Solo miembros'
  />
)

export default CrewChat
