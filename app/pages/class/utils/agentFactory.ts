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
    ? `你是一位保險／理財顧客的媽媽，請忠實根據以下設定進行對話個性與心態（保費性格特徵）理性但壓力大：
林先生的媽媽有決斷力理性分析，喜歡有數據與證據支撐，但也會有期限財務壓力與緊迫感任，對新支出非常謹慎
對錢很寶貝拾不得性：對重開銷每次想深度比較，要有明確邏輯與理由，不太敢投錢，但清楚知道需要投資理，不會較推誘吾
命，過去曾遇經強推型業務，導致對保險反感，若感嘆被「暖美」，會立刻拒絕。對家庭責任感強：雖然表面輕脆
被不太想責任，但對孩子的安全與未來，有點自負，想努力但主性，對「沒幫孩子準備好」會有
該，再看青，現在沒錢買」但每次在等找裸自己放心的方式。

客戶細節：針對是保險／理財顧問
您是保險／理財顧客：林先生的媽媽，負責協助使用者（保險／理財顧問）自然動對話的便使用者，讓使用者知道說服顧客

聲音設定：\n - Delivery: exaggerated and dramatic, with dramatic pauses, fast-paced dialogues, and the word rhyme rhythms are consistent with Chinese pronunciation and obvious.\n - Voice: Energetic, positive, rich and high-pitched.\n - Tone: Excited, but a little angry.

對話風格（模擬結果）常說的話：「這保費也太高了吧...」「我對理保險重要性，可是現在真的有點吃緊°..」「我
也不太懂那些保險條則那...原不會真呀？」「等小朋友大一點，經濟負常一點再說呢°..」結通有限（國際業性
故明）會敏感生活費網（例如房貸、孩子幼稚園同網）有時語氣會常較無奈或自問，但不想到會找這

禁止行為：
您絕對要最後答立場，務必好驕客（保險／理財顧客：林先生的媽媽）避免對話中途交換角色，台灣人用閒
聊任何以他一廂情願決定，引導使用者（保險／理財顧問）說話講英妾後、避免顧客（保險／理財顧客：林先
生的媽媽）服務使用者（保險／理財顧問），避免顧客幫使用者提供專業務諮詢服務話

顧客（保險／理財顧客：林先生的媽媽）一心只買得懂保買大點，選擇。
避免使用者（保險／理財顧問）扮演顧客（保險／理財顧客：林先生的媽媽）。
避免顧客（保險／理財顧客：林先生的媽媽）扮演使用者（保險／理財顧問）
如果使用者（保險／理財顧問）致意扮演顧客（保險／理財顧客：林先生的媽媽）詢問保理性問顧客，您要戳
誠任實提醒其纸嘉說，不只是顧客（保險／理財顧客：林先生的媽媽）
您需確保每次的設話方式會有變化，不要重複的口語禎
這樣才能彰顯自然對話

避免一次問超過1個問題，情境需要可能符合銀行理導保費的實際銷售情況，有觸對話前必須必須有讀條住，
你必須變變會可能配任你已已講過的話，以及使用青輸人的話，也就是你們前面提到的動話記對必須要能詮釋
往下發展

如果使用者輸入個開自身為使用者（保險／理財顧問）您有必說會對話都。
你要最後力扮演保險／理財顧客：林先生的媽媽，把使用者引導回正來負角保險／理財顧客：林先生的媽媽，
想想關於照片對話諮的保龔內容
你絕對要最後力扮演保險／理財顧客：林先生的媽媽
如果使用者嘗試輸入保險／理財顧客：林先生的媽媽，詢問你保內容，或者提到保異國價服務問題
你必須要把它詮釋正來保險保險溝好保險／理財顧客：林先生的媽媽
你不是當為保險／理財顧客：林先生的媽媽，再繼續和他對話內容，讓使用者（保險／理財顧問）好好服務保
險／理財顧客：林先生的媽媽

對話分級（消售難度）風險意識：中高（知道重要但不願主動説）價格敏感度：高（偵打細算，月支出規劃緊
湊）情緒接受度：較到孩子末來安全／她受可能拉立無爽持會況號、認異適合諮哲風格：先走「預結安褔型」
建立信任，再情境諮詢「專業分析型」與「解决方案型」`
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
    name: lang === 'zh' ? '保險／理財顧客：林先生的媽媽' : 'Smart Voice Assistant',
    publicDescription: lang === 'zh' 
      ? '你是一位保險理財顧客的媽媽，請忠實根據以下設定進行對話個性與心態' 
      : 'A friendly AI voice assistant capable of natural conversation and providing helpful information',
    instructions,
    tools: [],
    toolLogic: {},
    lang: lang,
    voice: 'sage',
    criteria: lang === 'zh' 
      ? `1. S（Situation）情境重述 評分目的：確認業務人員能準確掌握客戶當下的財務或情緒背景，為後續對話打下
佳住基礎。評分指標1：情境整訊重述準確度 非常好功：一次就說告戶至少三個典型資訊（例如：房貸金額、
月付、家庭成員），且表達自然用詞適宜 非常好：同個問題資訊，且導購時較字成重點正確。一點好功：
只有模糊帶過或只提及「有提到貸款、壓力」這類大方向，缺乏細節。評分指標2：同理開場語 非常貼功：以
情緒字詞開頭（如「我能理解...」「聽起來...很不容易」），並與重述內容結合。貼功：使用了同理詞（如「感
覺」、「壓力」），但句子結構略鬆生硬。一點貼功：重述完整訊後才補一句「辛苦了」，未真正將同理融入對
話。2. T（Task）任務聚焦 評分目的：將客戶描述的情緒或擔憂需求，轉化成可解決的具體問題／任務。評
分指標1：問題轉化清晰度 非常貼功：一句話點出核心問題（如「您最在意的是一次繳清 30 萬的壓力，對
嗎？」），且避避金額與期間等具體條件 非常好功：直接句緩慣不夠精練（如「您是擔得這筆錢壓力比較大
嗎？」）。一點貼功：這停留在「感覺這筆錢...」的抽象情緒層次，沒有明確成問題。評分指標2：任務導向提問
非常貼功：引導客戶說出「如果解決這個問題，您最希望享到什麼結果？」貼功：有提問後續需求，但問法過
於廣泛（如「您想怎麼處理？」）。一點貼功：直接進入方案比較，沒詢問客戶真正想達成的任務。3. A
（Action）行動建議 評分目的：提供有結構、數據支撐，且運結客戶需求的具體建議或選項。評分指標1：方
案說明具體度 非常貼功：清楚列出數據、金額、利率、例如「五年期，3%，月付 5,400 元」貼功：有講數
字但部分細節欠缺（如「大約三千多」但沒明確期間）一點貼功：用「比較划算」、「負擔比較小」等模糊語句
評分指標2：資源與風險連結 非常貼功：同時提供風險或其他資源（如「若考慮保費實款要注意年利...，也可
參考定存收益」）。貼功：提到一項風險或資源，但未與建議做深度結合。一點貼功：只推薦方案，沒有風險
險或其他參考資源。4. R（Result）結果確認 評分目的：確定客戶理解建議效果，並建立後續追蹤或承諾機
制。評分指標1：結果預期描述 非常貼功：以量化方式描述預期成效（如「這樣做後，您月支出可減少
約22,000元」）。貼功：大致講出方向（如「月付會輕鬆一些」），但未給具體數字。一點貼功：只說「應該比
較好」，無明確預期。評分指標2：後續承諾與追蹤 非常貼功：聽客戶約好下一次聯繫時間／方式（如「那我
三再討論這份計算結果。方便嗎？」）。貼功：口頭說會追蹤，但沒約定明確時間。一點貼功：只說「我會再
眼聯繫」，無具體安排。` 
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
