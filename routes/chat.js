import express from "express";
import axios from "axios";
import { supabase } from "../supabase.js";
import { verifyToken } from "../middlewares/auth.js";

const router = express.Router();

const SYSTEM_PROMPT = {
  role: "system",
  content: `Eres un asistente médico educativo.

            Reglas:
            - Responde de forma breve y clara yendo a lo más relevante, pero sin perder información importante
            - No repitas información
            - Usa lenguaje sencillo            
            - No des diagnósticos definitivos
            - No recetes medicamentos

            Despues de explicar, deberás dar el siguiente formato:

            Formato:
            Síntomas posibles:
            Recomendación:
            Nivel de urgencia: (Baja, Media o Alta)
            `
};


router.post("/create", verifyToken, async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Título requerido" });
    }

    const { data, error } = await supabase
      .from("chats")
      .insert({
        user_id: req.user.id,
        title,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json(data);

  } catch (err) {
    console.error("SERVER CRASH:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

router.get("/", verifyToken, async (req, res) => {
  const { data } = await supabase
    .from("chats")
    .select("*")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });

  res.json(data);
});


router.get("/:chatId/messages", verifyToken, async (req, res) => {
  const { chatId } = req.params;

  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at");

  res.json(data);
});

router.post("/:chatId/message", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;

    if (!chatId || chatId === "undefined") return res.status(400).json({ error: "chatId inválido" });
    if (!content) return res.status(400).json({ error: "Mensaje vacío" });

    const { error: insertError } = await supabase.from("messages").insert({ chat_id: chatId, role: "user", content });
    if (insertError) return res.status(500).json({ error: insertError.message });

    const { data: history, error: historyError } = await supabase
      .from("messages")
      .select("role, content")
      .eq("chat_id", chatId)
      .order("created_at");
    if (historyError) return res.status(500).json({ error: historyError.message });

    const messages = [SYSTEM_PROMPT, ...history];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        max_tokens: 250,
        temperature: 0.4,
        messages,
        stream: true,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        responseType: "stream",
      }
    );

    let fullAiMessage = "";

    response.data.on("data", (chunk) => {
      const payload = chunk.toString();
      const lines = payload.split("\n").filter((line) => line.trim() !== "");

      for (const line of lines) {
        if (line.includes("[DONE]")) {
          supabase.from("messages").insert({
            chat_id: chatId,
            role: "assistant",
            content: fullAiMessage,
          }).then(() => res.end());
          return;
        }

        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.replace("data: ", ""));
            const textChunk = data.choices[0]?.delta?.content || "";
            if (textChunk) {
              fullAiMessage += textChunk;
              // Enviamos el fragmento al frontend
              res.write(`data: ${JSON.stringify({ content: textChunk })}\n\n`);
            }
          } catch (err) {
          }
        }
      }
    });

    response.data.on("error", (err) => {
      console.error("Stream reading error:", err);
      res.end();
    });

  } catch (err) {
    console.error("AXIOS ERROR:", err.response?.data || err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error interno del servidor" });
    } else {
      res.end();
    }
  }
});

router.delete("/:chatId", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;

    const { data: chat } = await supabase
      .from("chats")
      .select("*")
      .eq("id", chatId)
      .eq("user_id", req.user.id)
      .single();

    if (!chat) {
      return res.status(404).json({ error: "Chat no encontrado" });
    }

    const { error } = await supabase
      .from("chats")
      .delete()
      .eq("id", chatId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error eliminando chat" });
  }
});

export default router;