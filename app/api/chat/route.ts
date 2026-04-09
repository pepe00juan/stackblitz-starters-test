import Groq from 'groq-sdk';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  messages: Message[];
  model: string;
  provider: 'groq' | 'huggingface' | 'xai';
}

// Clients
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { messages, model, provider }: RequestBody = await req.json();

    if (!messages || !model || !provider) {
      return new Response('Missing parameters', { status: 400 });
    }

    let stream: ReadableStream<Uint8Array>;

    if (provider === 'groq') {
      // Groq (igual que antes)
      const chatCompletionStream = await groq.chat.completions.create({
        model,
        stream: true,
        messages: messages.map((msg) => ({ role: msg.role, content: msg.content })),
        temperature: 0.7,
        max_tokens: 2048,
      });

      stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          for await (const chunk of chatCompletionStream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) controller.enqueue(encoder.encode(content));
          }
          controller.close();
        },
      });

    } else if (provider === 'xai') {
      // ==================== xAI GROK ====================
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`xAI Error ${response.status}: ${err}`);
      }

      stream = new ReadableStream({
        async start(controller) {
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          const encoder = new TextEncoder();

          if (!reader) throw new Error('No body');

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                try {
                  const parsed = JSON.parse(line.slice(6));
                  const content = parsed.choices?.[0]?.delta?.content || '';
                  if (content) {
                    controller.enqueue(encoder.encode(content));
                  }
                } catch (_) {}
              }
            }
          }
          controller.close();
        },
      });

    } else if (provider === 'huggingface') {
      // ... (mantén el código de Hugging Face que ya tenías antes)
      // (pégalo aquí igual que en la versión anterior)
    } else {
      return new Response('Invalid provider', { status: 400 });
    }

    return new Response(stream, {
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache'
      },
    });

  } catch (error) {
    console.error('API Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}