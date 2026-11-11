// Cloudflare Pages Function for Workers AI Binding
// Automatically deployed at /api/embed on Cloudflare Pages

interface Env {
  AI: {
    run: (model: string, input: { text: string }) => Promise<any>;
  };
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const body = (await context.request.json()) as { text?: string };
    const text = body?.text || '';

    if (!text.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Text is required for embedding' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if Cloudflare AI binding 'env.AI' is available
    if (context.env && context.env.AI) {
      const aiResponse = await context.env.AI.run('@cf/baai/bge-m3', {
        text: text.trim(),
      });

      // Extract vector array (bge-m3 produces 1024 floats)
      const data = aiResponse?.data || aiResponse;
      const vector = Array.isArray(data[0]) ? data[0] : data;

      if (Array.isArray(vector) && vector.length === 1024) {
        return new Response(
          JSON.stringify({
            success: true,
            vector,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid vector format from Cloudflare AI',
          aiResponse,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Cloudflare AI binding (env.AI) is not configured in wrangler.toml or Pages Settings.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Server error generating embedding',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
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
