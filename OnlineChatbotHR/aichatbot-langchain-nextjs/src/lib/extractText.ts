import fs from "node:fs/promises"
import path from "node:path"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { GoogleAIFileManager } from "@google/generative-ai/server"

const OCR_PROMPT = `
ดึงข้อความทั้งหมดออกมาจากเอกสารนี้
- รักษาภาษาไทยให้ถูกต้องครบถ้วน
- รักษารูปแบบการขึ้นบรรทัดใหม่และโครงสร้างเอกสาร
- รักษาหัวข้อ, จุดไข่ปลา (bullet points), และตารางให้อ่านง่าย
- ห้ามสรุปความ ให้ออกมาเฉพาะข้อความที่ดึงได้จริงเท่านั้น
`

export interface ExtractionResult {
  text: string
  pages?: number
  method: "txt" | "csv" | "pdf" | "pdf-ocr" | "docx" | "doc" | "image-ocr" | "unknown"
  warning?: string
}

async function extractTxt(filePath: string): Promise<ExtractionResult> {
  const buf = await fs.readFile(filePath, "utf8")
  return {
    text: (buf || "").toString().trim(),
    method: "txt"
  }
}

async function extractCsv(filePath: string): Promise<ExtractionResult> {
  const d3 = await import("d3-dsv")
  const raw = await fs.readFile(filePath, "utf8")
  const rows = d3.csvParse(raw)
  return {
    text: rows.map(r => Object.values(r).join(" | ")).join("\n").trim(),
    method: "csv"
  }
}

async function extractPdf(filePath: string): Promise<ExtractionResult> {
  try {
    const pdfParse = (await import("pdf-parse")).default
    const buf = await fs.readFile(filePath)
    const data = await pdfParse(buf)
    return {
      text: (data.text || "").trim(),
      pages: data.numpages,
      method: "pdf"
    }
  } catch (err: any) {
    console.warn(`[EXTRACT] pdf-parse failed: ${err.message}. Falling back to OCR...`)
    return { text: "", pages: 0, method: "pdf" }
  }
}

async function extractDocx(filePath: string): Promise<ExtractionResult> {
  try {
    const mammoth = await import("mammoth")
    const result = await mammoth.extractRawText({ path: filePath })
    
    return {
      text: result.value.trim(),
      method: "docx",
      warning: result.messages.length > 0 ? `DOCX had ${result.messages.length} conversion warnings` : undefined
    }
  } catch (error: any) {
    throw new Error(`DOCX extraction failed: ${error.message}`)
  }
}

async function extractDoc(filePath: string): Promise<ExtractionResult> {
  try {
    const WordExtractor = (await import("word-extractor")).default
    const extractor = new WordExtractor()
    const extracted = await extractor.extract(filePath)
    
    return {
      text: extracted.getBody().trim(),
      method: "doc",
      warning: extracted.getFootnotes().length > 0 ? "Footnotes were present but may not be fully extracted" : undefined
    }
  } catch (error: any) {
    throw new Error(`DOC extraction failed: ${error.message}`)
  }
}

async function extractImageOCR(imgPath: string): Promise<ExtractionResult> {
  try {
    const imageBuf = await fs.readFile(imgPath)
    const base64 = imageBuf.toString("base64")
    
    const ext = imgPath.split('.').pop()?.toLowerCase() || 'png'
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`

    const genAI = new GoogleGenerativeAI(process.env.LLM_API_KEY || "")
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview", generationConfig: { temperature: 0.1 } })
    
    const imagePart = {
      inlineData: {
        data: base64,
        mimeType: mimeType
      }
    }

    const response = await model.generateContent([OCR_PROMPT, imagePart])

    return {
      text: response.response.text().trim(),
      method: "image-ocr"
    }
  } catch (error: any) {
    throw new Error(`Gemini Vision OCR failed: ${error.message}`)
  }
}

async function extractPdfOCR(pdfPath: string): Promise<ExtractionResult> {
  try {
    const apiKey = process.env.LLM_API_KEY || ""
    const fileManager = new GoogleAIFileManager(apiKey)
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview", generationConfig: { temperature: 0.1 } })
    
    console.log(`[OCR] Uploading PDF to Gemini...`)
    const uploadResult = await fileManager.uploadFile(pdfPath, {
      mimeType: "application/pdf",
      displayName: `document-${Date.now()}.pdf`,
    })
    
    let fullText = ""
    try {
      console.log(`[OCR] Processing PDF with Gemini...`)
      const response = await model.generateContent([
        {
          fileData: {
            mimeType: uploadResult.file.mimeType,
            fileUri: uploadResult.file.uri
          }
        },
        { text: OCR_PROMPT },
      ])
      fullText = response.response.text().trim()
      console.log(`[OCR] Extraction successful.`)
    } finally {
      await fileManager.deleteFile(uploadResult.file.name).catch(() => {})
    }
    return {
      text: fullText,
      pages: 1, // Gemini ไม่ได้ระบุจำนวนหน้า จึงมองทั้งไฟล์เป็นเอกสารเดียว
      method: "pdf-ocr"
    }
  } catch (error: any) {
    console.error(`[OCR] Fatal error: ${error.message}`)
    return {
      text: "",
      method: "pdf-ocr",
      warning: `OCR fatal error: ${error.message}`
    }
  }
}

export async function extractText(filePath: string, mimeType?: string): Promise<ExtractionResult> {
  const ext = path.extname(filePath).toLowerCase().replace(".", "")
  
  if (ext === "txt") {
    return await extractTxt(filePath)
  }
  if (ext === "csv") {
    return await extractCsv(filePath)
  }
  if (ext === "docx") {
    return await extractDocx(filePath)
  }
  if (ext === "doc") {
    return await extractDoc(filePath)
  }  
  if (ext === "pdf") {
    const result = await extractPdf(filePath)
    
    // หาก PDF มีข้อความน้อยเกินไป (อาจเป็นรูปภาพสแกน) ให้สลับไปใช้ OCR
    if (result.text.trim().length > 50) {
      return result
    }
    const ocrResult = await extractPdfOCR(filePath)
    return ocrResult
  }
  
  if (mimeType?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff", "tif"].includes(ext)) {
    return await extractImageOCR(filePath)
  }
  return {
    text: "",
    method: "unknown",
    warning: `Unsupported file type: ${ext} (mime: ${mimeType || "unknown"})`
  }
}
