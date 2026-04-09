'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

// Tipos
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ==================== TIPOS Y MODELOS ====================
interface ModelOption {
  id: string;
  name: string;
  provider: 'groq' | 'huggingface' | 'xai';
}

const availableModels: ModelOption[] = [
  // === Groq ===
  { 
    id: 'llama-3.3-70b-versatile', 
    name: 'Llama 3.3 70B (Groq - Rápido)', 
    provider: 'groq' 
  },
  { 
    id: 'llama-3.1-8b-instant', 
    name: 'Llama 3.1 8B (Groq - Muy rápido)', 
    provider: 'groq' 
  },

  // === xAI Grok ===
  { 
    id: 'grok-4.20-0309-reasoning', 
    name: 'Grok 4.20 Reasoning (xAI)', 
    provider: 'xai' 
  },
  { 
    id: 'grok-4.20-0309-non-reasoning', 
    name: 'Grok 4.20 Non-Reasoning (xAI)', 
    provider: 'xai' 
  },
  { 
    id: 'grok-4-1-fast-reasoning', 
    name: 'Grok 4.1 Fast Reasoning (xAI)', 
    provider: 'xai' 
  },

  // === Hugging Face ===
  { 
    id: 'meta-llama/Llama-3.1-70B-Instruct', 
    name: 'Llama 3.1 70B (HF)', 
    provider: 'huggingface' 
  },
  { 
    id: 'Qwen/Qwen2.5-72B-Instruct', 
    name: 'Qwen2.5 72B (HF)', 
    provider: 'huggingface' 
  },
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState('llama-3.3-70b-versatile'); // modelo por defecto

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentModel = availableModels.find(m => m.id === selectedModelId) || availableModels[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = { 
      role: 'user', 
      content: input, 
      id: crypto.randomUUID() 
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, userMessage],
          model: selectedModelId,
          provider: currentModel.provider
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Error ${response.status}: ${await response.text()}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const assistantMessageId = crypto.randomUUID();

      setMessages(prev => [...prev, { 
        id: assistantMessageId, 
        role: 'assistant', 
        content: '' 
      }]);

      let currentContent = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        currentContent += chunkText;

        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: currentContent } 
            : msg
        ));
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error de conexión';
      setError(errorMessage);
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 font-sans">
      <header className="p-4 bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <h1 className="text-2xl md:text-3xl font-bold text-center text-gray-800 tracking-tight">
          Chat con Luna 🌙
        </h1>
      </header>

      {/* === NUEVO SELECTOR DE MODELO === */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 p-3 sticky top-[73px] z-10">
        <div className="max-w-4xl mx-auto">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Modelo de IA
          </label>
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm"
            disabled={isProcessing}
          >
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
            <p className="text-xs text-gray-500 mt-1">
                {currentModel.provider === 'groq' && '🚀 Groq (muy rápido)'}
                {currentModel.provider === 'xai' && '⚡ Grok xAI (buenos límites)'}
                {currentModel.provider === 'huggingface' && '🤗 Hugging Face'}
            </p>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-4 max-w-3xl mx-auto transition-all duration-300 ${
              msg.role === 'user' ? 'ml-auto justify-end' : ''
            }`}>
            {msg.role === 'assistant' && (
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-400 to-indigo-500 flex-shrink-0 text-white flex items-center justify-center text-xl">🌙</div>
            )}
            <div className={`rounded-2xl shadow-md transition-shadow hover:shadow-lg ${
              msg.role === 'user'
                ? 'p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-br-none'
                : msg.content.includes('[IMAGE:') 
                  ? 'bg-transparent border-none shadow-none p-0'
                  : 'bg-white border border-gray-100 rounded-bl-none'
            }`}>
              <div className="leading-relaxed whitespace-pre-wrap text-base prose max-w-none">
                <MessageContent content={msg.content} />
              </div>
            </div>
            {msg.role === 'user' && (
              <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-600 flex-shrink-0 flex items-center justify-center font-semibold">TÚ</div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-4 bg-white/90 backdrop-blur-md border-t border-gray-200 shadow-inner sticky bottom-0">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Habla con Luna... (pide imágenes con [IMAGE: descripción])"
            className="flex-1 px-5 py-3 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all shadow-sm disabled:opacity-60 text-gray-800 placeholder-gray-500"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={isProcessing || !input.trim()}
            className="px-7 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-full hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            Enviar
          </button>
        </form>
      </footer>

      {error && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-100 border-l-4 border-red-500 text-red-800 p-4 rounded-lg shadow-xl max-w-md w-full mx-4 animate-pulse">
          <p className="font-bold">¡Ups! Algo salió mal</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}
    </div>
  );
}

// Componente MessageContent (sin cambios)
const MessageContent = ({ content }: { content: string }) => {
  const [imageError, setImageError] = useState(false);
  const imageMatch = content.match(/\[IMAGE:(.*?)\]/);

  if (imageMatch) {
    if (imageError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-red-500 p-4 text-center rounded-xl">
          Error: The image could not be loaded.
        </div>
      );
    }
    
    const prompt = imageMatch[1].trim() || 'a beautiful high-resolution image';
    const encoded = encodeURIComponent(prompt);
    
    return (
      <div className="rounded-xl overflow-hidden aspect-square max-w-sm mx-auto group">
        <Image
          src={`https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&model=flux&nologo=true&enhance=true`}
          alt={prompt}
          width={1024}
          height={1024}
          priority={true}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return <p className="p-4">{content}</p>;
};