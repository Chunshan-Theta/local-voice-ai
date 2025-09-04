'use client';

import React, { useState, useEffect } from 'react';
import { AgentConfig, Language } from '../../src/class/types';
import { AgentConfigManager } from '../../src/class/utils/agentConfigManager';
import { validateAgentConfig } from '../../src/class/utils/agentFactory';

interface ConfigFormData {
  name: string;
  publicDescription: string;
  instructions: string;
  voice: string;
  lang: Language;
  criteria: string;
  startAsk: string;
  sttPrompt: string;
}

const VOICE_OPTIONS = [
  { value: 'echo', label: 'Echo (預設)' },
  { value: 'alloy', label: 'Alloy' },
  { value: 'nova', label: 'Nova' },
  { value: 'shimmer', label: 'Shimmer' },
  { value: 'verse', label: 'Verse' },
  { value: 'onyx', label: 'Onyx' }
];

const LANGUAGE_OPTIONS = [
  { value: 'zh' as Language, label: '繁體中文' },
  { value: 'en' as Language, label: 'English' }
];

function AgentConfigPage() {
  const [formData, setFormData] = useState<ConfigFormData>({
    name: '',
    publicDescription: '',
    instructions: '',
    voice: 'echo',
    lang: 'zh',
    criteria: '',
    startAsk: '',
    sttPrompt: ''
  });
  
  const [savedConfigs, setSavedConfigs] = useState<Array<{ id: string; config: AgentConfig }>>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const agentManager = AgentConfigManager.getInstance();

  // 載入已儲存的配置
  useEffect(() => {
    loadSavedConfigs();
  }, []);

  const loadSavedConfigs = () => {
    try {
      const configs = agentManager.getAllConfigs();
      setSavedConfigs(configs);
    } catch (error) {
      console.error('載入配置失敗:', error);
    }
  };

  const handleInputChange = (field: keyof ConfigFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // 清除錯誤訊息
    if (error) setError('');
  };

  const loadExampleConfig = (language: Language) => {
    try {
      const exampleConfig = agentManager.loadExampleConfig(language);
      setFormData({
        name: exampleConfig.name,
        publicDescription: exampleConfig.publicDescription,
        instructions: exampleConfig.instructions,
        voice: exampleConfig.voice || 'echo',
        lang: exampleConfig.lang || 'zh',
        criteria: exampleConfig.criteria || '',
        startAsk: exampleConfig.startAsk || '',
        sttPrompt: exampleConfig.sttPrompt || ''
      });
      setIsEditing(false);
      setSuccess(`已載入 ${language === 'zh' ? '中文' : '英文'} 範例配置`);
    } catch (error) {
      setError('載入範例配置失敗');
    }
  };

  const loadSavedConfig = (configId: string) => {
    const configItem = savedConfigs.find(item => item.id === configId);
    if (configItem) {
      const config = configItem.config;
      setFormData({
        name: config.name,
        publicDescription: config.publicDescription,
        instructions: config.instructions,
        voice: config.voice || 'echo',
        lang: config.lang || 'zh',
        criteria: config.criteria || '',
        startAsk: config.startAsk || '',
        sttPrompt: config.sttPrompt || ''
      });
      setSelectedConfigId(configId);
      setIsEditing(true);
      setSuccess(`已載入配置: ${config.name}`);
    }
  };

  const saveConfig = async () => {
    try {
      // 驗證必填欄位
      if (!formData.name.trim()) {
        setError('請輸入 Agent 名稱');
        return;
      }
      
      if (!formData.instructions.trim()) {
        setError('請輸入 Agent 指令');
        return;
      }

      // 建立配置物件
      const config: AgentConfig = {
        name: formData.name.trim(),
        publicDescription: formData.publicDescription.trim(),
        instructions: formData.instructions.trim(),
        voice: formData.voice,
        lang: formData.lang,
        criteria: formData.criteria.trim(),
        startAsk: formData.startAsk.trim(),
        sttPrompt: formData.sttPrompt.trim(),
        tools: [],
        toolLogic: {}
      };

      // 驗證配置
      if (!validateAgentConfig(config)) {
        setError('配置驗證失敗，請檢查必填欄位');
        return;
      }

      // 生成配置ID
      const configId = isEditing && selectedConfigId ? 
        selectedConfigId : 
        `custom_${Date.now()}`;

      // 儲存配置
      const success = await agentManager.saveConfig(configId, config);
      
      if (success) {
        setSuccess(`配置已儲存: ${config.name}`);
        setSelectedConfigId(configId);
        setIsEditing(true);
        loadSavedConfigs(); // 重新載入配置列表
      } else {
        setError('儲存配置失敗');
      }
    } catch (error) {
      console.error('儲存錯誤:', error);
      setError('儲存時發生錯誤');
    }
  };

  const deleteConfig = async (configId: string) => {
    if (confirm('確定要刪除這個配置嗎？')) {
      try {
        await agentManager.deleteConfig(configId);
        loadSavedConfigs();
        
        if (selectedConfigId === configId) {
          setSelectedConfigId('');
          setIsEditing(false);
          // 清空表單
          setFormData({
            name: '',
            publicDescription: '',
            instructions: '',
            voice: 'echo',
            lang: 'zh',
            criteria: '',
            startAsk: '',
            sttPrompt: ''
          });
        }
        
        setSuccess('配置已刪除');
      } catch (error) {
        setError('刪除配置失敗');
      }
    }
  };

  const newConfig = () => {
    setFormData({
      name: '',
      publicDescription: '',
      instructions: '',
      voice: 'echo',
      lang: 'zh',
      criteria: '',
      startAsk: '',
      sttPrompt: ''
    });
    setSelectedConfigId('');
    setIsEditing(false);
    setError('');
    setSuccess('');
  };

  const exportConfig = () => {
    try {
      const config: AgentConfig = {
        name: formData.name.trim(),
        publicDescription: formData.publicDescription.trim(),
        instructions: formData.instructions.trim(),
        voice: formData.voice,
        lang: formData.lang,
        criteria: formData.criteria.trim(),
        startAsk: formData.startAsk.trim(),
        sttPrompt: formData.sttPrompt.trim(),
        tools: [],
        toolLogic: {}
      };

      const dataStr = JSON.stringify(config, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${config.name || 'agent-config'}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
      setSuccess('配置已匯出');
    } catch (error) {
      setError('匯出失敗');
    }
  };

  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string) as AgentConfig;
        
        if (!validateAgentConfig(config)) {
          setError('無效的配置檔案');
          return;
        }

        setFormData({
          name: config.name,
          publicDescription: config.publicDescription,
          instructions: config.instructions,
          voice: config.voice || 'echo',
          lang: config.lang || 'zh',
          criteria: config.criteria || '',
          startAsk: config.startAsk || '',
          sttPrompt: config.sttPrompt || ''
        });
        
        setIsEditing(false);
        setSelectedConfigId('');
        setSuccess('配置已匯入');
      } catch (error) {
        setError('讀取檔案失敗');
      }
    };
    
    reader.readAsText(file);
    // 清除 input 值，允許重複選擇同一個檔案
    event.target.value = '';
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
      }}>
        {/* 標題列 */}
        <div style={{
          background: 'linear-gradient(90deg, #667eea, #764ba2)',
          color: 'white',
          padding: '24px',
          textAlign: 'center'
        }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>
            🎭 AI Agent 劇本設定
          </h1>
          <p style={{ margin: '8px 0 0 0', opacity: 0.9 }}>
            自定義 AI 角色對話劇本和行為設定
          </p>
        </div>

        <div style={{ display: 'flex', minHeight: '600px' }}>
          {/* 左側：配置列表 */}
          <div style={{
            width: '300px',
            background: '#f8f9fa',
            borderRight: '1px solid #e9ecef',
            padding: '20px'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#495057' }}>
              已儲存的配置
            </h3>
            
            {/* 操作按鈕 */}
            <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={newConfig}
                style={{
                  padding: '8px 12px',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ➕ 新增配置
              </button>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => loadExampleConfig('zh')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  中文範例
                </button>
                <button
                  onClick={() => loadExampleConfig('en')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  英文範例
                </button>
              </div>
              
              <label style={{
                padding: '8px 12px',
                background: '#6c757d',
                color: 'white',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                textAlign: 'center',
                display: 'block'
              }}>
                📁 匯入配置
                <input
                  type="file"
                  accept=".json"
                  onChange={importConfig}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* 配置列表 */}
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {savedConfigs.map(({ id, config }) => (
                <div
                  key={id}
                  style={{
                    padding: '12px',
                    margin: '8px 0',
                    background: selectedConfigId === id ? '#e3f2fd' : 'white',
                    border: selectedConfigId === id ? '2px solid #2196f3' : '1px solid #dee2e6',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                  onClick={() => loadSavedConfig(id)}
                >
                  <div style={{ 
                    fontWeight: 'bold', 
                    marginBottom: '4px',
                    color: '#495057'
                  }}>
                    {config.name}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#6c757d',
                    marginBottom: '8px'
                  }}>
                    {config.lang === 'zh' ? '🇹🇼 中文' : '🇺🇸 英文'} • {config.voice}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await deleteConfig(id);
                        } catch (error) {
                          console.error('刪除配置失敗:', error);
                        }
                      }}
                      style={{
                        padding: '4px 8px',
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      🗑️ 刪除
                    </button>
                  </div>
                </div>
              ))}
              
              {savedConfigs.length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#6c757d',
                  padding: '20px',
                  fontSize: '14px'
                }}>
                  尚無已儲存的配置
                </div>
              )}
            </div>
          </div>

          {/* 右側：配置表單 */}
          <div style={{ flex: 1, padding: '20px' }}>
            {/* 訊息顯示 */}
            {error && (
              <div style={{
                padding: '12px',
                background: '#f8d7da',
                color: '#721c24',
                border: '1px solid #f5c6cb',
                borderRadius: '6px',
                marginBottom: '16px'
              }}>
                ❌ {error}
              </div>
            )}
            
            {success && (
              <div style={{
                padding: '12px',
                background: '#d4edda',
                color: '#155724',
                border: '1px solid #c3e6cb',
                borderRadius: '6px',
                marginBottom: '16px'
              }}>
                ✅ {success}
              </div>
            )}

            {/* 表單 */}
            <div style={{ display: 'grid', gap: '20px' }}>
              {/* 基本資訊 */}
              <div>
                <h4 style={{ marginBottom: '12px', color: '#495057' }}>📝 基本資訊</h4>
                
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
                      Agent 名稱 *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="例如：🗣️ 語音: "
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ced4da',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
                        語言
                      </label>
                      <select
                        value={formData.lang}
                        onChange={(e) => handleInputChange('lang', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '1px solid #ced4da',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                      >
                        {LANGUAGE_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
                        語音
                      </label>
                      <select
                        value={formData.voice}
                        onChange={(e) => handleInputChange('voice', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '1px solid #ced4da',
                          borderRadius: '6px',
                          fontSize: '14px'
                        }}
                      >
                        {VOICE_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
                      公開描述
                    </label>
                    <input
                      type="text"
                      value={formData.publicDescription}
                      onChange={(e) => handleInputChange('publicDescription', e.target.value)}
                      placeholder="簡短描述這個 Agent 的用途"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ced4da',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 劇本設定 */}
              <div>
                <h4 style={{ marginBottom: '12px', color: '#495057' }}>🎭 劇本設定</h4>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
                    Agent 指令 (劇本內容) *
                  </label>
                  <textarea
                    value={formData.instructions}
                    onChange={(e) => handleInputChange('instructions', e.target.value)}
                    placeholder="輸入詳細的角色設定、對話指令和行為規則..."
                    rows={15}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #ced4da',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
                    💡 這裡是 Agent 的核心劇本，定義角色性格、對話風格、限制規則等
                  </div>
                </div>
              </div>

              {/* 進階設定 */}
              <div>
                <h4 style={{ marginBottom: '12px', color: '#495057' }}>⚙️ 進階設定</h4>
                
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
                      評分標準
                    </label>
                    <textarea
                      value={formData.criteria}
                      onChange={(e) => handleInputChange('criteria', e.target.value)}
                      placeholder="設定對話品質的評分標準..."
                      rows={4}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ced4da',
                        borderRadius: '6px',
                        fontSize: '14px',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
                      開場白
                    </label>
                    <input
                      type="text"
                      value={formData.startAsk}
                      onChange={(e) => handleInputChange('startAsk', e.target.value)}
                      placeholder="Agent 的第一句話..."
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ced4da',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
                      語音轉文字提示
                    </label>
                    <input
                      type="text"
                      value={formData.sttPrompt}
                      onChange={(e) => handleInputChange('sttPrompt', e.target.value)}
                      placeholder="語音識別的提示詞..."
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ced4da',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 操作按鈕 */}
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                paddingTop: '20px',
                borderTop: '1px solid #e9ecef'
              }}>
                <button
                  onClick={saveConfig}
                  style={{
                    padding: '12px 24px',
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold'
                  }}
                >
                  💾 {isEditing ? '更新配置' : '儲存配置'}
                </button>
                
                <button
                  onClick={exportConfig}
                  disabled={!formData.name.trim()}
                  style={{
                    padding: '12px 24px',
                    background: formData.name.trim() ? '#28a745' : '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: formData.name.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '16px'
                  }}
                >
                  📤 匯出配置
                </button>
                
                <button
                  onClick={() => window.history.back()}
                  style={{
                    padding: '12px 24px',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  ⬅️ 返回
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentConfigPage;
