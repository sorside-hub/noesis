import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

export const PRIMARY_MODEL = 'gemini-4-hydrogen';
export const FALLBACK_MODEL = 'gemini-3.1-flash-lite';
export const RETRY_DELAY_MS = 2500;

export class DiscoverApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'DiscoverApiError';
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isGeminiConfigured = (apiKey?: string): boolean => {
  const key = apiKey?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY');
};

const getGeminiClient = (apiKey?: string) => {
  const key = apiKey?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY') {
    throw new DiscoverApiError(
      'GEMINI_API_KEY belum tersedia di environment server (Secrets / Cloudflare Environment Variables).',
      500
    );
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const isFatalAuthError = (err: any): boolean => {
  const msg = String(err?.message || '').toUpperCase();
  const status = err?.status || err?.statusCode;
  return (
    (status === 400 && msg.includes('API_KEY_INVALID')) ||
    status === 403 ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('API_KEY_INVALID')
  );
};

/**
 * Resilient Gemini caller:
 * 1. Try PRIMARY_MODEL ('gemini-4-hydrogen')
 * 2. If attempt 1 fails (non-auth error), wait RETRY_DELAY_MS (2.5s) then retry PRIMARY_MODEL
 * 3. Only if retry also fails, fall back to FALLBACK_MODEL ('gemini-3.1-flash-lite')
 */
export async function callGeminiWithDelayedRetry<T>(
  apiKey: string | undefined,
  executor: (ai: GoogleGenAI, model: string, isFallback: boolean) => Promise<T>
): Promise<{ data: T; modelUsed: string; fallbackUsed: boolean }> {
  const ai = getGeminiClient(apiKey);

  try {
    const data = await executor(ai, PRIMARY_MODEL, false);
    return { data, modelUsed: PRIMARY_MODEL, fallbackUsed: false };
  } catch (firstErr: any) {
    if (isFatalAuthError(firstErr)) {
      throw firstErr;
    }

    console.warn(
      `[Gemini] ${PRIMARY_MODEL} gagal pada percobaan pertama (${firstErr?.message || 'unknown error'}). Menunggu ${RETRY_DELAY_MS}ms sebelum mencoba lagi...`
    );

    await sleep(RETRY_DELAY_MS);

    try {
      const data = await executor(ai, PRIMARY_MODEL, false);
      return { data, modelUsed: PRIMARY_MODEL, fallbackUsed: false };
    } catch (retryErr: any) {
      if (isFatalAuthError(retryErr)) {
        throw retryErr;
      }

      console.warn(
        `[Gemini] ${PRIMARY_MODEL} tetap gagal setelah percobaan ulang (${retryErr?.message || 'unknown error'}). Beralih ke fallback ${FALLBACK_MODEL}...`
      );

      const data = await executor(ai, FALLBACK_MODEL, true);
      return { data, modelUsed: FALLBACK_MODEL, fallbackUsed: true };
    }
  }
}

export const stripHtml = (raw: string): string => {
  if (!raw) return '';
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
};

export async function synthesizeWithGemini(
  apiKey: string | undefined,
  body: { topic?: string; style?: string; items?: any[] }
) {
  const { topic, style = 'structured', items } = body || {};

  if (!Array.isArray(items) || items.length < 2) {
    throw new DiscoverApiError('Minimal pilih 2 catatan atau fragment untuk disintesis.', 400);
  }

  const formattedSources = items
    .map((item: any, idx: number) => {
      const cleanBody = stripHtml(String(item.content || '')).slice(0, 6000);
      const tagsStr = Array.isArray(item.tags) && item.tags.length > 0 ? item.tags.join(', ') : '-';
      return `### Sumber [${idx + 1}] (${item.kind === 'fragment' ? 'Fragment' : 'Catatan'} · Tipe: ${item.type || 'thought'})
Judul: ${item.title || 'Tanpa Judul'}
Tags: ${tagsStr}
Isi:
${cleanBody}`;
    })
    .join('\n\n---\n\n');

  const styleInstruction =
    style === 'essay'
      ? 'Susun sebagai esai naratif yang mengalir alami dan mendalam, dengan transisi halus antar gagasan.'
      : style === 'brief'
      ? 'Susun secara ringkas dan padat berisi poin-poin inti, argumen kunci, dan sintesis kesimpulan praktis.'
      : 'Susun sebagai dokumen pengetahuan terstruktur (Master Note) dengan sub-bab tematik yang logis (Pendahuluan, Pembahasan Terpadu, Perbedaan/Nuansa Sudut Pandang jika ada, dan Kesimpulan).';

  const prompt = `Tugasmu adalah menyintesis kumpulan catatan dan fragment milik pengguna menjadi SATU dokumen pengetahuan yang utuh, terstruktur, dan mudah dipahami.

${topic ? `Topik / Pertanyaan Fokus: "${topic}"\n` : ''}Gaya Penulisan: ${styleInstruction}

ATURAN KETAT:
1. Gunakan HANYA pengetahuan, ide, kutipan, dan argumen yang ada pada sumber catatan pengguna di bawah ini. Jangan mengarang fakta eksternal yang tidak ada di catatan.
2. Temukan benang merah antar catatan yang tampak terpisah, kelompokkan gagasan yang sejalan, dan sorot apabila ada sudut pandang yang saling melengkapi atau bertentangan.
3. Gunakan bahasa yang sama dengan mayoritas isi catatan pengguna (umumnya Bahasa Indonesia yang jernih dan editorial).
4. Format "htmlContent" HARUS menggunakan tag HTML bersih (<h2>, <h3>, <p>, <ul>, <li>, <blockquote>, <strong>, <em>) tanpa tag <html>/<body> dan tanpa judul <h1> di awal (karena judul sudah terpisah di field "title"). Sisipkan referensi sumber ringan seperti <em>(dari: Judul Sumber)</em> bila relevan.

SUMBER PENGETAHUAN (${items.length} item):
${formattedSources}`;

  const { data: result, modelUsed, fallbackUsed } = await callGeminiWithDelayedRetry(
    apiKey,
    async (ai, model, isFallback) => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            'Kamu adalah editor pengetahuan di aplikasi Noesis. Kamu ahli merangkai catatan yang tercecer menjadi dokumen sintesis yang jernih, kohesif, dan setia pada pemikiran penulisnya.',
          responseMimeType: 'application/json',
          thinkingConfig: {
            thinkingLevel: isFallback ? ThinkingLevel.MINIMAL : ThinkingLevel.MEDIUM,
          },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Judul dokumen sintesis yang editorial, jelas, dan merangkum keseluruhan tema.',
              },
              summary: {
                type: Type.STRING,
                description: 'Ringkasan singkat 1-2 kalimat mengenai inti pengetahuan hasil penggabungan.',
              },
              htmlContent: {
                type: Type.STRING,
                description: 'Konten dokumen utuh terstruktur dalam HTML bersih untuk editor Tiptap.',
              },
              suggestedTags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 sampai 5 tag singkat huruf kecil tanpa tanda pagar.',
              },
              synthesisNotes: {
                type: Type.STRING,
                description: 'Penjelasan 1-2 kalimat tentang bagaimana sumber-sumber ini saling terhubung atau melengkapi.',
              },
            },
            required: ['title', 'summary', 'htmlContent', 'suggestedTags', 'synthesisNotes'],
          },
        },
      });

      const text = response.text?.trim();
      if (!text) {
        throw new Error('Model mengembalikan respons kosong.');
      }
      return JSON.parse(text);
    }
  );

  return { success: true, modelUsed, fallbackUsed, result };
}

export async function analyzeConnectionWithGemini(
  apiKey: string | undefined,
  body: { itemA?: any; itemB?: any }
) {
  const { itemA, itemB } = body || {};

  if (!itemA || !itemB) {
    throw new DiscoverApiError('Dua item (itemA dan itemB) diperlukan untuk analisis koneksi.', 400);
  }

  const contentA = stripHtml(String(itemA.content || '')).slice(0, 3500);
  const contentB = stripHtml(String(itemB.content || '')).slice(0, 3500);

  const prompt = `Bandingkan dua catatan/fragment berikut dan jelaskan keterkaitan konseptual di antara keduanya secara jujur dan objektif.

ITEM A (${itemA.kind === 'fragment' ? 'Fragment' : 'Catatan'}):
Judul: ${itemA.title || 'Tanpa Judul'}
Isi: ${contentA}

ITEM B (${itemB.kind === 'fragment' ? 'Fragment' : 'Catatan'}):
Judul: ${itemB.title || 'Tanpa Judul'}
Isi: ${contentB}

Tugas:
1. Tentukan sifat hubungan utamanya: 'complementary' (saling melengkapi), 'expanding' (memperluas topik), 'contrasting' (menyajikan sudut pandang berlawanan/ketegangan ide), atau 'foundational' (satu menjadi dasar bagi yang lain).
2. Jelaskan apa kesamaan inti keduanya secara singkat.
3. Jelaskan hubungan yang terbentuk (apakah saling menguatkan, memberi contoh nyata, atau justru bertentangan).
4. Berikan 1 saran singkat topik gabungan jika kedua catatan ini suatu saat disintesis.`;

  const { data: result, modelUsed, fallbackUsed } = await callGeminiWithDelayedRetry(
    apiKey,
    async (ai, model, isFallback) => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            'Kamu adalah analis hubungan ide di Noesis. Berikan analisis yang jujur, ringkas, dan menggunakan Bahasa Indonesia yang lugas.',
          responseMimeType: 'application/json',
          thinkingConfig: {
            thinkingLevel: isFallback ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
          },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              relationshipType: {
                type: Type.STRING,
                description: "Salah satu dari: 'complementary', 'expanding', 'contrasting', 'foundational'",
              },
              similaritySummary: {
                type: Type.STRING,
                description: 'Kesamaan inti antara Item A dan Item B dalam 1 kalimat.',
              },
              connectionInsight: {
                type: Type.STRING,
                description: 'Penjelasan apakah keduanya saling melengkapi, memperluas, atau bertentangan (1-2 kalimat).',
              },
              synthesisPotential: {
                type: Type.STRING,
                description: 'Ide singkat apa yang bisa dikembangkan jika keduanya digabungkan.',
              },
            },
            required: ['relationshipType', 'similaritySummary', 'connectionInsight', 'synthesisPotential'],
          },
        },
      });

      const text = response.text?.trim();
      if (!text) {
        throw new Error('Model mengembalikan respons kosong.');
      }
      return JSON.parse(text);
    }
  );

  return { success: true, modelUsed, fallbackUsed, result };
}

export async function summarizeClusterWithGemini(
  apiKey: string | undefined,
  body: { items?: any[] }
) {
  const { items } = body || {};

  if (!Array.isArray(items) || items.length < 2) {
    throw new DiscoverApiError('Minimal 2 item diperlukan untuk merangkum tema cluster.', 400);
  }

  const itemsList = items
    .slice(0, 12)
    .map((item: any, idx: number) => {
      const snippet = stripHtml(String(item.content || '')).slice(0, 1200);
      return `[${idx + 1}] (${item.kind === 'fragment' ? 'Fragment' : 'Catatan'}) ${item.title || 'Tanpa Judul'}\nRingkasan isi: ${snippet}`;
    })
    .join('\n\n');

  const prompt = `Berikut adalah sekumpulan catatan dan fragment yang terdeteksi memiliki kemiripan makna. Bantu pengguna melihat apakah kumpulan ini layak dijadikan satu tema eksplorasi bersama.

${itemsList}

Berikan nama tema tentatif (singkat, 2-5 kata), deskripsi benang merahnya (1-2 kalimat jujur — jika masih agak beragam sebutkan juga), dan 2-3 sudut pandang utama yang muncul di dalamnya.`;

  const { data: result, modelUsed, fallbackUsed } = await callGeminiWithDelayedRetry(
    apiKey,
    async (ai, model, isFallback) => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            'Kamu adalah kurator arsip pengetahuan di Noesis. Berikan deskripsi tema yang jujur dan tidak memaksa kesimpulan.',
          responseMimeType: 'application/json',
          thinkingConfig: {
            thinkingLevel: isFallback ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
          },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              themeTitle: {
                type: Type.STRING,
                description: 'Nama tema tentatif dalam 2-5 kata.',
              },
              themeDescription: {
                type: Type.STRING,
                description: 'Penjelasan 1-2 kalimat mengenai keterkaitan tema antar catatan ini.',
              },
              keyAngles: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 sampai 3 sudut pandang singkat yang terkandung dalam kelompok ini.',
              },
            },
            required: ['themeTitle', 'themeDescription', 'keyAngles'],
          },
        },
      });

      const text = response.text?.trim();
      if (!text) {
        throw new Error('Model mengembalikan respons kosong.');
      }
      return JSON.parse(text);
    }
  );

  return { success: true, modelUsed, fallbackUsed, result };
}
