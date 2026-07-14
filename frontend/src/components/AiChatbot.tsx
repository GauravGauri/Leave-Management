'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, Calendar, HelpCircle, User } from 'lucide-react';
import { useUIStore } from '@/store';
import api from '@/lib/axios';

export default function AiChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { chatMessages, addChatMessage } = useUIStore();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isOpen]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    // Add user message to store
    addChatMessage({
      sender: 'user',
      text: textToSend
    });
    
    setInputValue('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chatbot', { message: textToSend });
      addChatMessage({
        sender: 'bot',
        text: res.data.reply
      });
    } catch (err: any) {
      addChatMessage({
        sender: 'bot',
        text: "I'm having trouble connecting to the HR systems right now. Please try again in a moment."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (msg: string) => {
    handleSendMessage(msg);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-primary to-indigo-600 text-white shadow-xl hover:scale-105 hover:from-primary/95 hover:to-indigo-500/95 transition duration-300 animate-bounce"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}

      {/* Sliding Chat Drawer */}
      {isOpen && (
        <div className="flex h-[500px] w-[380px] flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden glass">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-primary to-indigo-600 px-4 py-3 text-white">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 animate-pulse text-teal-300" />
              <div>
                <h3 className="font-semibold text-sm">HR AI Assistant</h3>
                <span className="text-[10px] text-slate-200">Online & Ready to Help</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-slate-200 hover:bg-white/10 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Chat Bubble Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start space-x-2 ${
                  msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                    msg.sender === 'user' ? 'bg-primary text-white' : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {msg.sender === 'user' ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4 text-primary" />}
                </div>

                {/* Message Content */}
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-primary text-white rounded-tr-none'
                      : 'bg-secondary text-secondary-foreground rounded-tl-none whitespace-pre-line'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex items-start space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-primary">
                  <Sparkles className="h-4 w-4 animate-spin" />
                </div>
                <div className="max-w-[75%] rounded-2xl bg-secondary text-muted-foreground px-3.5 py-2.5 text-xs rounded-tl-none">
                  Consulting database policies...
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Suggested Prompts Grid */}
          {chatMessages.length === 1 && (
            <div className="px-4 py-2 bg-slate-500/5 border-t border-border/40 grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                onClick={() => handleSuggestionClick('Check my balance')}
                className="flex items-center p-1.5 rounded bg-background border border-border hover:bg-muted text-left transition"
              >
                <HelpCircle className="mr-1 h-3.5 w-3.5 text-primary" />
                Check Balance
              </button>
              <button
                onClick={() => handleSuggestionClick('Upcoming company holidays')}
                className="flex items-center p-1.5 rounded bg-background border border-border hover:bg-muted text-left transition"
              >
                <Calendar className="mr-1 h-3.5 w-3.5 text-success" />
                Upcoming Holidays
              </button>
              <button
                onClick={() => handleSuggestionClick('What are the leave rules?')}
                className="flex items-center p-1.5 rounded bg-background border border-border hover:bg-muted text-left transition"
              >
                <HelpCircle className="mr-1 h-3.5 w-3.5 text-warning" />
                Explain Policy Rules
              </button>
              <button
                onClick={() => handleSuggestionClick('Recommend optimal vacation dates')}
                className="flex items-center p-1.5 rounded bg-background border border-border hover:bg-muted text-left transition"
              >
                <Sparkles className="mr-1 h-3.5 w-3.5 text-indigo-500" />
                Vacation Optimizer
              </button>
            </div>
          )}

          {/* Input Box */}
          <div className="border-t border-border p-3 flex items-center space-x-2 bg-background">
            <input
              type="text"
              placeholder="Ask a policy query..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
              className="flex-1 rounded-xl bg-muted px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary transition"
            />
            <button
              onClick={() => handleSendMessage(inputValue)}
              disabled={loading || !inputValue.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-40 transition"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
