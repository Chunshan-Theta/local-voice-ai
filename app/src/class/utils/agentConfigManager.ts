import { AgentConfig, Language } from '../types';
import { createExampleAgentConfig, validateAgentConfig } from './agentFactory';

/**
 * Agent 配置管理器
 * 提供 Agent 配置的載入、儲存、驗證等功能
 */
export class AgentConfigManager {
  private static instance: AgentConfigManager;
  private configs: Map<string, AgentConfig> = new Map();
  private isLoaded: boolean = false;

  private constructor() {
    // 初始化時載入配置
    this.loadConfigs();
  }

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
   * 載入配置 (異步)
   */
  private async loadConfigs(): Promise<void> {
    if (this.isLoaded) return;
    
    try {
      const response = await fetch('/api/agent-configs');
      if (response.ok) {
        const data = await response.json();
        this.configs.clear();
        
        if (data.configs && Array.isArray(data.configs)) {
          data.configs.forEach((item: { id: string; config: AgentConfig }) => {
            this.configs.set(item.id, item.config);
          });
          console.log(`✅ 已從文件載入 ${data.configs.length} 個 Agent 配置`);
        }
      }
    } catch (error) {
      console.log('ℹ️ 首次使用或載入配置時發生錯誤，將使用空配置:', error);
    }
    
    this.isLoaded = true;
  }

  /**
   * 保存配置到文件 (異步)
   */
  private async saveToFile(): Promise<boolean> {
    try {
      const configs = this.getAllConfigs();
      const response = await fetch('/api/agent-configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ configs }),
      });
      
      if (response.ok) {
        console.log('✅ 配置已保存到文件系統');
        return true;
      } else {
        console.error('❌ 保存配置失敗:', await response.text());
        return false;
      }
    } catch (error) {
      console.error('❌ 保存配置時發生錯誤:', error);
      return false;
    }
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
  async saveConfig(id: string, config: AgentConfig): Promise<boolean> {
    if (!validateAgentConfig(config)) {
      console.error('❌ Agent 配置驗證失敗:', config);
      return false;
    }
    
    this.configs.set(id, config);
    console.log(`✅ 已儲存 Agent 配置: ${id}`);
    
    // 自動保存到文件系統
    await this.saveToFile();
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
  async deleteConfig(id: string): Promise<boolean> {
    const result = this.configs.delete(id);
    if (result) {
      await this.saveToFile();
    }
    return result;
  }

  /**
   * 獲取所有配置
   */
  getAllConfigs(): Array<{ id: string; config: AgentConfig }> {
    const result: Array<{ id: string; config: AgentConfig }> = [];
    this.configs.forEach((config, id) => {
      result.push({ id, config });
    });
    return result;
  }

  /**
   * 獲取所有配置（原格式）
   */
  getAllConfigsAsRecord(): Record<string, AgentConfig> {
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
  async importFromJson(json: string): Promise<boolean> {
    try {
      const configs = JSON.parse(json);
      let successCount = 0;
      
      // 使用兼容 ES5 的語法
      const configKeys = Object.keys(configs);
      for (let i = 0; i < configKeys.length; i++) {
        const id = configKeys[i];
        const config = configs[id];
        const success = await this.saveConfig(id, config as AgentConfig);
        if (success) {
          successCount++;
        }
      }
      
      console.log(`✅ 成功匯入 ${successCount} 個 Agent 配置`);
      return successCount > 0;
    } catch (error) {
      console.error('❌ 匯入 Agent 配置失敗:', error);
      return false;
    }
  }
}
