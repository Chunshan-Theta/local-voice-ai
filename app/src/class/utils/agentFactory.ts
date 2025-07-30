import { AgentConfig } from '../types';
import { getDefaultAgentConfig } from '../config/';

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

// Additional imports needed for the functions below
import { Tool, TranscriptItem } from '../types/basic';

async function translateToLanguage(text: string, targetLang: Language): Promise<string> {
  // Only use cache in browser environment
  const isBrowser = typeof window !== 'undefined';
  // Generate a cache key based on text and target language
  const cacheKey = `translation_${targetLang}_${encodeURIComponent(text)}`;

  // Check cache first only in browser
  if (isBrowser) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        targetLang,
      }),
    });

    if (!response.ok) {
      throw new Error('Translation failed');
    }

    const result = await response.json();
    // Cache the result only in browser
    if (isBrowser) {
      localStorage.setItem(cacheKey, result.translatedText);
    }
    return result.translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Fallback to original text if translation fails
  }
}

export async function createAgentConfig(apiResult: any, lang: Language): Promise<AgentConfig> {
  // Convert tools to full Tool objects and build toolLogic
  const toolConfig = handleApiTools(apiResult.tools)

  const promptName = apiResult.prompt_name;
  const promptPersonas = apiResult.prompt_personas;
  const promptCustomers = apiResult.prompt_customers;
  const promptToolLogics = apiResult.prompt_tool_logics;
  const promptVoiceStyles = apiResult.prompt_voice_styles;
  const promptConversationModes = apiResult.prompt_conversation_modes;
  const promptProhibitedPhrases = apiResult.prompt_prohibited_phrases;

  let instructions = `
  Now, please play the role of ${promptName}, here are your role and more details:
  ## Your Role: ${promptName}
  ${promptPersonas}
  ## Your Conversation Partner
  ${promptCustomers}
  ## Your Tool Usage Rules and Instructions
  ${promptToolLogics}
  ## Your Voice Style
  ${promptVoiceStyles}
  ## Your Conversation Mode
  ${promptConversationModes}
  ## Your Prohibited Phrases
  ${promptProhibitedPhrases}

  !Note: You will speak in ${lang} language, please respond in ${lang} language.
  `;
  console.log('instructions source', instructions);

  instructions = await translateToLanguage(instructions, lang);
  console.log('instructions translated', instructions);

  return {
    ...apiResult,
    name: apiResult.name,
    publicDescription: apiResult.public_description,
    instructions,
    tools: toolConfig.tools,
    toolLogic: toolConfig.toolLogic,
    lang: lang || "zh",
  };
}

export async function fetchAgentConfig(id: string): Promise<AgentConfig[]> {
  const response = await fetch(`/api/agents/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error('Agent not found');
  }
  const data = await response.json();
  return data.agent;
};

/**
 * 處理 api 回傳的 tools data
 * @param tools 
 * @returns 
 */
export function handleApiTools(tools: any[]) {
  if(!Array.isArray(tools)) {
    throw new Error('Tools must be an array');
  }

  const toolLogic: Record<string, (args: any, transcriptLogsFiltered: TranscriptItem[]) => Promise<any> | any> = {};
  const pTools:Tool[] = tools.map((tool: any) => {
    // Add tool logic
    toolLogic[tool.name] = async ({ question }) => {
      console.info(`Tool ${tool.name} called:`, question);
      try {
        const response = await fetch(`/api/tools/${tool.tool_id}/use`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question })
        });
        if (!response.ok) throw new Error(`${tool.name} API request failed`);
        const data = await response.json();
        console.info(`${tool.name} results:`, data);
        return data;
      } catch (error) {
        console.error(`${tool.name} error:`, error);
        return { success: false, error: `Error communicating with ${tool.name} service` };
      }
    };

    return {
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "User question or query"
          }
        },
        required: ["question"]
      }
    };
  });

  return {
    tools: pTools,
    toolLogic
  };
}
