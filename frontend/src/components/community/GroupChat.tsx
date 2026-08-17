'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Send, Pin, Book } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmojiPicker } from './EmojiPicker';
import { AttachmentPicker } from './AttachmentPicker';

/** Escape HTML entities to prevent XSS when rendering user content */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Render message text with safe @mention highlighting (no dangerouslySetInnerHTML) */
function renderMessageContent(content: string): ReactNode {
  const parts: ReactNode[] = [];
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Push text before the mention (escaped)
    if (match.index > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{content.slice(lastIndex, match.index)}</span>);
    }
    // Push the mention as a styled React element
    parts.push(
      <span key={`m-${match.index}`} className="text-plum-400 font-bold">
        @{match[1]}
      </span>
    );
    lastIndex = mentionRegex.lastIndex;
  }

  // Push remaining text (escaped)
  if (lastIndex < content.length) {
    parts.push(<span key={`t-${lastIndex}`}>{content.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : content;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  content_type?: string;
  material_id?: string;
  is_pinned?: boolean;
  sent_at: string;
  profiles: {
    full_name: string;
    avatar_url: string;
  };
  reactions?: { emoji: string, user_id: string }[];
}

export function GroupChat({ groupId, userRole }: { groupId: string, userRole?: string | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const supabase = createClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: any) => {
      if (data?.session?.user) {
        setCurrentUser(data.session.user);
      }
    });
  }, []);

  useEffect(() => {
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`group_messages:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${groupId}`
      }, (payload: any) => {
        // Fetch the sender's profile for the new message
        fetchNewMessageWithProfile(payload.new.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // Fetch members for @mentions
    supabase.from('study_group_members')
      .select('profiles(id, full_name, username)')
      .eq('group_id', groupId)
      .then(({ data }) => {
        if (data) setGroupMembers(data.map((d: any) => d.profiles));
      });
  }, [groupId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('group_messages')
      .select('*, profiles(full_name, avatar_url), reactions:message_reactions(emoji, user_id)')
      .eq('group_id', groupId)
      .order('sent_at', { ascending: true });

    if (!error && data) {
      setMessages(data as any[]);
    }
  };

  const fetchNewMessageWithProfile = async (messageId: string) => {
    const { data, error } = await supabase
      .from('group_messages')
      .select('*, profiles(full_name, avatar_url), reactions:message_reactions(emoji, user_id)')
      .eq('id', messageId)
      .single();

    if (!error && data) {
      setMessages(prev => [...prev, data as any]);
    }
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    // Optimistic
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        const reactions = m.reactions || [];
        const existing = reactions.find(r => r.emoji === emoji && r.user_id === currentUser.id);
        if (existing) {
          return { ...m, reactions: reactions.filter(r => r !== existing) };
        } else {
          return { ...m, reactions: [...reactions, { emoji, user_id: currentUser.id }] };
        }
      }
      return m;
    }));

    const { data } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', currentUser.id)
      .eq('emoji', emoji)
      .single();

    if (data) {
      await supabase.from('message_reactions').delete().eq('id', data.id);
    } else {
      await supabase.from('message_reactions').insert({
        message_type: 'group',
        message_id: messageId,
        user_id: currentUser.id,
        emoji
      });
    }
  };

  const handlePinToggle = async (messageId: string, currentPinStatus: boolean) => {
    await supabase.from('group_messages').update({ is_pinned: !currentPinStatus }).eq('id', messageId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_pinned: !currentPinStatus } : m));
  };

  const sendMessage = async (e?: React.FormEvent, type: string = 'text', payload: string = '') => {
    if (e) e.preventDefault();
    const contentToSend = type === 'text' ? newMessage : payload;
    if (!contentToSend.trim()) return;

    if (type === 'text') setNewMessage('');

    await supabase
      .from('group_messages')
      .insert({
        group_id: groupId,
        sender_id: currentUser.id,
        content: contentToSend,
        content_type: type
      });
  };

  const pinnedMessages = messages.filter(m => m.is_pinned);

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/30">
        <h3 className="font-semibold">Group Chat</h3>
        {pinnedMessages.length > 0 && (
          <div className="mt-2 bg-background border rounded-md p-2 flex flex-col gap-2">
            <span className="text-xs font-bold text-plum-500 uppercase tracking-wider flex items-center gap-1">
              <Pin className="w-3 h-3" /> Pinned Messages
            </span>
            {pinnedMessages.map(pm => (
              <div key={pm.id} className="text-sm truncate pl-2 border-l-2 border-plum-500 cursor-pointer" onClick={() => document.getElementById(`msg-${pm.id}`)?.scrollIntoView({ behavior: 'smooth' })}>
                <span className="font-semibold text-xs">{pm.profiles?.full_name}:</span> {pm.content}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.sender_id === currentUser?.id;
            const showAvatar = index === 0 || messages[index - 1].sender_id !== msg.sender_id;

            return (
              <div key={msg.id} id={`msg-${msg.id}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-4 group`}>
                {!isMe && showAvatar && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center font-bold text-primary mr-2 mt-1 shrink-0">
                    {msg.profiles?.avatar_url ? (
                      <img src={msg.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      msg.profiles?.full_name?.charAt(0) || '?'
                    )}
                  </div>
                )}
                {!isMe && !showAvatar && <div className="w-8 mr-2 shrink-0" />}

                <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col relative`}>
                  {!isMe && showAvatar && (
                    <span className="text-xs text-muted-foreground ml-1 mb-1">{msg.profiles?.full_name}</span>
                  )}
                  <div className={`px-4 py-2 rounded-2xl ${isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'} relative`}>
                    {msg.content_type === 'image' ? (
                      <img src={msg.content} alt="Attachment" className="max-w-full rounded-md object-contain max-h-64" />
                    ) : msg.content_type === 'youtube' ? (
                      <div className="flex flex-col gap-2">
                        <iframe 
                          className="w-full max-w-sm aspect-video rounded-md"
                          src={`https://www.youtube.com/embed/${msg.content}`}
                          allowFullScreen
                        />
                      </div>
                    ) : msg.content_type === 'material' ? (
                      <div className="flex items-center gap-2 p-2 bg-background/20 rounded-md border border-white/20">
                        <Book className="w-5 h-5" />
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">Shared Material</span>
                          <span className="text-xs opacity-80">Click to open</span>
                        </div>
                      </div>
                    ) : (
                      <span>{renderMessageContent(msg.content)}</span>
                    )}

                    {/* Reactions Display */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className={`absolute -bottom-3 ${isMe ? 'right-2' : 'left-2'} flex gap-1 bg-background border shadow-sm rounded-full px-1.5 py-0.5 text-xs z-10`}>
                        {Array.from(new Set(msg.reactions.map(r => r.emoji))).map(emoji => (
                          <span key={emoji} className="flex items-center gap-0.5">
                            {emoji} <span className="text-[10px] text-muted-foreground">{msg.reactions!.filter(r => r.emoji === emoji).length}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={`text-[10px] text-muted-foreground mt-1 opacity-60 ${msg.reactions?.length ? 'pt-2' : ''}`}>
                    {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  {/* Actions (Hover) */}
                  <div className={`opacity-0 group-hover:opacity-100 transition-opacity absolute top-1/2 -translate-y-1/2 flex items-center gap-1 ${isMe ? '-left-16' : '-right-16'}`}>
                    {userRole === 'admin' && (
                      <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => handlePinToggle(msg.id, !!msg.is_pinned)}>
                        <Pin className="w-3 h-3" />
                      </Button>
                    )}
                    <EmojiPicker onSelect={(emoji) => handleAddReaction(msg.id, emoji)} />
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-border bg-background relative">
        {showMentions && (
          <div className="absolute bottom-full left-0 w-64 bg-card border rounded-md shadow-lg mb-2 overflow-hidden z-20">
            {groupMembers.map(member => (
              <button
                key={member.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                onClick={() => {
                  const words = newMessage.split(' ');
                  words[words.length - 1] = `@${member.username || member.full_name.replace(/\s+/g, '')} `;
                  setNewMessage(words.join(' '));
                  setShowMentions(false);
                }}
              >
                {member.full_name} <span className="text-muted-foreground">@{member.username}</span>
              </button>
            ))}
          </div>
        )}
        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <AttachmentPicker onAttach={(type, payload) => sendMessage(undefined, type, payload)} />
          <Input 
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              const lastWord = e.target.value.split(' ').pop();
              setShowMentions(lastWord?.startsWith('@') || false);
            }}
            placeholder="Message the group..."
            className="flex-1 bg-muted/50 border-none focus-visible:ring-1"
          />
          <EmojiPicker onSelect={(emoji) => setNewMessage(prev => prev + emoji)} />
          <Button type="submit" size="icon" disabled={!newMessage.trim()} className="shrink-0 rounded-full w-10 h-10">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
