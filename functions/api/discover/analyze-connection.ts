// Cloudflare Pages Function: POST /api/discover/analyze-connection
import { analyzeConnectionWithGemini } from '../../../shared/geminiDiscover.ts';

interface Env {
  GEMINI_API_KEY?: string;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const body = (await context.request.json()) as { itemA?: any; itemB?: any };
    const payload = await analyzeConnectionWithGemini(context.env?.GEMINI_API_KEY, body);

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Gagal menganalisis keterkaitan catatan.',
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
