import type { NextApiRequest, NextApiResponse } from 'next';

interface StreamSpeechRequest {
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
    const { input } = req.body as StreamSpeechRequest;
    if (!input) {
      return res.status(400).json({ error: "No input provided" });
    }
    
    // Replace all punctuation marks with Chinese comma and remove consecutive commas
    const processedInput = input
      .replace(/[.,!?;:、。！？；：]/g, '，')
      .replace(/，+/g, '，');
    
    const ttsServiceUrl = process.env.TTS_SERVICE_URL || 'http://localhost:8000';
    console.log(`🌊 正在調用流式 TTS 服務: ${ttsServiceUrl}`);
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
        response_format: 'wav',
        stream: true
      }),
    }).catch(error => {
      console.error(`❌ TTS 流式服務連接錯誤:`, error);
      throw new Error(`無法連接到 TTS 服務: ${error.message}`);
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      console.error(`❌ TTS 流式服務錯誤響應:`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      
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

    // 设置流式响应头
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    console.log('🌊 开始流式传输音频数据');

    if (!response.body) {
      throw new Error('No response body from TTS service');
    }

    // 流式传输音频数据
    const reader = response.body.getReader();
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log(`✅ 流式传输完成，总计: ${totalBytes} bytes`);
          break;
        }

        if (value && value.length > 0) {
          totalBytes += value.length;
          res.write(value);
          
          // 可选：添加小延迟以模拟更真实的流式体验
          // await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      res.end();
      
    } catch (error) {
      console.error('❌ 流式传输错误:', error);
      res.end();
    }

  } catch (error) {
    console.error('❌ 流式 TTS 服務錯誤:', error);
    res.status(500).json({ 
      error: 'Failed to generate streaming speech',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
