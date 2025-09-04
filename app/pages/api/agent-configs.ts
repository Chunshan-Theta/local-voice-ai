import { NextApiRequest, NextApiResponse } from 'next';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_DIR = process.env.CONFIG_DIR || '/app/data/configs';
const CONFIG_FILE = path.join(CONFIG_DIR, 'agent-configs.json');

// 確保配置目錄存在
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    console.log(`✅ 創建配置目錄: ${CONFIG_DIR}`);
  }
}

// 載入配置
function loadConfigs() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ 載入配置文件失敗:', error);
  }
  return { configs: [] };
}

// 保存配置
function saveConfigs(configs: any) {
  try {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ configs }, null, 2), 'utf8');
    console.log(`✅ 配置已保存到: ${CONFIG_FILE}`);
    return true;
  } catch (error) {
    console.error('❌ 保存配置文件失敗:', error);
    return false;
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // 讀取配置
    try {
      const data = loadConfigs();
      res.status(200).json(data);
    } catch (error) {
      console.error('讀取配置失敗:', error);
      res.status(500).json({ error: '讀取配置失敗' });
    }
  } else if (req.method === 'POST') {
    // 保存配置
    try {
      const { configs } = req.body;
      
      if (!configs || !Array.isArray(configs)) {
        return res.status(400).json({ error: '無效的配置格式' });
      }
      
      const success = saveConfigs(configs);
      
      if (success) {
        res.status(200).json({ message: '配置保存成功', count: configs.length });
      } else {
        res.status(500).json({ error: '保存配置失敗' });
      }
    } catch (error) {
      console.error('保存配置失敗:', error);
      res.status(500).json({ error: '保存配置失敗' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
