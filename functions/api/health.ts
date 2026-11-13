// Cloudflare Pages Function: GET /api/health
import {
  PRIMARY_MODEL,
  FALLBACK_MODEL,
  RETRY_DELAY_MS,
  isGeminiConfigured,
} from '../../shared/geminiDiscover.ts';

interface Env {
  GEMINI_API_KEY?: string;
}

export const onRequestGet = async (context: { env: Env }) => {
  return new Response(
    JSON.stringify({
      ok: true,
      runtime: 'cloudflare-pages',
      primaryModel: PRIMARY_MODEL,
      fallbackModel: FALLBACK_MODEL,
      retryDelayMs: RETRY_DELAY_MS,
      geminiConfigured: isGeminiConfigured(context.env?.GEMINI_API_KEY),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
