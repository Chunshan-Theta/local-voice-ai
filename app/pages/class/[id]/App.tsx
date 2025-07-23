"use client";

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { LogService } from '@/app/lib/log-service';

import Image from "next/image";

// UI components
import Transcript from "@/app/components/Transcript";
import Events from "@/app/components/Events";
import BottomToolbar from "@/app/components/BottomToolbar";

// Types
import { AgentConfig, SessionStatus } from "@/app/types";

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useAppContext } from "@/app/contexts/AppContext";
import { useHandleServerEvent } from "@/app/hooks/useHandleServerEvent";

// Utilities
import { createRealtimeConnection } from "@/app/lib/realtimeConnection";

// Agent configs
import { allAgentSets, defaultAgentSetKey, sharedConfig } from "@/app/agentConfigs";
import { getTranslation, Language } from "@/app/i18n/translations";

// Add language options
const languageOptions = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
];

export interface AppRef {
  disconnectFromRealtime: () => void;
  connectToRealtime: () => Promise<void>;
  sendSimulatedUserMessage: (text: string, opts: {
    hide?: boolean;
    role?: 'user' | 'assistant' | 'system';
    noAppendToTranscript?: boolean;
    triggerResponse?: boolean;
  }) => Promise<void>;
  getTranscriptItems: () => any[];
  clearTranscript: () => void;
}

export type AppProps = {
  hideLogs?: boolean;
  agentConfig?: AgentConfig;
  /** 第一次接通時 */
  onSessionOpen?: () => void;
  /** 第二次以後接通 */
  onSessionResume?: () => void;
  /** 每次中斷 */
  onSessionClose?: () => void;
  /** 測試模式 */
  isTestMode?: boolean;
};



const App = forwardRef<AppRef, AppProps>((props, ref) => {
  const hideLogs = props.hideLogs || false;
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const noop = () => { };
  const onSessionOpen = props.onSessionOpen ?? noop;
  const onSessionResume = props.onSessionResume ?? noop;
  const onSessionClose = props.onSessionClose ?? noop;


  const { transcriptItems, addTranscriptMessage, updateTranscriptItemStatus, addTranscriptBreadcrumb, clearTranscript } =
    useTranscript();

  // Use a try-catch to handle the case when EventContext is not available
  const eventContext = useEvent();
  const logClientEvent = eventContext.logClientEvent;
  const logServerEvent = eventContext.logServerEvent;

  const [selectedAgentName, setSelectedAgentName] = useState<string>(props.agentConfig?.name ?? "");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] =
    useState<AgentConfig[] | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("zh");

  // Always call useAppContext unconditionally
  const appContext = useAppContext();

  // Create a safe version of appContext that won't throw errors
  const safeAppContext = appContext

  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("DISCONNECTED");

  const [isEventsPaneExpanded, setIsEventsPaneExpanded] =
    useState<boolean>(true);
  const [userText, setUserText] = useState<string>("");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(false);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] =
    useState<boolean>(true);

  /** 控制麥克風是否啟用 */
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState<boolean>(true);

  /** 記錄 session 連線到 realtime 的次數 */
  const [sessionStartTimes, setSessionStartTimes] = useState<number>(0);

  const logService = useMemo(() => LogService.getInstance(), []);

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    if (dcRef.current && dcRef.current.readyState === "open") {
      logClientEvent(eventObj, eventNameSuffix);
      dcRef.current.send(JSON.stringify(eventObj));
    } else {
      logClientEvent(
        { attemptedEvent: eventObj.type },
        "error.data_channel_not_open"
      );
      console.error(
        "Failed to send message - no data channel available",
        eventObj
      );
    }
  };

  const handleServerEventRef = useHandleServerEvent({
    setSessionStatus,
    selectedAgentName,
    selectedAgentConfigSet,
    sendClientEvent: async (eventObj: any, eventNameSuffix = "") => {
      if (dcRef.current && dcRef.current.readyState === "open") {
        logClientEvent(eventObj, eventNameSuffix);
        dcRef.current.send(JSON.stringify(eventObj));
      } else {
        logClientEvent(
          { attemptedEvent: eventObj.type },
          "error.data_channel_not_open"
        );
        console.error(
          "Failed to send message - no data channel available",
          eventObj
        );
      }
    },
    setSelectedAgentName,
    hideLogs,
  });

  useEffect(() => {
    const agentConfig = props.agentConfig;

    if (agentConfig) {
      setSelectedAgentConfigSet([agentConfig]);
      setSelectedAgentName(agentConfig.name);
      setSelectedLanguage("zh");
    }
  }, [props.agentConfig]);

  useEffect(() => {
    if (
      sessionStatus === "CONNECTED" &&
      selectedAgentConfigSet &&
      selectedAgentName
    ) {
      const currentAgent = selectedAgentConfigSet.find(
        (a) => a.name === selectedAgentName
      );
      if (!hideLogs) {
        addTranscriptBreadcrumb(
          `Agent: ${selectedAgentName}`,
          currentAgent
        );
      }
      updateSession(sessionStartTimes === 0, currentAgent?.voice || "echo", currentAgent?.lang || "zh");
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus, hideLogs]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      console.log(
        `updatingSession, isPTTACtive=${isPTTActive} sessionStatus=${sessionStatus}`
      );
      updateSession();
    }
  }, [isPTTActive]);

  const fetchEphemeralKey = async (): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }

    return data.client_secret.value;
  };

  const connectToRealtime = async () => {
    if (sessionStatus !== "DISCONNECTED") return;
    setSessionStatus("CONNECTING");

    try {
      const EPHEMERAL_KEY = await fetchEphemeralKey();
      if (!EPHEMERAL_KEY) {
        return;
      }

      if (!audioElementRef.current) {
        audioElementRef.current = document.createElement("audio");
      }
      audioElementRef.current.autoplay = isAudioPlaybackEnabled;

      const { pc, dc, getLS, getRS, getInfo } = await createRealtimeConnection(
        EPHEMERAL_KEY,
        audioElementRef
      );
      pcRef.current = pc;
      dcRef.current = dc;
      safeAppContext.setDataChannel(dc);

      const rec = safeAppContext.recorder;
      rec.quickSetup(
        getLS(),
        await getRS(),
        getInfo().sampleRate,
        getInfo().channels
      )
      

      dc.addEventListener("open", () => {
        logClientEvent({}, "data_channel.open");
      });
      dc.addEventListener("close", () => {
        logClientEvent({}, "data_channel.close");
      });
      dc.addEventListener("error", (err: any) => {
        logClientEvent({ error: err }, "data_channel.error");
      });
      dc.addEventListener("message", (e: MessageEvent) => {
        handleServerEventRef.current(JSON.parse(e.data));
      });

      setDataChannel(dc);
      if (props.isTestMode) {
        setIsPTTActive(true);
      }
    } catch (err) {
      console.error("Error connecting to realtime:", err);
      setSessionStatus("DISCONNECTED");
    }
  };

  const disconnectFromRealtime = () => {
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.track.stop();
        }
      });

      pcRef.current.close();
      pcRef.current = null;
    }

    const rec = safeAppContext.recorder;
    rec.toggleRecorder(false);

    setDataChannel(null);
    setSessionStatus("DISCONNECTED");
    setIsPTTUserSpeaking(false);

    logClientEvent({}, "disconnected");

    onSessionClose();
  };
  type sendSimulatedUserMessageOpts = {
    hide?: boolean;
    role?: 'user' | 'assistant' | 'system';

    noAppendToTranscript?: boolean;

    triggerResponse?: boolean;
  }
  const sendSimulatedUserMessage = async (text: string, opts: sendSimulatedUserMessageOpts) => {
    const id = uuidv4().slice(0, 32);
    const role = opts.role || "user";

    await logService.logEvent({
      event_name: 'user_message',
      action_category: 'conversation',
      action_subtype: 'user_message',
      action_properties: {
        content: text,
        itemId: id,
        role: role,
        isHidden: !!opts.hide
      }
    });

    if (!opts.noAppendToTranscript) {
      addTranscriptMessage(id, role as any, text, !!opts.hide);
      updateTranscriptItemStatus(id, "DONE")
    }

    sendClientEvent(
      {
        type: "conversation.item.create",
        item: {
          id,
          type: "message",
          role: role,
          content: [{ type: "input_text", text }],
        },
      },
      "(simulated user text message)"
    );
    if (opts.triggerResponse) {
      sendClientEvent(
        { type: "response.create" },
        "(trigger response after simulated user text message)"
      );
    }
  };

  const updateSession = async (shouldTriggerResponse: boolean = false, voice: string = "echo", lang: Language = "zh") => {
    await logService.logEvent({
      event_name: 'session_update',
      action_category: 'session',
      action_subtype: 'update',
      action_properties: {
        shouldTriggerResponse,
        voice,
        lang,
        sessionStartTimes
      }
    });

    sendClientEvent(
      { type: "input_audio_buffer.clear" },
      "clear audio buffer on session update"
    );

    const currentAgent = selectedAgentConfigSet?.find(
      (a) => a.name === selectedAgentName
    );

    const turnDetection = isPTTActive || !isMicrophoneEnabled
      ? null
      : {
        type: "server_vad",
        threshold: 0.95,
        prefix_padding_ms: 300,
        silence_duration_ms: 200,
        create_response: true,
      };

    const instructions = currentAgent?.instructions || "";
    const tools = currentAgent?.tools || [];
    const agentVoice = currentAgent?.voice || voice;

    // Use shared config for sttPrompt
    console.log("final agent instructions :", instructions);
    console.log("agentVoice:", agentVoice);

    const sessionUpdateEvent = {
      type: "session.update",
      session: {
        modalities: props.isTestMode ? ["text"] : ["text", "audio"],
        instructions,
        voice: agentVoice,
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "gpt-4o-transcribe",
          language: lang,
          prompt: getTranslation(lang, 'ai_chatbot_action.sttPrompt'),
        },
        turn_detection: turnDetection,
        tools,
      },
    };

    sendClientEvent(sessionUpdateEvent);
    // Format transcriptItems into readable chat history
    const chatHistory = transcriptItems
      .filter(item => item && item.type === 'MESSAGE' && item.role && item.title)
      .map(item => `${item.role}: ${item.title}`)
      .join('\n\n');

    if (chatHistory && !props.isTestMode) {
      await sendSimulatedUserMessage(`${getTranslation(lang, 'ai_chatbot_action.chatHistory')}\n\n${chatHistory}\n\n${getTranslation(lang, 'ai_chatbot_action.assistantRole')}`, {
        hide: true,
        role: "system",
      });
      console.log(`送出之前的對話紀錄:\n${chatHistory}`);
    }

    if (shouldTriggerResponse) {
      await sendSimulatedUserMessage(getTranslation(lang, 'ai_chatbot_action.startAsk'), { hide: true, triggerResponse: true, });
    }
    if (sessionStartTimes === 0) {
      onSessionOpen();
    } else {
      await sendSimulatedUserMessage(getTranslation(lang, 'ai_chatbot_action.sessionResume'), { hide: false, triggerResponse: false, });
      onSessionResume();
    }
    setSessionStartTimes((prev) => prev + 1);
  };

  const cancelAssistantSpeech = async () => {
    const mostRecentAssistantMessage = [...transcriptItems]
      .reverse()
      .find((item) => item.role === "assistant");

    if (!mostRecentAssistantMessage) {
      console.warn("can't cancel, no recent assistant message found");
      return;
    }
    if (mostRecentAssistantMessage.status === "DONE") {
      console.log("No truncation needed, message is DONE");
      return;
    }

    await logService.logEvent({
      event_name: 'cancel_assistant_speech',
      action_category: 'conversation',
      action_subtype: 'cancel_response',
      action_properties: {
        messageId: mostRecentAssistantMessage.itemId,
        messageStatus: mostRecentAssistantMessage.status,
        cancelTime: Date.now() - mostRecentAssistantMessage.createdAtMs
      }
    });

    sendClientEvent({
      type: "conversation.item.truncate",
      item_id: mostRecentAssistantMessage?.itemId,
      content_index: 0,
      audio_end_ms: Date.now() - mostRecentAssistantMessage.createdAtMs,
    });
    sendClientEvent(
      { type: "response.cancel" },
      "(cancel due to user interruption)"
    );
  };

  const handleSendTextMessage = () => {
    if (!userText.trim()) return;
    cancelAssistantSpeech();

    sendClientEvent(
      {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: userText.trim() }],
        },
      },
      "(send user text message)"
    );
    setUserText("");

    sendClientEvent({ type: "response.create" }, "trigger response");
  };

  const handleTalkButtonDown = () => {
    if (sessionStatus !== "CONNECTED" || dataChannel?.readyState !== "open")
      return;
    cancelAssistantSpeech();

    setIsPTTUserSpeaking(true);
    sendClientEvent({ type: "input_audio_buffer.clear" }, "(clear PTT buffer)");
  };

  const handleTalkButtonUp = () => {
    if (
      sessionStatus !== "CONNECTED" ||
      dataChannel?.readyState !== "open" ||
      !isPTTUserSpeaking 
    )
      return;

    setIsPTTUserSpeaking(false);
    sendClientEvent({ type: "input_audio_buffer.commit" }, "commit PTT");
    sendClientEvent({ type: "response.create" }, "trigger response PTT");
  };

  const onToggleConnection = () => {
    if (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING") {
      disconnectFromRealtime();
      setSessionStatus("DISCONNECTED");
    } else {
      connectToRealtime();
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    setSelectedLanguage(newLanguage);
  };

  useEffect(() => {
    const storedPushToTalkUI = localStorage.getItem("pushToTalkUI");
    if (storedPushToTalkUI) {
      setIsPTTActive(storedPushToTalkUI === "true");
    }
    const storedLogsExpanded = localStorage.getItem("logsExpanded");
    if (storedLogsExpanded) {
      setIsEventsPaneExpanded(storedLogsExpanded === "true");
    }
    const storedAudioPlaybackEnabled = localStorage.getItem(
      "audioPlaybackEnabled"
    );
    if (storedAudioPlaybackEnabled) {
      setIsAudioPlaybackEnabled(storedAudioPlaybackEnabled === "true");
    }

    // 麥克風是否啟用
    if (props.isTestMode) {
      // setIsMicrophoneEnabled(false);
      //connectToRealtime();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("pushToTalkUI", isPTTActive.toString());
  }, [isPTTActive]);

  useEffect(() => {
    localStorage.setItem("logsExpanded", isEventsPaneExpanded.toString());
  }, [isEventsPaneExpanded]);

  useEffect(() => {
    localStorage.setItem(
      "audioPlaybackEnabled",
      isAudioPlaybackEnabled.toString()
    );
  }, [isAudioPlaybackEnabled]);

  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.play().catch((err) => {
          console.warn("Autoplay may be blocked by browser:", err);
        });
      } else {
        audioElementRef.current.pause();
      }
    }
  }, [isAudioPlaybackEnabled]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // expose 給父元件
  useImperativeHandle(ref, () => ({
    disconnectFromRealtime,
    connectToRealtime,
    sendSimulatedUserMessage,
    getTranscriptItems: () => transcriptItems,
    clearTranscript,
  }));

  return (
    <div className="text-base flex flex-col bg-gray-100 text-gray-800 relative" style={{ height: '95vh' }}>
      <div className="p-5 text-lg font-semibold flex justify-between items-center">
        <div className="flex items-center">
          <div onClick={() => window.location.reload()} style={{ cursor: 'pointer' }}>
            <Image
              src="/openai-logomark.svg"
              alt="OpenAI Logo"
              width={20}
              height={20}
              className="mr-2"
            />
          </div>
          <div>
            Realtime API <span className="text-gray-500">Agents</span>
          </div>
        </div>
        <div className="flex items-center">
          {!hideLogs && (
            <div className="flex items-center">
              <label className="flex items-center text-base gap-1 mr-2 font-medium">
                Language
              </label>
              <div className="relative inline-block">
                <select
                  value={selectedLanguage}
                  onChange={handleLanguageChange}
                  className="appearance-none border border-gray-300 rounded-lg text-base px-2 py-1 pr-8 cursor-pointer font-normal focus:outline-none"
                >
                  {languageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-600">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 10.44l3.71-3.21a.75.75 0 111.04 1.08l-4.25 3.65a.75.75 0 01-1.04 0L5.21 8.27a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-2 px-2  relative">
        <Transcript
          userText={userText}
          setUserText={setUserText}
          onSendMessage={handleSendTextMessage}
          canSend={
            sessionStatus === "CONNECTED" &&
            dcRef.current?.readyState === "open"
          }
          hideLogs={hideLogs}
        />

        {!hideLogs && (
          <div className="w-1/3 border-l border-gray-200">
            {mounted ? <Events isExpanded={isEventsPaneExpanded} /> : <div className="h-full"></div>}
          </div>
        )}
      </div>

      <BottomToolbar
        sessionStatus={sessionStatus}
        onToggleConnection={onToggleConnection}
        isPTTActive={isPTTActive}
        setIsPTTActive={setIsPTTActive}
        isPTTUserSpeaking={isPTTUserSpeaking}
        handleTalkButtonDown={handleTalkButtonDown}
        handleTalkButtonUp={handleTalkButtonUp}
        isEventsPaneExpanded={isEventsPaneExpanded}
        setIsEventsPaneExpanded={setIsEventsPaneExpanded}
        isAudioPlaybackEnabled={isAudioPlaybackEnabled}
        setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
        hideLogs={hideLogs}
      />
    </div>
  );
});

App.displayName = 'App';

export default App;
