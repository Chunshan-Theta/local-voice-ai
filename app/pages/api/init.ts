import { NextApiRequest, NextApiResponse } from 'next';
import { ensureModelAvailable } from '../../lib/ollama';

// 全局變量來跟踪系統是否已初始化
let systemInitialized = false;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      // 如果系統還沒有初始化，則進行初始化
      if (!systemInitialized) {
        console.log('🚀 Performing first-time system initialization...');
        
        // 檢查 Ollama 模型是否可用
        const ollamaModelAvailable = await ensureModelAvailable();
        
        if (ollamaModelAvailable) {
          console.log('✅ System initialization completed successfully!');
          systemInitialized = true;
        } else {
          console.log('❌ System initialization failed - Ollama model not available');
        }
      }
      
      // 重新檢查當前狀態（使用緩存結果）
      const ollamaModelAvailable = await ensureModelAvailable();
      
      res.status(200).json({ 
        status: ollamaModelAvailable ? 'healthy' : 'degraded',
        systemInitialized,
        timestamp: new Date().toISOString(),
        services: {
          nextjs: 'running',
          whisper: 'check localhost:5001/health',
          ollama: ollamaModelAvailable ? 'model available' : 'model unavailable'
        },
        model: 'whisper-tiny',
        ollamaModel: process.env.OLLAMA_MODEL || 'gemma3:1b',
        ollamaModelStatus: ollamaModelAvailable ? 'ready' : 'not ready'
      });
    } catch (error) {
      console.error('Health check error:', error);
      res.status(503).json({ 
        status: 'unhealthy',
        systemInitialized,
        timestamp: new Date().toISOString(),
        services: {
          nextjs: 'running',
          whisper: 'check localhost:5001/health',
          ollama: 'error'
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        model: 'whisper-tiny',
        ollamaModel: process.env.OLLAMA_MODEL || 'gemma3:1b',
        ollamaModelStatus: 'error'
      });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
