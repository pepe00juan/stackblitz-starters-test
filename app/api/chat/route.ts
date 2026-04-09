
import Groq from 'groq-sdk';

// Indicate to Next.js that this function runs on the edge
export const runtime = 'edge';

// Type for messages coming from the client
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Create an instance of the Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Call the Groq API
    const chatCompletionStream = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant', // A fast and efficient model
      stream: true,
      messages: messages.map((msg: Message) => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    // Create a ReadableStream to send the response to the client
    const stream = new ReadableStream({
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

    // Return the stream as a response
    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error) {
    console.error('Error in Groq API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(`Error: ${errorMessage}`, { status: 500 });
  }
}
