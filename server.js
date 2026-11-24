import express from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: "20kb" }));

app.use("/api/", rateLimit({
  windowMs: 60000,
  limit: 15
}));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const rules = `
You are FOOTBALLER AI, a friendly football coach.
Only answer football and soccer related questions.
Help with skills, tactics, positions, training and matches.
Reject unrelated questions politely.
Give safe advice. Never encourage training through pain.
`;

const MODELS = ["gemini-3.8-flash", "gemini-2.5-flash"];

function isHighDemandError(err) {
  const text = `${err?.status ?? ""} ${err?.message ?? ""}`;
  return text.includes("503") || text.toLowerCase().includes("high demand") || text.toLowerCase().includes("unavailable");
}

async function generateFootballReply(question) {
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await ai.models.generateContent({
          model,
          contents: question,
          config: { systemInstruction: rules }
        });
      } catch (err) {
        if (!isHighDemandError(err)) {
          throw err;
        }
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
        }
      }
    }
  }
  throw new Error("503 UNAVAILABLE after retries");
}

app.get("/", (req, res) => {
  res.send("FOOTBALLER AI is running!");
});

app.post("/api/chat", async (req, res) => {
  try {
    const question = req.body.message;

    if (typeof question !== "string" ||
        !question.trim() || question.length > 2000) {
      return res.status(400).json({
        error: "Enter a valid question."
      });
    }

    const result = await generateFootballReply(question);

    res.json({ reply: result.text });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      error: "AI connection failed. Try again."
    });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("FOOTBALLER AI started");
});
