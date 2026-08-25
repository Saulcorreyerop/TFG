import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';

const CrewChat = ({ crewId, session }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef(null);

  const myUsername = session?.user?.user_metadata?.username;

  useEffect(() => {
    if (!crewId || !session) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('crew_messages')
        .select('*, profiles(username, avatar_url)') 
        .eq('crew_id', crewId)
        .order('created_at', { ascending: true });
      
      if (!error && data) {
        setMessages(data);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat_crew_${crewId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'crew_messages' },
        async (payload) => {
          if (payload.new.crew_id.toString() !== crewId.toString()) return;
          if (payload.new.user_id === session.user.id) return;

          const { data: profileData } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', payload.new.user_id)
            .single();
            
          const completeMessage = {
             ...payload.new,
             profiles: profileData || { username: 'Piloto' }
          };

          setMessages((prev) => {
            if (prev.some(m => m.id === completeMessage.id)) return prev;
            return [...prev, completeMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [crewId, session]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const msgToSend = newMessage;
    setNewMessage(''); 

    const optimisticMessage = {
      id: Date.now(), 
      crew_id: crewId,
      user_id: session.user.id,
      mensaje: msgToSend,
      created_at: new Date().toISOString(),
      profiles: {
        username: myUsername || 'Tú',
        avatar_url: session.user.user_metadata?.avatar_url || null
      }
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    const { data: insertedMsg, error } = await supabase.from('crew_messages').insert({
      crew_id: crewId,
      user_id: session.user.id,
      mensaje: msgToSend,
    }).select().single();

    if (error) {
      console.error(error);
    } else {
      setMessages(prev => prev.map(m => m.id === optimisticMessage.id ? { ...m, id: insertedMsg.id } : m));
    }
  };

  return (
    <div className="flex flex-column h-full w-full surface-card relative overflow-hidden" style={{ borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
      
      {/* HEADER DEL CHAT */}
      <div className="p-3 surface-card border-bottom-1 surface-border flex align-items-center gap-3 shadow-1 z-1 relative">
        <div className="w-2rem h-2rem surface-hover border-circle flex align-items-center justify-content-center">
          <i className="pi pi-comments text-blue-500 text-lg"></i>
        </div>
        <span className="font-black text-color text-lg">Sala Privada</span>
      </div>

      {/* ZONA DE LECTURA */}
      <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto" style={{ backgroundColor: 'var(--surface-ground)', backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 0)', backgroundSize: '20px 20px' }}>
        {messages.length === 0 ? (
          <div className="h-full flex flex-column align-items-center justify-content-center text-color-secondary">
            <i className="pi pi-inbox text-4xl mb-3 text-300"></i>
            <p className="font-medium">Aún no hay mensajes. ¡Arranca el motor!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.user_id === session?.user?.id || (msg.profiles?.username && msg.profiles?.username === myUsername);
            
            return (
              <div key={msg.id || idx} className={`mb-3 flex ${isMe ? 'justify-content-end' : 'justify-content-start'}`}>
                <div className={`flex flex-column ${isMe ? 'align-items-end' : 'align-items-start'} max-w-20rem md:max-w-30rem`}>
                  
                  {!isMe && (
                    <span className="text-xs text-color-secondary font-bold mb-1 ml-1">
                      {msg.profiles?.username || 'Piloto'}
                    </span>
                  )}

                  <div className="flex align-items-end gap-2">
                    {!isMe && (
                      <Avatar image={msg.profiles?.avatar_url} icon={!msg.profiles?.avatar_url && 'pi pi-user'} shape="circle" size="normal" className="shadow-1 flex-shrink-0" />
                    )}
                    
                    <div 
                      className={`p-3 shadow-1 ${isMe ? 'text-white' : 'surface-card text-color border-1 surface-border'}`}
                      style={{ 
                        background: isMe ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : '#ffffff',
                        borderBottomLeftRadius: '1.25rem',
                        borderBottomRightRadius: '1.25rem',
                        borderTopRightRadius: isMe ? '4px' : '1.25rem', 
                        borderTopLeftRadius: !isMe ? '4px' : '1.25rem',
                        fontSize: '0.95rem',
                        lineHeight: '1.4'
                      }}
                    >
                      {msg.mensaje}
                      <div className={`text-right mt-1 ${isMe ? 'text-blue-200' : 'text-400'}`} style={{ fontSize: '0.65rem' }}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ZONA DE ESCRITURA */}
      <form onSubmit={handleSendMessage} className="p-3 surface-card border-top-1 surface-border flex gap-2 align-items-center shadow-1 z-1 relative">
        <InputText
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-1 surface-ground border-none px-4 py-3 text-color font-medium"
          style={{ borderRadius: '24px' }}
        />
        <Button 
          type="submit" 
          icon="pi pi-send" 
          className="shadow-2 border-none" 
          style={{ borderRadius: '50%', width: '3rem', height: '3rem', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
          disabled={!newMessage.trim()} 
          aria-label="Enviar"
        />
      </form>
    </div>
  );
};

export default CrewChat;