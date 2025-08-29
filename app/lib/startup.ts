import { ensureModelAvailable } from './ollama';

/**
 * 系統啟動時的初始化檢查
 */
export async function initializeSystem(): Promise<boolean> {
  console.log('🚀 Initializing system...');
  
  try {
    // 檢查並確保 Ollama 模型可用
    const modelAvailable = await ensureModelAvailable();
    
    if (!modelAvailable) {
      console.error('❌ Failed to ensure Ollama model is available');
      return false;
    }
    
    console.log('✅ System initialization completed successfully');
    return true;
  } catch (error) {
    console.error('❌ System initialization failed:', error);
    return false;
  }
}

/**
 * 在系統啟動時呼叫此函數
 * 例如在 Next.js 的 API route 或主要應用程式入口點
 */
export async function startupCheck() {
  const isInitialized = await initializeSystem();
  
  if (!isInitialized) {
    console.warn('⚠️ System initialization failed, some features may not work properly');
  }
  
  return isInitialized;
}
