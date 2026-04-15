import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

function readConfig(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'))
  } catch {
    return {}
  }
}

function writeConfig(cfg: Record<string, string>): void {
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2))
}

export function saveApiKey(key: string): void {
  const cfg = readConfig()
  cfg.geminiApiKey = key
  writeConfig(cfg)
}

export function loadApiKey(): string | null {
  // Build-time env var takes priority (set MAIN_VITE_GEMINI_API_KEY in .env)
  const envKey = import.meta.env.MAIN_VITE_GEMINI_API_KEY as string | undefined
  if (envKey) return envKey
  return readConfig().geminiApiKey || null
}

export async function generateWithGemini(prompt: string): Promise<string> {
  const key = loadApiKey()
  if (!key) throw new Error('No Gemini API key set. Enter your key in the Insights tab.')
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const result = await model.generateContent(prompt)
  return result.response.text()
}
