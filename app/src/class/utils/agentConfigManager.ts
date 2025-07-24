import { AgentConfig } from '../types';
import { createExampleAgentConfig, validateAgentConfig, type Language } from './agentFactory';

/**
 * Agent 配置管理器
 * 提供 Agent 配置的載入、儲存、驗證等功能
 */
export class AgentConfigManager {
  private static instance: AgentConfigManager;
  private configs: Map<string, AgentConfig> = new Map();

  private constructor() {}

  /**
   * 獲取單例實例
   */
  static getInstance(): AgentConfigManager {
    if (!AgentConfigManager.instance) {
      AgentConfigManager.instance = new AgentConfigManager();
    }
    return AgentConfigManager.instance;
  }

  /**
   * 載入範例配置
   * @param language 語言設定
   * @returns Agent 配置
   */
  loadExampleConfig(language: Language): AgentConfig {
    const configKey = `example_${language}`;
    
    if (!this.configs.has(configKey)) {
      const config = createExampleAgentConfig(language);
      this.configs.set(configKey, config);
      console.log(`✅ 已載入 ${language} 範例 Agent 配置:`, config.name);
    }
    
    return this.configs.get(configKey)!;
  }

  /**
   * 儲存配置
   * @param id 配置 ID
   * @param config Agent 配置
   */
  saveConfig(id: string, config: AgentConfig): boolean {
    if (!validateAgentConfig(config)) {
      console.error('❌ Agent 配置驗證失敗:', config);
      return false;
    }
    
    this.configs.set(id, config);
    console.log(`✅ 已儲存 Agent 配置: ${id}`);
    return true;
  }

  /**
   * 獲取配置
   * @param id 配置 ID
   * @returns Agent 配置
   */
  getConfig(id: string): AgentConfig | null {
    return this.configs.get(id) || null;
  }

  /**
   * 刪除配置
   * @param id 配置 ID
   */
  deleteConfig(id: string): boolean {
    return this.configs.delete(id);
  }

  /**
   * 獲取所有配置
   */
  getAllConfigs(): Record<string, AgentConfig> {
    const result: Record<string, AgentConfig> = {};
    this.configs.forEach((config, id) => {
      result[id] = config;
    });
    return result;
  }

  /**
   * 清除所有配置
   */
  clearAll(): void {
    this.configs.clear();
    console.log('🗑️ 已清除所有 Agent 配置');
  }

  /**
   * 匯出配置到 JSON
   */
  exportToJson(): string {
    const configs = this.getAllConfigs();
    return JSON.stringify(configs, null, 2);
  }

  /**
   * 從 JSON 匯入配置
   * @param json JSON 字串
   */
  importFromJson(json: string): boolean {
    try {
      const configs = JSON.parse(json);
      let successCount = 0;
      
      Object.entries(configs).forEach(([id, config]) => {
        if (this.saveConfig(id, config as AgentConfig)) {
          successCount++;
        }
      });
      
      console.log(`✅ 成功匯入 ${successCount} 個 Agent 配置`);
      return successCount > 0;
    } catch (error) {
      console.error('❌ 匯入 Agent 配置失敗:', error);
      return false;
    }
  }
}
