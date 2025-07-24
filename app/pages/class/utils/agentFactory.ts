import { AgentConfig } from '../types';
import { getDefaultAgentConfig } from '../config/defaultAgentConfigs';

// Simple language type definition
export type Language = 'zh' | 'en';

/**
 * 創建範例 Agent 配置
 * @param lang 語言設定
 * @returns AgentConfig 對象
 */
export function createExampleAgentConfig(lang: Language): AgentConfig {
  // 使用預設配置
  return getDefaultAgentConfig(lang);
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
