function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff"
        }
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === "/api/health") {
            return json({
                ok: true,
                app: "QWEN NEXUS",
                mode: "guest-no-history"
            });
        }

        if (url.pathname === "/api/chat" && request.method === "POST") {
            if (!env.AI) {
                return json({
                    error: "Workers AI binding belum aktif. Periksa [ai] di wrangler.toml."
                }, 503);
            }

            let body;
            try {
                body = await request.json();
            } catch {
                return json({ error: "Body JSON tidak valid." }, 400);
            }

            const incoming = Array.isArray(body.messages) ? body.messages : [];
            if (!incoming.length) {
                return json({ error: "Pesan kosong." }, 400);
            }

            const messages = incoming.slice(-16).map(m => ({
                role: m.role === "assistant" ? "assistant" : "user",
                content: String(m.content || " ").slice(0, 24000)
            }));

            const prompt = [
                {
                    role: "system",
                    content: "You are QWEN NEXUS, a helpful, accurate AI assistant. Respond in the user's language. Be honest about limitations. Uploaded files are only available if their text is included in the messages."
                },
                ...messages
            ];

            try {
                const result = await env.AI.run(
                    env.AI_MODEL || "@cf/qwen/qwen3.8-27b",
                    {
                        messages: prompt,
                        max_completion_tokens: 1600,
                        temperature: 0.65
                    }
                );

                return json({
                    response: String(
                        result.response ||
                        result.output_text ||
                        result.choices?.[0]?.message?.content ||
                        result.result?.response ||
                        "Model tidak mengembalikan teks."
                    )
                });
            } catch (err) {
                return json({
                    error: `AI gagal memproses pesan: ${err.message || "unknown error"}`
                }, 502);
            }
        }

        if (url.pathname.startsWith("/api/")) {
            return json({ error: "Endpoint tidak ditemukan." }, 404);
        }

        return env.ASSETS.fetch(request);
    }
};
