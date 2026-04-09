import Groq from 'groq-sdk';
import { NextRequest } from 'next/server';

// Indicate to Next.js that this function runs on the edge
export const runtime = 'edge';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  messages: Message[];
  model: string;
  provider: 'groq' | 'huggingface';
}

// Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { messages, model, provider }: RequestBody = await req.json();

    if (!messages || !model || !provider) {
      return new Response('Missing model or provider', { status: 400 });
    }

    let stream: ReadableStream;

    if (provider === 'groq') {
      // ==================== GROQ ====================
      const chatCompletionStream = await groq.chat.completions.create({
        model: model,                    // modelo dinámico
        stream: true,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: 0.7,
        max_tokens: 2048,
      });

      stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          for await (const chunk of chatCompletionStream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        },
      });

    } else if (provider === 'huggingface') {
      // ==================== HUGGING FACE ====================
      const hfResponse = await fetch(
        `https://api-inference.huggingface.co/models/${model}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            stream: true,
            temperature: 0.7,
            max_tokens: 2048,
          }),
        }
      );

      if (!hfResponse.ok) {
        const errorText = await hfResponse.text();
        throw new Error(`Hugging Face Error: ${hfResponse.status} - ${errorText}`);
      }

      // HF devuelve un stream compatible con SSE, lo convertimos a texto plano
      stream = new ReadableStream({
        async start(controller) {
          const reader = hfResponse.body?.getReader();
          const decoder = new TextDecoder();
          const encoder = new TextEncoder();

          if (!reader) throw new Error('No response body');

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            // HF usa formato SSE (data: {...})
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content || '';
                  if (content) {
                    controller.enqueue(encoder.encode(content));
                  }
                } catch (e) {
                  // Ignorar líneas que no sean JSON válido
                }
              }
            }
          }
          controller.close();
        },
      });

    } else {
      return new Response('Invalid provider', { status: 400 });
    }

    // Return the stream
    return new Response(stream, {
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache'
      },
    });

  } catch (error) {
    console.error('Error in /api/chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(`Error: ${errorMessage}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}