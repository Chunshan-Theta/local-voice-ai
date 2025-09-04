import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 確保 tmp 目錄存在
    const uploadDir = './tmp';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 解析上傳的表單數據
    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
    });

    const [fields, files] = await form.parse(req);
    
    const audioFile = Array.isArray(files.audio_file) ? files.audio_file[0] : files.audio_file;
    const textInput = Array.isArray(fields.text_input) ? fields.text_input[0] : fields.text_input;

    if (!audioFile || !textInput) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要的音頻文件或文字內容' 
      });
    }

    // 使用 ffmpeg 將音檔轉換為 MP3 格式
    console.log('原始音檔資訊:', {
      filename: audioFile.originalFilename,
      mimetype: audioFile.mimetype,
      size: audioFile.size,
      filepath: audioFile.filepath
    });

    // 準備 MP3 輸出路徑
    const mp3Filename = `reference_audio_${Date.now()}.mp3`;
    const mp3OutputPath = path.join(uploadDir, mp3Filename);

    // 使用 ffmpeg 轉換為 MP3
    console.log('開始轉換音檔為 MP3 格式...');
    await new Promise<void>((resolve, reject) => {
      ffmpeg(audioFile.filepath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .audioBitrate(128)
        .audioChannels(1) // 單聲道，適合語音
        .audioFrequency(22050) // 22kHz 採樣率，適合語音
        .on('start', (commandLine) => {
          console.log('FFmpeg 命令:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('轉換進度:', progress.percent ? `${progress.percent.toFixed(2)}%` : '處理中...');
        })
        .on('end', () => {
          console.log('音檔轉換完成:', mp3OutputPath);
          resolve();
        })
        .on('error', (err) => {
          console.error('FFmpeg 轉換錯誤:', err);
          reject(new Error(`音檔轉換失敗: ${err.message}`));
        })
        .save(mp3OutputPath);
    });

    // 檢查轉換後的檔案
    if (!fs.existsSync(mp3OutputPath)) {
      throw new Error('MP3 轉換失敗，輸出檔案不存在');
    }

    const mp3Stats = fs.statSync(mp3OutputPath);
    console.log('轉換後的 MP3 檔案資訊:', {
      path: mp3OutputPath,
      size: mp3Stats.size,
      sizeMB: (mp3Stats.size / 1024 / 1024).toFixed(2) + ' MB'
    });

    // 準備 FormData 發送到 TTS 服務
    const formData = new FormData();
    formData.append('audio_file', fs.createReadStream(mp3OutputPath), {
      filename: 'reference_audio.mp3',
      contentType: 'audio/mpeg'
    });
    formData.append('text_input', textInput);

    // 發送到 TTS 服務
    const ttsServiceUrl = process.env.TTS_SERVICE_URL || 'http://localhost:8000';
    const apiUrl = ttsServiceUrl.includes('/v1/audio/set_reference') 
      ? ttsServiceUrl 
      : `${ttsServiceUrl.replace(/\/$/, '')}/v1/audio/set_reference`;

    const headers: any = {
      ...formData.getHeaders()
    };
    const ttsApiKey = process.env.TTS_API_KEY;
    if (ttsApiKey) {
      headers['Authorization'] = `Bearer ${ttsApiKey}`;
    }

    const response = await axios.post(apiUrl, formData, {
      headers,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const result = response.data;

    // 清理臨時文件
    try {
      // 刪除原始上傳的檔案
      fs.unlinkSync(audioFile.filepath);
      // 刪除轉換後的 MP3 檔案
      if (fs.existsSync(mp3OutputPath)) {
        fs.unlinkSync(mp3OutputPath);
      }
      console.log('臨時檔案已清理');
    } catch (cleanupError) {
      console.warn('清理臨時文件失敗:', cleanupError);
    }

    res.status(response.status).json(result);

  } catch (error) {
    console.error('語音參考設置錯誤:', error);
    
    // 處理 axios 錯誤
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.message || error.message;
      res.status(status).json({ 
        success: false, 
        message: '外部服務錯誤: ' + message
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: '服務器內部錯誤: ' + (error instanceof Error ? error.message : 'Unknown error')
      });
    }
  }
}
