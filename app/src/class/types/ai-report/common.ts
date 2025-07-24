import type { ReactNode } from 'react';

export interface Score {
  criterion: string;
  score: number;
  explanation: string;
  examples: string[];
  improvementTips: string[];
}

export interface AnalysisResponse {
  overallScore: number;
  feedback: string;
  summary: string;
  overallImprovementTips: string[];
  scores: Score[];
  language: string;
}

export interface TimelineData {
  role: string;
  content: string;
}

export interface ReportDatas {
  timeline: TimelineData[];
}

export interface TimelineItem {
  node: React.ReactNode;
  meta?: {
    title?: string;
    subtitle?: string;
    timelineColor?: string;
    subtitleColor?: string;
    aiAudio?: { url: string; startTime?: number };
    userAudio?: { url: string; startTime?: number };
  };
}

export interface TimelineContainerProps {
  items: TimelineItem[];
  className?: string;
}

// New types for audio-based timeline data
export interface EmotionAnalysis {
  sentence: string;
  emotion: string;
}

export interface AudioInfo {
  transcription: string;
  emotions: EmotionAnalysis[];
}

export interface AudioData {
  ref: string;
  startTime: number;
  url: string;
  audioInfo?: string; // JSON string containing AudioInfo
}

export interface KeyPoint {
  sentences: string[];
  problems: string[];
}

export interface TimelineConversation {
  title: string;
  subtitleColor: string;
  subtitle: string;
  aiAudio?: AudioData;
  userAudio?: AudioData;
  aiRole: string;
  userRole: string;
  aiSay: string;
  userSay: string;
  analysis: string[];
  keyPoint: KeyPoint;
  time: number;
}

export interface AudioTimelineData {
  timeline: TimelineConversation[];
} 