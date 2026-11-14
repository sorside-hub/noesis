import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

export const PRIMARY_MODEL = 'gemini-4-hydrogen';
export const FALLBACK_MODEL = 'gemini-3.5-flash-lite';
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

export const stripSynthesisSourcesFooter = (rawHtml: string): string => {
  if (!rawHtml) return '';
  return rawHtml
    .replace(
      /(?:<hr\s*\/?>\s*)?<p>\s*<strong>\s*Sumber Pengetahuan\s*\(\d+\):\s*<\/strong>\s*<\/p>\s*<ul>[\s\S]*?<\/ul>\s*$/i,
      ''
    )
    .trim();
};

export async function synthesizeWithGemini(
  apiKey: string | undefined,
  body: {
    topic?: string;
    style?: string;
    items?: any[];
    existingSynthesis?: {
      id?: string;
      title?: string;
      htmlContent?: string;
      tags?: string[];
    };
  }
) {
  const { topic, style = 'structured', items, existingSynthesis } = body || {};
  const isIncrementalUpdate = Boolean(
    existingSynthesis &&
      typeof existingSynthesis.htmlContent === 'string' &&
      existingSynthesis.htmlContent.trim().length > 0
  );

  if (!Array.isArray(items) || items.length < (isIncrementalUpdate ? 1 : 2)) {
    throw new DiscoverApiError(
      isIncrementalUpdate
        ? 'Pilih minimal 1 catatan atau fragment baru untuk memperbarui sintesis.'
        : 'Minimal pilih 2 catatan atau fragment untuk disintesis.',
      400
    );
  }

  const formattedSources = items
    .map((item: any, idx: number) => {
      const cleanBody = stripHtml(String(item.content || '')).slice(0, 6000);
      const tagsStr = Array.isArray(item.tags) && item.tags.length > 0 ? item.tags.join(', ') : '-';
      return `### ${isIncrementalUpdate ? 'Materi Baru' : 'Sumber'} [${idx + 1}] (${item.kind === 'fragment' ? 'Fragment' : 'Catatan'} · Tipe: ${item.type || 'thought'})
Judul: ${item.title || 'Tanpa Judul'}
Tags: ${tagsStr}
Isi:
${cleanBody}`;
    })
    .join('\n\n---\n\n');

  const styleInstruction =
    style === 'essay'
      ? 'Susun sebagai esai naratif yang jernih dan mengalir secara bahasa, dengan transisi logika yang transparan. Saat menjembatani dua gagasan, jelaskan sifat hubungannya secara hati-hati (misalnya paralel tematik atau perbandingan) tanpa memaksakan hubungan sebab-akibat atau menarik generalisasi mutlak.'
      : style === 'brief'
      ? 'Susun secara ringkas dan padat berisi butir-butir gagasan inti tiap sumber, titik temu yang benar-benar didukung teks, perbedaan konteks/ranah jika ada, serta rangkuman terbatas tanpa melebih-lebihkan klaim sumber.'
      : 'Susun sebagai dokumen pengetahuan terstruktur (Master Note) dengan sub-bab tematik yang logis: Pembuka/Konteks, Gagasan & Temuan dari Sumber, Titik Temu dan Perbedaan Ranah (pisahkan secara jujur bila ada sumber yang konteksnya berbeda), serta sub-bab penutup "Sintesis Sejauh Ini & Pertanyaan Terbuka" (bukan kesimpulan mutlak).';

  const cleanedBaseHtml = isIncrementalUpdate
    ? stripSynthesisSourcesFooter(String(existingSynthesis?.htmlContent || '')).slice(0, 24000)
    : '';
  const cleanedBaseTitle = String(existingSynthesis?.title || 'Dokumen Sintesis').trim();

  const epistemicDisciplineRules = `DISIPLIN EPISTEMIK & ANTI-OVERCLAIMING (WAJIB DIPATUHI):
- PROPORSI KLAIM (NO SCOPE CREEP): Jangan pernah memperluas cakupan kesimpulan melebihi informasi sumbernya. Jika catatan membahas kasus spesifik atau memakai kata lunak ("bisa menjadi", "cenderung", "terkadang", "dalam konteks..."), PERTAHANKAN kualifikasi tersebut. DILARANG mengubahnya menjadi klaim mutlak ("selalu", "semua manusia", "pasti", "membuktikan bahwa...").
- JANGAN MEMAKSA KESATUAN SEMU: Jika sumber-sumber berasal dari ranah berbeda (misalnya pengalaman personal vs mekanisme perilaku vs bias kognitif), JANGAN memaksanya seolah-olah membentuk satu pembuktian tunggal. Nyatakan secara jujur bila keduanya hanya bersinggungan tema, saling melengkapi secara parsial, atau lebih tepat dibaca berdampingan.
- PISAHKAN FAKTA SUMBER VS INTERPRETASI: Jaga agar pembaca tahu mana gagasan yang benar-benar berasal dari catatan (sertakan rujukan ringan seperti <em>(dari: Judul Sumber)</em> bila relevan) dan mana dugaan/pola penghubung tentatif.
- PENUTUP YANG JUJUR & GENERATIF: Alih-alih menutup dengan vonis universal yang terdengar puitis tapi mengada-ada, rangkum hanya apa yang sejauh ini benar-benar didukung catatan, lalu cantumkan celah logika atau pertanyaan terbuka yang masih perlu dieksplorasi penulis.`;

  const prompt = isIncrementalUpdate
    ? `Tugasmu adalah MEMPERBARUI dokumen sintesis pengetahuan yang sudah ada dengan mengintegrasikan materi baru milik pengguna tanpa membuang fondasi pemikiran sebelumnya.

${topic ? `Fokus Pembaruan / Pertanyaan Tambahan: "${topic}"\n` : ''}Gaya Penulisan Target: ${styleInstruction}

ATURAN KETAT PEMBARUAN (1 + N -> 1):
1. Jadikan "DOKUMEN SINTESIS SAAT INI" sebagai fondasi utama. Pertahankan struktur, gagasan matang, dan formulasi kalimat yang masih relevan (termasuk bagian yang mungkin sudah disunting manual oleh penulis), sambil tetap mengoreksi bila ada lompatan kesimpulan yang berlebihan.
2. Integrasikan wawasan, argumen, kutipan, atau nuansa dari "MATERI BARU" ke dalam sub-bab yang paling relevan, atau buat sub-bab baru (<h2>/<h3>) bila materi baru membawa dimensi/ranah berbeda yang belum terakomodasi.
3. JANGAN sekadar menempelkan materi baru di paragraf paling bawah sebagai lampiran terpisah. Leleburkan menjadi satu alur yang kohesif dan perbarui bagian "Sintesis Sejauh Ini & Pertanyaan Terbuka" di akhir bila diperlukan.
4. Gunakan HANYA pengetahuan dari Dokumen Sintesis Saat Ini dan Materi Baru di bawah ini. Jangan mengarang fakta eksternal.
5. Gunakan bahasa yang sama dengan dokumen (umumnya Bahasa Indonesia yang jernih dan editorial).
6. Format "htmlContent" HARUS berupa HTML bersih (<h2>, <h3>, <p>, <ul>, <li>, <blockquote>, <strong>, <em>) tanpa tag <html>/<body>, tanpa <h1>, dan TANPA daftar "Sumber Pengetahuan" di akhir (daftar sumber akan digabungkan otomatis oleh sistem).
7. Pada field "synthesisNotes", jelaskan ringkas pembaruan yang berhasil diintegrasikan SEKALIGUS catat secara jujur bila ada materi baru yang sebenarnya berbeda ranah/konteks atau masih bersifat dugaan tematik.

${epistemicDisciplineRules}

DOKUMEN SINTESIS SAAT INI (Judul: "${cleanedBaseTitle}"):
${cleanedBaseHtml}

=== MATERI BARU YANG PERLU DIINTEGRASIKAN (${items.length} item) ===
${formattedSources}`
    : `Tugasmu adalah menyintesis kumpulan catatan dan fragment milik pengguna menjadi SATU dokumen pengetahuan yang utuh, terstruktur, jujur secara logika, dan mudah dipahami.

${topic ? `Topik / Pertanyaan Fokus: "${topic}"\n` : ''}Gaya Penulisan: ${styleInstruction}

ATURAN KETAT:
1. Gunakan HANYA pengetahuan, ide, kutipan, dan argumen yang ada pada sumber catatan pengguna di bawah ini. Jangan mengarang fakta eksternal yang tidak ada di catatan.
2. Temukan titik temu, ketegangan, maupun perbedaan konteks antar catatan secara proporsional. Jika ada catatan yang hanya bersinggungan tipis atau berbeda level bahasan, tempatkan sebagai sudut pandang terpisah/pelengkap tanpa memaksanya jadi satu tesis mutlak.
3. Gunakan bahasa yang sama dengan mayoritas isi catatan pengguna (umumnya Bahasa Indonesia yang jernih dan editorial).
4. Format "htmlContent" HARUS menggunakan tag HTML bersih (<h2>, <h3>, <p>, <ul>, <li>, <blockquote>, <strong>, <em>) tanpa tag <html>/<body> dan tanpa judul <h1> di awal (karena judul sudah terpisah di field "title").
5. Pada field "synthesisNotes", selain menyebut benang merah utamanya, wajib jujur mencatat batas keterkaitan antar sumber (misalnya jika hubungan antar catatan masih bersifat paralel tematik / eksploratif dan belum saling membuktikan secara kausal).

${epistemicDisciplineRules}

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
            'Kamu adalah editor pengetahuan yang teliti dan jujur secara epistemik di aplikasi Noesis. Kamu ahli merangkai catatan yang tercecer menjadi dokumen sintesis yang jernih dan kohesif, namun selalu disiplin menjaga batas klaim agar tidak melakukan over-generalization atau menarik kesimpulan melampaui isi catatan penulisnya.',
          responseMimeType: 'application/json',
          thinkingConfig: {
            thinkingLevel: isFallback ? ThinkingLevel.MINIMAL : ThinkingLevel.MEDIUM,
          },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description:
                  'Judul dokumen sintesis yang editorial, jelas, dan proporsional terhadap isi sumber (tidak melebih-lebihkan menjadi klaim universal).',
              },
              summary: {
                type: Type.STRING,
                description:
                  'Ringkasan singkat 1-2 kalimat mengenai ruang lingkup pengetahuan hasil penggabungan tanpa overclaiming.',
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
                description:
                  'Penjelasan jujur 1-3 kalimat mengenai bagaimana sumber-sumber ini terhubung beserta batasan/perbedaan ranahnya bila belum saling membuktikan secara langsung.',
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

  const prompt = `Bandingkan dua catatan/fragment berikut dan jelaskan keterkaitan konseptual di antara keduanya secara jujur, proporsional, dan objektif.

ITEM A (${itemA.kind === 'fragment' ? 'Fragment' : 'Catatan'}):
Judul: ${itemA.title || 'Tanpa Judul'}
Isi: ${contentA}

ITEM B (${itemB.kind === 'fragment' ? 'Fragment' : 'Catatan'}):
Judul: ${itemB.title || 'Tanpa Judul'}
Isi: ${contentB}

Tugas & Aturan Kejujuran Epistemik:
1. Tentukan sifat hubungan utamanya secara jujur:
   - 'complementary' (saling melengkapi secara langsung pada topik yang sama)
   - 'expanding' (satu memperluas atau memberi dimensi lanjutan atas topik yang sama)
   - 'contrasting' (menyajikan sudut pandang berlawanan atau ketegangan ide yang jelas)
   - 'foundational' (satu menjadi dasar atau prasyarat konseptual bagi yang lain)
   - 'loose' (hanya bersinggungan longgar, berbeda ranah/konteks, atau sekadar mirip nuansa tanpa saling membuktikan)
2. JANGAN memaksakan kecocokan atau hubungan sebab-akibat jika keduanya sebenarnya membahas ranah berbeda (misal kasus spesifik vs konsep kognitif umum). Jika hubungannya tipis, pilih 'loose' dan nyatakan batasannya dengan terus terang.
3. Jelaskan irisan/kesamaan nyatanya secara spesifik tanpa memakai klaim mutlak ("selalu", "semua manusia", "membuktikan").
4. Jelaskan hubungan yang terbentuk beserta batasan konteksnya bila ada.
5. Untuk potensi penggabungan, tuliskan sebagai 1 pertanyaan eksplorasi atau sudut pandang perbandingan yang proporsional (bukan tesis universal yang mengada-ada).`;

  const { data: result, modelUsed, fallbackUsed } = await callGeminiWithDelayedRetry(
    apiKey,
    async (ai, model, isFallback) => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            'Kamu adalah analis hubungan ide yang kritis dan jujur di Noesis. Jika dua catatan memang nyambung erat, jelaskan dengan jernih; jika hanya bersinggungan tipis atau berbeda konteks, katakan apa adanya tanpa melebih-lebihkan klaim.',
          responseMimeType: 'application/json',
          thinkingConfig: {
            thinkingLevel: isFallback ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
          },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              relationshipType: {
                type: Type.STRING,
                description:
                  "Salah satu dari: 'complementary', 'expanding', 'contrasting', 'foundational', 'loose'",
              },
              similaritySummary: {
                type: Type.STRING,
                description:
                  'Kesamaan atau irisan nyata antara Item A dan Item B dalam 1 kalimat yang terkalibrasi (tidak melampaui teks).',
              },
              connectionInsight: {
                type: Type.STRING,
                description:
                  'Penjelasan jujur apakah keduanya saling melengkapi, memperluas, bertentangan, atau hanya bersinggungan longgar beserta batasan konteksnya (1-2 kalimat).',
              },
              synthesisPotential: {
                type: Type.STRING,
                description:
                  '1 pertanyaan eksplorasi atau sudut pandang perbandingan yang proporsional bila keduanya ingin ditinjau bersama (bukan kesimpulan mutlak).',
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

  const prompt = `Berikut adalah sekumpulan catatan dan fragment yang terdeteksi memiliki kemiripan makna. Bantu pengguna melihat apakah kumpulan ini benar-benar layak dieksplorasi bersama, atau sebenarnya masih campur aduk.

${itemsList}

Tugas & Aturan Kejujuran:
1. Berikan nama tema tentatif (2-5 kata) yang proporsional dengan cakupan catatan—JANGAN memberi judul teori besar atau klaim universal (mis. hindari klaim tentang "semua manusia" atau "selalu").
2. Berikan deskripsi benang merahnya (1-2 kalimat jujur). Jika ada satu atau beberapa catatan yang sebenarnya agak melenceng/berbeda ranah dari mayoritas kelompok, SEBUTKAN secara eksplisit agar pengguna bisa mempertimbangkan untuk tidak menyertakannya ke Synthesis.
3. Berikan 2-3 sudut pandang nyata yang muncul di dalamnya tanpa memperluas skala klaim melebihi teks asli.`;

  const { data: result, modelUsed, fallbackUsed } = await callGeminiWithDelayedRetry(
    apiKey,
    async (ai, model, isFallback) => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            'Kamu adalah kurator arsip pengetahuan yang jujur di Noesis. Kamu tidak pernah memaksakan kesimpulan atau menyamaratakan catatan yang berbeda konteks menjadi satu klaim besar.',
          responseMimeType: 'application/json',
          thinkingConfig: {
            thinkingLevel: isFallback ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
          },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              themeTitle: {
                type: Type.STRING,
                description: 'Nama tema tentatif dalam 2-5 kata yang proporsional dan tidak overclaiming.',
              },
              themeDescription: {
                type: Type.STRING,
                description:
                  'Penjelasan jujur 1-2 kalimat mengenai benang merah kelompok ini, termasuk menyebut bila ada item yang masih agak berbeda ranah/longgar kaitannya.',
              },
              keyAngles: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  '2 sampai 3 sudut pandang spesifik yang benar-benar terkandung dalam kelompok ini tanpa generalisasi berlebih.',
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
