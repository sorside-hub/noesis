import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  PRIMARY_MODEL,
  FALLBACK_MODEL,
  RETRY_DELAY_MS,
  isGeminiConfigured,
  synthesizeWithGemini,
  analyzeConnectionWithGemini,
  summarizeClusterWithGemini,
} from './shared/geminiDiscover.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Healthcheck
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      runtime: 'node-express',
      primaryModel: PRIMARY_MODEL,
      fallbackModel: FALLBACK_MODEL,
      retryDelayMs: RETRY_DELAY_MS,
      geminiConfigured: isGeminiConfigured(process.env.GEMINI_API_KEY),
    });
  });

  // Optional local proxy for Cloudflare BGE-M3 embedding if configured in server env
  app.post('/api/embed', async (req: Request, res: Response) => {
    const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const cfApiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

    if (
      !cfAccountId ||
      cfAccountId.includes('your-cloudflare-account-id') ||
      !cfApiToken ||
      cfApiToken.includes('your-cloudflare-api-token')
    ) {
      return res.status(404).json({
        success: false,
        error: 'Cloudflare server env not configured; client fallback active.',
      });
    }

    try {
      const text = String(req.body?.text || '').trim();
      if (!text) {
        return res.status(400).json({ success: false, error: 'Text is required' });
      }

      const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/baai/bge-m3`;
      const cfRes = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!cfRes.ok) {
        const errText = await cfRes.text();
        return res.status(cfRes.status).json({ success: false, error: errText });
      }

      const json = (await cfRes.json()) as any;
      const data = json?.result?.data;
      const vector = Array.isArray(data?.[0]) ? data[0] : data;

      if (Array.isArray(vector) && vector.length === 1024) {
        return res.json({ success: true, vector });
      }
      return res.status(500).json({ success: false, error: 'Invalid vector response' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Embedding error' });
    }
  });

  // 1. SYNTHESIS ENDPOINT
  app.post('/api/discover/synthesize', async (req: Request, res: Response) => {
    try {
      const payload = await synthesizeWithGemini(process.env.GEMINI_API_KEY, req.body);
      return res.json(payload);
    } catch (err: any) {
      console.error('Error in /api/discover/synthesize:', err);
      return res.status(err?.status || 500).json({
        success: false,
        error: err?.message || 'Gagal menyusun sintesis dokumen.',
      });
    }
  });

  // 2. CONNECTIONS ENDPOINT
  app.post('/api/discover/analyze-connection', async (req: Request, res: Response) => {
    try {
      const payload = await analyzeConnectionWithGemini(process.env.GEMINI_API_KEY, req.body);
      return res.json(payload);
    } catch (err: any) {
      console.error('Error in /api/discover/analyze-connection:', err);
      return res.status(err?.status || 500).json({
        success: false,
        error: err?.message || 'Gagal menganalisis keterkaitan catatan.',
      });
    }
  });

  // 3. TOPIC CLUSTERS ENDPOINT
  app.post('/api/discover/summarize-cluster', async (req: Request, res: Response) => {
    try {
      const payload = await summarizeClusterWithGemini(process.env.GEMINI_API_KEY, req.body);
      return res.json(payload);
    } catch (err: any) {
      console.error('Error in /api/discover/summarize-cluster:', err);
      return res.status(err?.status || 500).json({
        success: false,
        error: err?.message || 'Gagal merangkum tema cluster.',
      });
    }
  });

  // Mount Vite dev middleware or serve static build
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Noesis server running at http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})`);
  });
}

startServer();
