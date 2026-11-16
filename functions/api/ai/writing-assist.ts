// Cloudflare Pages Function: POST /api/ai/writing-assist
import { assistWritingWithGemini } from '../../../shared/geminiDiscover.ts';

interface Env {
  GEMINI_API_KEY?: string;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const body = (await context.request.json()) as Parameters<typeof assistWritingWithGemini>[1];
    const payload = await assistWritingWithGemini(context.env?.GEMINI_API_KEY, body);

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Gagal memproses pendamping AI.',
      }),
      {
        status: err?.status || 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
