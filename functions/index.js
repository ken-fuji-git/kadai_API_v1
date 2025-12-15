const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

// Secret（OpenAI API Key）
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

// OpenAI Responses API の返却(JSON)から output_text を取り出す
function extractOutputText(respJson) {
    // 公式のレスポンス例では output 配列の中に message があり、
    // その content 配列の中に type: "output_text" が入り text を持ちます  [oai_citation:6‡OpenAI Platform](https://platform.openai.com/docs/api-reference/responses)
    const output = respJson?.output;
    if (!Array.isArray(output)) return "";

    for (const item of output) {
        if (item?.type === "message" && item?.role === "assistant") {
            const content = item?.content;
            if (!Array.isArray(content)) continue;
            const t = content.find((c) => c?.type === "output_text" && typeof c?.text === "string");
            if (t?.text) return t.text.trim();
        }
    }
    return "";
}

exports.api = onRequest(
    { region: "asia-northeast1", secrets: [OPENAI_API_KEY] },
    async (req, res) => {
        try {
            if (req.method !== "POST") {
                return res.status(405).json({ error: "POST only" });
            }

            const { label } = req.body || {};
            const word = (label || "").toString().trim();

            if (!word || word.length > 40) {
                return res.status(400).json({ error: "label is required (<= 40 chars)" });
            }

            // OpenAI Responses API（推奨API）  [oai_citation:7‡OpenAI Platform](https://platform.openai.com/docs/guides/text)
            const response = await fetch("https://api.openai.com/v1/responses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${OPENAI_API_KEY.value()}`
                },
                body: JSON.stringify({
                    model: "gpt-5.2",
                    instructions:
                        "あなたは日本語のダジャレ職人です。入力が英語なら自然な日本語に直してからダジャレを作ってください。",
                    input:
                        `単語: ${word}\n` +
                        "条件: 日本語でダジャレを1つだけ。短く。解説や前置きは不要。"
                })
            });

            if (!response.ok) {
                const text = await response.text();
                return res.status(500).json({ error: "OpenAI error", detail: text });
            }

            const json = await response.json();
            const pun = extractOutputText(json);

            return res.json({ label: word, pun });
        } catch (e) {
            return res.status(500).json({ error: String(e) });
        }
    }
);