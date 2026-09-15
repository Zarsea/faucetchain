import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
dotenv.config();

console.log("INIT TEST");
try {
  console.log("Key:", process.env.GEMINI_API_KEY ? "EXISTS" : "MISSING");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log("Instantiated successfully!");
  
  async function test() {
      try {
          const res = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: "test"
          });
          console.log("RES:", res.text);
      } catch(e) {
          console.error("GENERATE ERROR:", e.message);
      }
  }
  test();
} catch (e) {
  console.error("SETUP ERROR:", e.message);
}
