import React, { useState, useEffect, useCallback } from 'react';
import { useNoesis } from '../context/NoesisContext';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import {
  DiscoverSourceItem,
  TopicClusterSummary,
} from '../types';
import { fetchAllVectorEmbeddings, VectorMapResult } from '../lib/supabase';
import {
  SynthesisWorkspace,
  SynthesisSeedPayload,
} from '../components/discover/SynthesisWorkspace';
import { ConnectionsPanel } from '../components/discover/ConnectionsPanel';
import { TopicClustersPanel } from '../components/discover/TopicClustersPanel';
import { Sparkles, GitBranch, Layers } from 'lucide-react';

type DiscoverTab = 'synthesis' | 'connections' | 'clusters';

export const DiscoverPage: React.FC = () => {
  const {
    synthesisTargetNoteId,
    discoverTab: activeTab,
    setDiscoverTab: setActiveTab,
  } = useNoesis();

  const scrollRef = useScrollRestoration<HTMLDivElement>('discover:' + activeTab);

  useEffect(() => {
    if (synthesisTargetNoteId) {
      setActiveTab('synthesis');
    }
  }, [synthesisTargetNoteId, setActiveTab]);

  // Shared vector map for Connections & Topic Clusters
  const [vectorMap, setVectorMap] = useState<VectorMapResult | null>(null);
  const [isLoadingVectors, setIsLoadingVectors] = useState(false);

  // Cached cluster summaries persisted locally
  const [clusterSummaries, setClusterSummaries] = useState<
    Record<string, TopicClusterSummary>
  >(() => {
    try {
      const saved = localStorage.getItem('noesis_discover_cluster_summaries');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(
      'noesis_discover_cluster_summaries',
      JSON.stringify(clusterSummaries)
    );
  }, [clusterSummaries]);

  // Seed payload when sending items from Connections or Topic Clusters into Synthesis
  const [synthesisSeed, setSynthesisSeed] = useState<SynthesisSeedPayload | null>(null);

  const loadVectors = useCallback(async () => {
    setIsLoadingVectors(true);
    try {
      const map = await fetchAllVectorEmbeddings();
      setVectorMap(map);
    } finally {
      setIsLoadingVectors(false);
    }
  }, []);

  useEffect(() => {
    loadVectors();
  }, [loadVectors]);

  const handleSaveClusterSummary = (
    clusterId: string,
    summary: TopicClusterSummary
  ) => {
    setClusterSummaries((prev) => ({
      ...prev,
      [clusterId]: summary,
    }));
  };

  const handleSendToSynthesis = (items: DiscoverSourceItem[], topicHint?: string) => {
    setSynthesisSeed({
      items,
      topic: topicHint,
      nonce: Date.now(),
    });
    setActiveTab('synthesis');
  };

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#FAF7F2] dark:bg-[#151413] px-3 sm:px-8 lg:px-14 py-3 sm:py-8">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-8">
        {/* Clean Header + 3-Section Switcher */}
        <div className="border-b border-[#E8E2D8] dark:border-[#2F2B28] pb-3 sm:pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="font-serif text-2xl sm:text-4xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1]">
              Discover
            </h1>
            <p className="text-xs sm:text-sm text-[#6B635B] dark:text-[#A8A196] mt-0.5 sm:mt-1">
              Temukan keterkaitan catatan dan susun pengetahuan yang tercecer menjadi dokumen utuh.
            </p>
          </div>

          {/* 3-Tab Switcher */}
          <div className="flex items-center p-1 bg-[#F5EFEB] dark:bg-[#1E1C1A] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] self-start sm:self-auto shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] max-w-full">
            {[
              { id: 'synthesis', label: 'Synthesis', icon: Sparkles },
              { id: 'connections', label: 'Connections', icon: GitBranch },
              { id: 'clusters', label: 'Topic Clusters', icon: Layers },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as DiscoverTab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-xs'
                      : 'text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
                  }`}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ================================================================
            TAB 1: SYNTHESIS WORKSPACE
           ================================================================ */}
        <div className={activeTab === 'synthesis' ? 'block' : 'hidden'}>
          <SynthesisWorkspace incomingSeed={synthesisSeed} />
        </div>

        {/* ================================================================
            TAB 2: CONNECTIONS
           ================================================================ */}
        <div className={activeTab === 'connections' ? 'block' : 'hidden'}>
          <ConnectionsPanel
            vectorMap={vectorMap}
            isLoadingVectors={isLoadingVectors}
            onRefreshVectors={loadVectors}
            onSendToSynthesis={handleSendToSynthesis}
          />
        </div>

        {/* ================================================================
            TAB 3: TOPIC CLUSTERS
           ================================================================ */}
        <div className={activeTab === 'clusters' ? 'block' : 'hidden'}>
          <TopicClustersPanel
            vectorMap={vectorMap}
            isLoadingVectors={isLoadingVectors}
            onRefreshVectors={loadVectors}
            clusterSummaries={clusterSummaries}
            onSaveClusterSummary={handleSaveClusterSummary}
            onSendToSynthesis={handleSendToSynthesis}
          />
        </div>
      </div>
    </div>
  );
};
