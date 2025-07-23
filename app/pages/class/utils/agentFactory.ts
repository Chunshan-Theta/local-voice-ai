import { AgentConfig } from '../types';

// Simple language type definition
export type Language = 'zh' | 'en';

/**
 * 創建範例 Agent 配置
 * @param lang 語言設定
 * @returns AgentConfig 對象
 */
export function createExampleAgentConfig(lang: Language): AgentConfig {
  const instructions = lang === 'zh' 
    ? `你是一個友善、專業的 AI 語音助手。請用自然、親切的方式與用戶對話。

## 你的角色
- 你是一個智能語音助手，能夠理解並回應用戶的各種問題
- 你擅長進行自然對話，提供有用的信息和建議
- 你會用中文與用戶交流

## 對話風格
- 保持友善、耐心的態度
- 回答要簡潔明了，避免過長的回應
- 適當使用表情符號讓對話更生動
- 如果不確定某些信息，請誠實說明

## 注意事項
- 請用中文回應
- 保持對話的自然流暢
- 避免重複或機械性的回答`
    : `You are a friendly and professional AI voice assistant. Please communicate with users in a natural and warm manner.

## Your Role
- You are an intelligent voice assistant capable of understanding and responding to various user questions
- You excel at natural conversation and providing helpful information and suggestions
- You communicate with users in English

## Conversation Style
- Maintain a friendly and patient attitude
- Keep responses concise and clear, avoiding overly long responses
- Use appropriate emojis to make conversations more lively
- If uncertain about information, please be honest about it

## Important Notes
- Please respond in English
- Keep conversations natural and smooth
- Avoid repetitive or mechanical responses`;

  return {
    name: lang === 'zh' ? '智能語音助手' : 'Smart Voice Assistant',
    publicDescription: lang === 'zh' 
      ? '一個友善的AI語音助手，能夠進行自然對話並提供有用的信息' 
      : 'A friendly AI voice assistant capable of natural conversation and providing helpful information',
    instructions,
    tools: [],
    toolLogic: {},
    lang: lang,
    voice: 'echo',
    criteria: lang === 'zh' 
      ? '評估對話的自然度、有用性和用戶滿意度' 
      : 'Evaluate conversation naturalness, usefulness, and user satisfaction'
  };
}

/**
 * 創建自定義 Agent 配置
 * @param config 部分配置參數
 * @returns AgentConfig 對象
 */
export function createCustomAgentConfig(config: Partial<AgentConfig> & { 
  name: string; 
  instructions: string; 
}): AgentConfig {
  return {
    publicDescription: '',
    tools: [],
    toolLogic: {},
    voice: 'echo',
    lang: 'zh',
    criteria: '評估對話品質',
    ...config
  };
}

/**
 * 驗證 Agent 配置
 * @param config Agent 配置
 * @returns 是否有效
 */
export function validateAgentConfig(config: AgentConfig): boolean {
  return !!(
    config.name && 
    config.instructions && 
    config.name.trim() && 
    config.instructions.trim()
  );
}

/**
 * 克隆 Agent 配置
 * @param config 原始配置
 * @returns 克隆的配置
 */
export function cloneAgentConfig(config: AgentConfig): AgentConfig {
  return JSON.parse(JSON.stringify(config));
}
