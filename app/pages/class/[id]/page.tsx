'use client';

import React, { Suspense, useState, useEffect, useRef, useMemo, ChangeEvent } from "react";
import { TranscriptProvider } from "@/app/contexts/TranscriptContext";
import { EventProvider } from "@/app/contexts/EventContext";
import { ChatProvider } from "@/app/contexts/ChatContext";
import App, { AppRef } from "./App";
import { useParams } from "next/navigation";
import { AgentConfig, Tool, TranscriptItem } from "@/app/types";
import { AppProvider } from "@/app/contexts/AppContext";
import { useAiChat } from "@/app/lib/ai-chat/aiChat";
import ChatView from "@/app/components/chat/ChatView";
import { getTranslation, Language } from "@/app/i18n/translations";
import LanguageToggle from "@/app/components/LanguageToggle";
import _, { get } from 'lodash'
import { startAIMission } from '@/app/lib/ai-mission/missionAnalysis'
import { LogService } from '@/app/lib/log-service';

import { agentApi, convApi } from '@/app/lib/ai-chat'
import useAgentSettings from "@/app/hooks/useAgentSettings";
import type { TimelineData } from "@/app/types/ai-report/report-v1";

import * as utils from '../utils'
import { createAgentConfig } from '../utils'
import { delay } from "@/app/lib/utils";

type TimelineItem = TimelineData
interface UserInfo {
  email: string;
  uname: string;
}

function ClassChatPage() {
  const [chatBackground] = useState("#173944");
  const params = useParams();
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageBackground] = useState("linear-gradient(135deg, rgb(26, 42, 52) 0%, rgb(46, 74, 63) 100%)");
  const [localLoading, setLocalLoading] = useState(false);
  const [clientLanguage, setClientLanguage] = useState<Language>();
  const [userInfo, setUserInfo] = useState<UserInfo>({ email: '', uname: '' });
  const [isUserInfoValid, setIsUserInfoValid] = useState(false);

  const agentId = params.id as string;

  const logService = useMemo(() => LogService.getInstance(), []);

  useEffect(() => {
    const lang = localStorage.getItem('client-language') as Language

    if (lang) {
      setClientLanguage(lang);
      setLanguage(lang);
    } else {
      setClientLanguage('zh');
      setLanguage('zh');
    }
  }, [])

  // Helper function to add user info to metadata
  const logWithUser = async (
    step: string,
    category: string,
    metadata: Record<string, any>,
    data: Record<string, any>,
    isError: boolean,
    errorMessage: string,
    statusCode: number,
    traceId: string
  ) => {
    const metadataWithUser = {
      ...metadata,
      email: userInfo.email,
      uname: userInfo.uname,
      agentId: agentId,
    };
    return logService.logStep(
      step,
      category,
      metadataWithUser,
      data,
      isError,
      errorMessage,
      statusCode,
      traceId
    );
  };

  useEffect(() => {
    if (!clientLanguage) {
      console.warn('clientLanguage is not set');
      return;
    }

    const fetchAgentConfig = async () => {
      try {
        await logWithUser(
          'fetch_agent_config_start',
          'agent',
          {},
          {},
          false,
          '',
          200,
          'fetch-agent-config'
        );
        const response = await fetch(`/api/agents/${params.id}`);
        if (!response.ok) {
          throw new Error(getTranslation(clientLanguage, 'errors.failed_to_load'));
        }
        const data = await response.json();
        const agentConfig = await createAgentConfig(data.agent, clientLanguage);
        setAgentConfig(agentConfig);
        await logWithUser(
          'fetch_agent_config_success',
          'agent',
          {},
          { agent: data.agent },
          false,
          '',
          200,
          'fetch-agent-config'
        );
      } catch (err) {
        const error = err instanceof Error ? err.message : getTranslation(clientLanguage, 'errors.failed_to_load');
        setError(error);
        await logWithUser(
          'fetch_agent_config_error',
          'agent',
          {},
          {},
          true,
          error,
          500,
          'fetch-agent-config'
        );
      }
    };

    fetchAgentConfig();
  }, [params.id, clientLanguage]);

  const aiReport = useAgentSettings(agentId || '');

  const {
    router,
    initConv,
    inputText,
    clearHistory,

    updateInputText,
    sendSimulatedUserMessage,
    handleMicrophoneClick,
    isPTTUserSpeaking,
    canInterrupt,
    transcriptItems,
    setIsAnalyzing,
    setIsCallEnded,

    handleTalkOn,
    handleTalkOff,

    isCallEnded,
    isAnalyzing,
    setAnalysisProgress,
    appRef,
    progressTimerRef,

    setupAnalysisState,
    endConversation,
    
    getChatHistoryText,
    getChatHistory,
    isLoading,
    onSessionOpen,
    onSessionResume,
    onSessionClose,
    clearTranscript,
    setLanguage,
    getMessagePairs,

    showSystemToast,
    convInfo,
    waitPostTask
  } = useAiChat();


  const loading = useMemo(() => {
    return localLoading || isLoading || isAnalyzing;
  }, [localLoading, isLoading, isAnalyzing]);


  const onSubmitText = () => {
    sendSimulatedUserMessage(inputText, { hide: false, triggerResponse: true });
    updateInputText('');
  }

  const nowConvId = useMemo(() => {
    return convInfo.current?.convId || '';
  }, [convInfo.current?.convId]);


  const analyzeChatHistoryByRubric = async (criteria: string | undefined, role: string, chatHistory: string, clientLanguage: Language) => {
    if (!criteria) {
      criteria = '使用者本身是否是進行良性的溝通';
    }

    criteria += [
      '',
      `另外，要分析的對象是對話紀錄中的"${role}"，需要針對這個角色的表現進行分析，而不是其他人。`
    ].join('\n');

    const weights = [0.5, 0.5, 0.5, 0.5];

    const response = await fetch('/api/analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: chatHistory,
        rubric: {
          criteria,
          weights,
        },
        detectedLanguage: clientLanguage,
      }),
    });

    return response.json();
  }


  const handleAnalyzeChatHistory = async () => {
    if (transcriptItems.length === 0) {
      alert("No chat history available to analyze");
      return;
    }
    if (!canInterrupt) {
      showSystemToast('wait_for_response');
      return;
    }

    await logWithUser(
      'analysis_start',
      'analysis',
      { convId: convInfo.current?.convId },
      { transcriptLength: transcriptItems.length },
      false,
      '',
      200,
      'analysis-start'
    );
    
    setupAnalysisState(0);
    await handleTalkOff();
    await delay(700);
    await waitPostTask();
    await delay(700);
    endConversation();

    await aiReport.waitReady(10000);

    progressTimerRef.current = setInterval(() => {
      setAnalysisProgress(prev => {
        if (prev < 95) {
          return prev + 0.3;
        }
        return prev;
      });
    }, 300);

    try {
      setAnalysisProgress(10);
      const config = {
        criteria: aiReport.getSetting('reportAnalyze.criteria') || agentConfig?.criteria || 'user 本身是否是進行良性的溝通',
        context: aiReport.getSetting('reportAnalyze.context') || '以下是一份 user 和 assistant 的對話紀錄。',
        analysis: aiReport.getSetting('reportAnalyze.analysis') || '請判斷 user 的表現，然後給予合適的分析結果',
        roleSelf: aiReport.getSetting('reportAnalyze.roleSelf') || 'user',
        roleTarget: aiReport.getSetting('reportAnalyze.roleTarget') || 'assistant',

        contextPrompt: aiReport.getSetting('reportAnalyze.contextPrompt'),
        keyPointsPrompt: aiReport.getSetting('reportAnalyze.keyPointsPrompt'),

        keyPointAnalysis1: aiReport.getSetting('reportAnalyze.keyPointAnalysis1') || '分析 __role__ 表現良好的部分，並列出具體的例子或關鍵句（請列出實際原句）',
        keyPointTitle1: aiReport.getSetting('reportAnalyze.keyPointTitle1') || '優點',
        keyPointIcon1: aiReport.getSetting('reportAnalyze.keyPointIcon1') || '⭕',
        keyPointTitle2: aiReport.getSetting('reportAnalyze.keyPointTitle2') || '缺點',
        keyPointAnalysis2: aiReport.getSetting('reportAnalyze.keyPointAnalysis2') || '分析 __role__ 表現不佳的部分，並列出可能存在的溝通問題或不足之處（請列出實際原句）',
        keyPointIcon2: aiReport.getSetting('reportAnalyze.keyPointIcon2') || '❌',
      }

      await logWithUser(
        'analysis_config_ready',
        'analysis',
        { convId: convInfo.current?.convId, agentId: agentId ,userInfo},
        { config },
        false,
        '',
        200,
        'analysis-config'
      );

      const chatHistory = getChatHistoryText({
        roleMap: {
          user: config.roleSelf,
          assistant: config.roleTarget,
        }
      });

      const rubtic_analysis = analyzeChatHistoryByRubric(
        agentConfig?.criteria || config.criteria, 
        config.roleSelf, 
        chatHistory, 
        clientLanguage || 'zh'
      ).then((analysis) => {
        localStorage.setItem('analyzeChatHistoryByRubric', JSON.stringify(analysis));
        logWithUser(
          'rubric_analysis_complete',
          'analysis',
          { convId: convInfo.current?.convId },
          { analysis },
          false,
          '',
          200,
          'rubric-analysis'
        );
      });

      const baseProgress = 30;
      setAnalysisProgress(baseProgress);

      const { startAt, pairs } = getMessagePairs({
        spRole: 'assistant',
        keepSystemMessage: false,
        keepNextMsgCount: 1,
      });

      // Initialize timelineItems
      const timelineItems = pairs.map((item) => {
        const aiMsg = item.messages[0]
        const userMsgs = item.messages.slice(1).filter((msg) => msg.role === 'user')

        const aiRole = 'assistant'
        const userRole = 'user'
        const aiSay = aiMsg.data.content || ''
        const userSay = userMsgs.map((msg) => msg.data.content).join('\n\n')
        console.log({
          aiMsg, userMsgs
        })

        const timeStr = parseTime(item.time - (startAt || 0))

        return {
          mainColor: '#ffd166',
          title: `🕒 ${timeStr}`,
          subtitleColor: '#ffd166',
          subtitle: '情緒：......',
          aiAudio: {
            ref: aiMsg.data.audioRef || null,
            // url: null, 後續非同步填入
            startTime: aiMsg.data.audioStartTime || 0
          },
          userAudio: {
            ref: userMsgs[0]?.data?.audioRef || null,
            // url: null, 後續非同步填入
            startTime: userMsgs[0]?.data?.audioStartTime || 0
          },
          aiRole,
          userRole,
          aiSay,
          userSay,
          analysis: [] as string[],
          keyPoint: {
            sentences: [] as string[],
            problems: [] as string[]
          },
          time: item.time - (startAt || 0)
        } as TimelineItem
      }).filter((item) => {
        return item.aiSay && item.userSay
      });

      if (timelineItems.length < 1) {
        throw new Error('No timeline items found');
      }

      const settingsMap = {
        default: {
          sentimentColors: {
            netural: '#fff',
            angry: '#EF8354',
            frustrated: '#FFD166',
            open: '#06D6A0',
          }
        }
      }

      const history = chatHistory
      /**
       * 針對不同任務給不同參數
       */
      const missionParams: { [missionId: string]: { [x: string]: any } } = {
        'report-v1/sentiment': {
          role2: config.roleTarget,
          history
        },
        'report-v1/key_points': {
          analysis: config.analysis,
          context: config.context,
          criteria: config.criteria,
          role: config.roleSelf,
          role2: config.roleTarget,
          prompt: config.keyPointsPrompt,

          history
        },
        'report-v1/key_points_v2': {
          analysis1: config.keyPointAnalysis1,
          analysis2: config.keyPointAnalysis2,
          title1: config.keyPointTitle1,
          title2: config.keyPointTitle2,
          context: config.context,
          criteria: config.criteria,
          role: config.roleSelf,
          role2: config.roleTarget,
          prompt: config.keyPointsPrompt,

          history
        },
        'report-v1/context': {
          analysis: config.analysis,
          context: config.context,
          criteria: config.criteria,
          role: config.roleSelf,
          prompt: config.contextPrompt,

          history
        },
      }

      for (let index = 0; index < timelineItems.length; index += 1) {
        const item = timelineItems[index]
        const { aiSay, userSay } = item

        const chatHistory = [
          `${config.roleTarget}: ${parseHistoryContent(aiSay)}`,
          `${config.roleSelf}: ${userSay}`
        ].join('\n')

        const missions = [
          'report-v1/sentiment',
          'report-v1/key_points',
          'report-v1/context'
        ]

        const { userAudio, aiAudio } = item
        if (userAudio && userAudio.ref) {
          userAudio.url = (await convApi.getAudioUrlByRefString(userAudio.ref, { convId: nowConvId, name: 'user_audio' })) || '';
          userAudio.audioInfo = (await convApi.getAudioInfoByRefString(userAudio.ref, { convId: nowConvId, name: 'user_audio' })) || ''
          console.log('audioInfo', userAudio.audioInfo)
        }
        if (aiAudio && aiAudio.ref) {
          aiAudio.url = (await convApi.getAudioUrlByRefString(aiAudio.ref, { convId: nowConvId, name: 'assistant_audio' })) || '';
        }

        const collect = {
          done: 0,
          error: 0,
          get end() { return collect.done + collect.error },
          total: missions.length
        }
        const updateProgress = () => {
          const range = (100 - baseProgress - 10) / 100 // 假設 baseProgress 是 30 => 範圍是 0.6
          setAnalysisProgress(baseProgress + (collect.end / collect.total) * 100 * range / (timelineItems.length || 1)) // 0 ~ 60%
        }

        const promises = missions.map((missionId) => {
          if (!missionParams[missionId]) {
            throw new Error(`Mission parameters for ${missionId} are not defined`);
          }
          const mParams = {
            lang: clientLanguage,
            history: chatHistory,
            ...missionParams[missionId],
          }
          return startAIMission({
            missionId,
            params: mParams,
            responseType: 'json_schema'
          }).then((res) => {
            collect.done++
            updateProgress()
            return res
          }).catch((err) => {
            collect.error++
            console.error('Error in analyze:', err)
            updateProgress()
            return null
          })
        })

        const results = await Promise.all(promises)
        const resMap = _.keyBy(results, 'missionId')

        if (resMap['report-v1/sentiment']) {
          const sentimentRes = resMap['report-v1/sentiment']
          const sentimentType = (sentimentRes.json.sentiment || '').toLowerCase()
          if (sentimentType) {
            item.subtitle = `情緒：${sentimentType}`
            type SentimentColor = keyof typeof settingsMap.default.sentimentColors
            item.mainColor = settingsMap.default.sentimentColors[sentimentType as SentimentColor]
          }
        }
        if (resMap['report-v1/key_points']) {
          const keyPointsRes = resMap['report-v1/key_points']
          const keyPoints = keyPointsRes.json.keyPoints
          if (typeof keyPoints === 'object') {
            const { problems, sentences } = keyPoints
            if (Array.isArray(problems)) {
              item.keyPoint!.problems = problems as string[]
            }
            if (Array.isArray(sentences)) {
              item.keyPoint!.sentences = sentences as string[]
            }
          }
        }
        if (resMap['report-v1/key_points_v2']) {
          const keyPointsRes = resMap['report-v1/key_points_v2']
          const keyPoints = keyPointsRes.json.keyPoints
          if (typeof keyPoints === 'object') {
            const { list1, list2 } = keyPoints
            if (Array.isArray(list1)) {
              item.keyPoint!.sentences = list1 as string[]
            }
            if (Array.isArray(list2)) {
              item.keyPoint!.problems = list2 as string[]
            }
          }
        }
        if (resMap['report-v1/context']) {
          const contextRes = resMap['report-v1/context']
          const context = contextRes.json.sentences
          if (Array.isArray(context)) {
            item.analysis = context as string[]
          }
        }
      }

      setAnalysisProgress(90);
      await delay(600); // 等待一秒，確保進度條更新

      const report = {
        timeline: timelineItems,
        meta: {
          keyPointTitle1: config.keyPointTitle1,
          keyPointIcon1: config.keyPointIcon1,
          keyPointTitle2: config.keyPointTitle2,
          keyPointIcon2: config.keyPointIcon2,
        }
      }

      // Store the analysis result and chat history in localStorage
      localStorage.setItem('report', JSON.stringify(report));
      localStorage.setItem('chatHistory', getChatHistoryText());
      localStorage.setItem('chatMessages', JSON.stringify(getChatHistory()));

      setAnalysisProgress(100);
      await logWithUser(
        'analysis_complete',
        'analysis',
        { convId: convInfo.current?.convId, agentId: agentId },
        { timelineItemsCount: timelineItems.length },
        false,
        '',
        200,
        'analysis-complete'
      );

      await Promise.all([rubtic_analysis]);
      router.push('/class/report');
    } catch (error) {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      console.error('Error analyzing conversation:', error);
      alert('Failed to analyze conversation. Please try again.');
      setIsAnalyzing(false);
      await logWithUser(
        'analysis_error',
        'analysis',
        { convId: convInfo.current?.convId, agentId: agentId },
        {},
        true,
        error instanceof Error ? error.message : 'Unknown error',
        500,
        'analysis-error'
      );
    }
  };

  function parseTime(time: number) {
    const timeSec = Math.floor(time / 1000)
    const timeMin = Math.floor(timeSec / 60)
    const min = `${timeMin}`
    const sec = `${timeSec % 60}`
    return `${min.padStart(2, '0')}:${sec.padStart(2, '0')}`
  }

  function parseHistoryContent(content: string | undefined | null) {
    if (content == null) return ''
    const mContent = (content || '').trim().replace(/\n/g, ' ')
    return `"${mContent}"`
  }

  const startConversation = async () => {
    if (!userInfo.email || !userInfo.uname || !agentConfig) return;
    setIsUserInfoValid(true);

    try {
      await logWithUser(
        'conversation_start',
        'conversation',
        { },
        { email: userInfo.email, uname: userInfo.uname },
        false,
        '',
        200,
        'conversation-start'
      );
      clearHistory();
      await initConv({
        email: userInfo.email,
        uname: userInfo.uname,
        agentType: 'class',
        agentId: agentId
      });
      handleTalkOn();
    } catch (err) {
      console.error('Error initializing conversation:', err);
      const error = getTranslation(clientLanguage || 'zh', 'errors.failed_to_load');
      setError(error);
      await logWithUser(
        'conversation_start_error',
        'conversation',
        {  },
        { email: userInfo.email, uname: userInfo.uname },
        true,
        error,
        500,
        'conversation-start'
      );
    }
  };

  if (error || !agentConfig) {
    return <div>{error || getTranslation(clientLanguage || 'zh', 'info.try_to_load_agent')}</div>;
  }

  if (!isUserInfoValid) {
    return (
      <div style={{
        background: pageBackground,
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '2rem',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '400px',
          margin: '1rem'
        }}>
          <h2 style={{ color: 'white', marginBottom: '1.5rem', textAlign: 'center' }}>
            {getTranslation(clientLanguage || 'zh', 'info.please_enter_info')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input
              type="email"
              placeholder={getTranslation(clientLanguage || 'zh', 'info.email')}
              value={userInfo.email}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setUserInfo(prev => ({
                  ...prev,
                  email: e.target.value
                }));
              }}
              style={{
                padding: '0.75rem',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'white'
              }}
            />
            <input
              type="text"
              placeholder={getTranslation(clientLanguage || 'zh', 'info.username')}
              value={userInfo.uname}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setUserInfo(prev => ({
                  ...prev,
                  uname: e.target.value
                }));
              }}
              style={{
                padding: '0.75rem',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'white'
              }}
            />
            <button
              onClick={() => startConversation()}
              disabled={!userInfo.email || !userInfo.uname}
              style={{
                padding: '0.75rem',
                borderRadius: '4px',
                background: '#06D6A0',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                marginTop: '1rem',
                opacity: !userInfo.email || !userInfo.uname ? 0.5 : 1
              }}
            >
              {getTranslation(clientLanguage || 'zh', 'info.start')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function chatScene() {
    return (
      <ChatView
        classNames={['landbank']}
        background={chatBackground}
        isEnd={isCallEnded}
        isLoading={loading}
        isRecording={isPTTUserSpeaking}
        onSubmit={() => onSubmitText()}
        onClickEnd={() => handleAnalyzeChatHistory()}
        onMicrophoneClick={handleMicrophoneClick}
        lang={clientLanguage}
      ></ChatView>
    )
  }

  return (
    <div style={{ background: pageBackground }}>
      {chatScene()}
      <div style={{ display: 'none' }}>
        <App
          ref={appRef as any}
          agentConfig={agentConfig}
          onSessionOpen={onSessionOpen}
          onSessionResume={onSessionResume}
          onSessionClose={onSessionClose}
        />
      </div>
      <LanguageToggle
        currentLanguage={clientLanguage || 'zh'}
        onLanguageChange={(lang) => {
          console.log('lang', lang);
          setLanguage(lang as Language);
          setClientLanguage(lang as Language);
          localStorage.setItem('client-language', lang);
          window.location.reload();
        }}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ClassChatPage />
    </Suspense>
  );
}
