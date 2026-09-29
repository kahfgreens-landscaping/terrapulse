// src/app/messages/MessagesPage.tsx
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection, addDoc, serverTimestamp, orderBy, query,
  where, getDocs, limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { useSearchParams } from 'react-router-dom';
import { Send, Paperclip, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { formatRelative, getInitials, cn } from '@/lib/utils';
import type { Message, Project } from '@/types';
import { where as firestoreWhere, orderBy as firestoreOrderBy } from 'firebase/firestore';

export function MessagesPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const initialProject = params.get('project');

  const { data: projects } = useCollection<Project>(
    'projects',
    ...(user?.role === 'client'
      ? [firestoreWhere('clientId', '==', user?.uid ?? '')]
      : [])
  );

  const [selectedProject, setSelectedProject] = useState<string>(initialProject ?? '');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, loading } = useCollection<Message>(
    selectedProject ? `projects/${selectedProject}/messages` : '',
    firestoreOrderBy('createdAt', 'asc')
  );

  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0].id);
    }
  }, [projects, selectedProject]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim() || !selectedProject || !user) return;
    setSending(true);
    const payload = {
      senderId: user.uid,
      senderName: user.name,
      senderAvatar: user.avatar ?? null,
      text: text.trim(),
      readBy: [user.uid],
      createdAt: serverTimestamp(),
    };
    try {
      await addDoc(collection(db, `projects/${selectedProject}/messages`), payload);
      setText('');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const activeProject = projects.find((p) => p.id === selectedProject);

  return (
    <div className="page-container h-[calc(100vh-64px)] flex gap-6 pb-0">
      {/* Project list sidebar */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-2">
        <h2 className="text-lg font-semibold mb-2">Project Chats</h2>
        <div className="space-y-1 overflow-y-auto">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p.id)}
              className={cn(
                'w-full text-left px-3 py-3 rounded-xl transition-all flex items-center gap-3',
                selectedProject === p.id
                  ? 'bg-primary-600 text-white'
                  : 'hover:bg-muted text-foreground'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold',
                selectedProject === p.id ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-600'
              )}>
                {p.title.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className={cn('text-xs truncate', selectedProject === p.id ? 'text-white/70' : 'text-muted-foreground')}>
                  {p.status}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col overflow-hidden mb-6">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          {activeProject ? (
            <>
              <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center text-primary-600 font-bold">
                {activeProject.title.charAt(0)}
              </div>
              <div>
                <h3 className="font-semibold">{activeProject.title}</h3>
                <p className="text-xs text-muted-foreground">Team chat</p>
              </div>
            </>
          ) : (
            <h3 className="font-semibold text-muted-foreground">Select a project</h3>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!selectedProject && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
              <p>Select a project to start chatting</p>
            </div>
          )}

          {loading && selectedProject && (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`flex gap-3 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
                  <div className="skeleton w-8 h-8 rounded-full flex-shrink-0" />
                  <div className={`skeleton h-12 rounded-2xl ${i % 2 === 0 ? 'w-64' : 'w-48'}`} />
                </div>
              ))}
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isMe = msg.senderId === user?.uid;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn('flex items-end gap-2.5', isMe ? 'flex-row-reverse' : '')}
                >
                  {!isMe && (
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={msg.senderAvatar} />
                      <AvatarFallback className="text-xs">{getInitials(msg.senderName)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className={cn('max-w-xs lg:max-w-md', isMe ? 'items-end' : 'items-start', 'flex flex-col gap-1')}>
                    {!isMe && (
                      <span className="text-xs text-muted-foreground px-1">{msg.senderName}</span>
                    )}
                    <div
                      className={cn(
                        'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                        isMe
                          ? 'bg-primary-600 text-white rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm'
                      )}
                    >
                      {msg.text}
                    </div>
                    <span className="text-xs text-muted-foreground px-1">
                      {msg.createdAt ? formatRelative(
                        typeof msg.createdAt === 'string'
                          ? msg.createdAt
                          : (msg.createdAt as any).toDate?.().toISOString() ?? ''
                      ) : ''}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {selectedProject && (
          <div className="px-4 py-4 border-t border-border flex gap-3 items-end">
            <Button variant="ghost" size="icon" className="flex-shrink-0">
              <Paperclip className="w-4 h-4" />
            </Button>
            <Input
              placeholder="Type a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button size="icon" onClick={sendMessage} disabled={sending || !text.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
