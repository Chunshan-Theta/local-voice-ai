#!/usr/bin/env npx ts-node

/**
 * 系統啟動腳本
 * 在應用程序啟動時檢查 Ollama 模型是否可用
 */

import { ensureModelAvailable } from '../lib/ollama';

declare const require: any;
declare const module: any;
declare const process: any;

async function startup() {
  console.log('🚀 Starting system initialization...');
  
  try {
    console.log('📦 Checking Ollama model availability...');
    const modelAvailable = await ensureModelAvailable();
    
    if (modelAvailable) {
      console.log('✅ Ollama model is ready!');
    } else {
      console.log('❌ Ollama model is not available. Please check your Ollama service.');
      process.exit(1);
    }
    
    console.log('🎉 System initialization completed successfully!');
    
  } catch (error) {
    console.error('💥 System initialization failed:', error);
    process.exit(1);
  }
}

// 只在直接執行此腳本時運行
if (require.main === module) {
  startup();
}

export { startup };
