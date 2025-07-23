'use client';

import { Suspense, useState, useEffect } from 'react';
import ClassReportComponent from '@/app/components/ai-report/ClassReportComponent';
import ReportViewV2 from '@/app/components/ai-report/ReportViewV2';
import AudioReportView from '@/app/components/ai-report/AudioReportView';
import { AnalysisResponse, ReportDatas } from '@/app/types/ai-report/common';

type ReportTab = 'v1' | 'v2' | 'audio';

function ReportContent() {
  const [activeTab, setActiveTab] = useState<ReportTab>('v1');
  const [reportData, setReportData] = useState<ReportDatas | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  async function fetchReportData(): Promise<ReportDatas> {
    const reportDataStr = localStorage.getItem('report');
    if (!reportDataStr) {
      throw new Error('No report data found in local storage');
    }
    const reportData = JSON.parse(reportDataStr) as ReportDatas;
    return reportData;
  }

  async function fetchAnalysisData(): Promise<AnalysisResponse> {
    const analysisStr = localStorage.getItem('analyzeChatHistoryByRubric');
    if (!analysisStr) {
      throw new Error('No analysis data found in local storage');
    }
    const analysisData = JSON.parse(analysisStr) as AnalysisResponse;
    return analysisData;
  }

  async function init() {
    try {
      const [report, analysis] = await Promise.all([
        fetchReportData(),
        fetchAnalysisData()
      ]);
      setReportData(report);
      setAnalysisData(analysis);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Render tab buttons
  const renderTabs = () => (
    <div className="flex justify-between items-center mb-6">
      <button
        onClick={() => window.history.back()}
        className="px-4 py-2 rounded-lg transition-colors duration-200 bg-[#173944] text-gray-300 hover:bg-[#194A54]"
      >
        ← Back
      </button>
      <div className="flex space-x-2">
        <button
          onClick={() => setActiveTab('v1')}
          className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
            activeTab === 'v1'
              ? 'bg-[#00A3E0] text-white'
              : 'bg-[#173944] text-gray-300 hover:bg-[#194A54]'
          }`}
        >
          時間序列
        </button>
        <button
          onClick={() => setActiveTab('v2')}
          className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
            activeTab === 'v2'
              ? 'bg-[#00A3E0] text-white'
              : 'bg-[#173944] text-gray-300 hover:bg-[#194A54]'
          }`}
        >
          總體分析
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
            activeTab === 'audio'
              ? 'bg-[#00A3E0] text-white'
              : 'bg-[#173944] text-gray-300 hover:bg-[#194A54]'
          }`}
        >
          音頻分析
        </button>
      </div>
    </div>
  );

  // Render content based on active tab
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#00A3E0]"></div>
        </div>
      );
    }

    if (!reportData || !analysisData) {
      return (
        <div className="text-white text-center p-8">
          No report data found
        </div>
      );
    }

    if (activeTab === 'v1') {
      return (
        <ClassReportComponent />
      );
    }
    
    if (activeTab === 'audio') {
      return (
        <AudioReportView
          data={reportData}
          message={JSON.parse(localStorage.getItem('chatMessages') || '[]')}
        />
      );
    }
    
    const messages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
    return (
      <ReportViewV2
        data={analysisData} 
        message={messages} 
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#0F2D38] p-4">
      {renderTabs()}
      {renderContent()}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ReportContent />
    </Suspense>
  );
} 