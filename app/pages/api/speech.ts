import type { NextApiRequest, NextApiResponse } from 'next';

interface SpeechRequest {
  input: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { input } = req.body as SpeechRequest;
    if (!input) {
      return res.status(400).json({ error: "No input provided" });
    }
    
    // Replace all punctuation marks with Chinese comma and remove consecutive commas
    const processedInput = input
      .replace(/[.,!?;:、。！？；：]/g, '，')
      .replace(/，+/g, '，');
    
    const ttsServiceUrl = process.env.TTS_SERVICE_URL || 'http://localhost:8000';
    console.log(`🎯 正在調用 TTS 服務: ${ttsServiceUrl}`);
    console.log(`📝 輸入文本: ${processedInput.substring(0, 50)}${processedInput.length > 50 ? '...' : ''}`);

    const ttsApiKey = process.env.TTS_API_KEY || '';
    const response = await fetch(`${ttsServiceUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ttsApiKey}`
      },
      body: JSON.stringify({ 
        input: processedInput,
        format: 'wav',
      }),
    }).catch(error => {
      console.error(`❌ TTS 服務連接錯誤:`, error);
      throw new Error(`無法連接到 TTS 服務: ${error.message}`);
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      console.error(`❌ TTS 服務錯誤響應:`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      
      // 根據狀態碼返回具體錯誤信息
      let errorMessage = 'TTS service error';
      switch (response.status) {
        case 400:
          errorMessage = 'Invalid request to TTS service';
          break;
        case 502:
          errorMessage = 'TTS service is unavailable';
          break;
        case 413:
          errorMessage = 'Text too long for TTS service';
          break;
        default:
          errorMessage = `TTS service error: ${response.status}`;
      }
      
      return res.status(response.status).json({ 
        error: errorMessage,
        details: errorText
      });
    }

    // 检查是否支持流式响应
    const isStreamResponse = response.headers.get('content-type')?.includes('text/event-stream') || 
                            response.headers.get('transfer-encoding') === 'chunked';

    if (isStreamResponse && response.body) {
      // 处理流式响应
      console.log(`🌊 开始流式传输音频数据`);
      
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // 创建可读流并管道到响应
      const reader = response.body.getReader();
      const writableStream = new WritableStream({
        write(chunk) {
          res.write(chunk);
        },
        close() {
          res.end();
        },
        abort(err) {
          console.error('流式传输中断:', err);
          res.end();
        }
      });
      
      try {
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            if (value && value.length > 0) {
              res.write(value);
            }
          }
          res.end();
        };
        
        await pump();
      } catch (error) {
        console.error('流式传输错误:', error);
        res.end();
      }
      
      return;
    }

    // 如果不是流式响应，按原来的方式处理

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('audio/')) {
      console.error(`❌ 無效的響應類型:`, contentType);
      return res.status(500).json({ 
        error: 'Invalid response from TTS service',
        details: `Expected audio/* content type but got ${contentType}`
      });
    }

    const audioBuffer = await response.arrayBuffer();
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      console.error('❌ 收到空的音頻數據');
      return res.status(500).json({ 
        error: 'Empty audio data from TTS service' 
      });
    }

    console.log(`✅ TTS 成功生成音頻，大小: ${audioBuffer.byteLength} bytes`);
    
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', audioBuffer.byteLength);
    res.send(new Uint8Array(audioBuffer));
  } catch (error) {
    console.error('❌ TTS 服務錯誤:', error);
    res.status(500).json({ 
      error: 'Failed to generate speech',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}