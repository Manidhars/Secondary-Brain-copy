
import React, { useEffect, useRef, useState } from 'react';
import { getQueue, updateQueueItem, removeFromQueue, addMemory, getSettings, updateMemory, getMemories, saveSettings, runColdStorageMaintenance, triggerSync, addToQueue, runSystemBootCheck, purgeOldDecisionLogs } from '../services/storage';
import { distillInput, verifyCrossMemoryConsistency, generateLongitudinalInsights } from '../services/llm';

const ProcessingUnit: React.FC = () => {
  const isProcessingRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const [isSafeMode, setIsSafeMode] = useState(false);

  useEffect(() => {
    const bootErrors = runSystemBootCheck();
    if (bootErrors.length > 0) {
      setIsSafeMode(true);
    }

    const handleActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    
    const maintenanceInterval = setInterval(() => {
        if (isSafeMode) return; 

        const settings = getSettings();
        const now = Date.now();
        const lastMaintenance = settings.last_maintenance_at ? new Date(settings.last_maintenance_at).getTime() : 0;
        const oneDay = 24 * 60 * 60 * 1000;
        
        if (now - lastMaintenance > oneDay || (now - lastActivityRef.current > 60000 && now - lastMaintenance > 6 * 60 * 60 * 1000)) {
            addToQueue("Neural System Optimization", 'maintenance');
            saveSettings({ ...settings, last_maintenance_at: new Date().toISOString() });
        }
    }, 10000);

    const processingInterval = setInterval(async () => {
      if (isProcessingRef.current || isSafeMode) return;
      const queue = getQueue();
      const pendingItem = queue.find(i => i.status === 'pending' || (i.status === 'failed' && i.retryCount < 3));
      if (pendingItem) await processItem(pendingItem);
    }, 3000);

    return () => {
        clearInterval(maintenanceInterval);
        clearInterval(processingInterval);
        window.removeEventListener('mousedown', handleActivity);
        window.removeEventListener('keydown', handleActivity);
    };
  }, [isSafeMode]);

  /**
   * FEATURE: PII & Ambiguity Filter (Section 9.3)
   */
  const containsSensitiveData = (text: string): boolean => {
    const PII_PATTERNS = [
        /\b(?:\d[ -]*?){13,16}\b/, // Credit Cards
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Emails
        /(?:sk-|api_|key-)[a-zA-Z0-9]{20,}/i, // API Keys
        /(password|passwd|secret|token)\s*[:=]\s*\S+/i, // Passwords
    ];
    return PII_PATTERNS.some(pattern => pattern.test(text));
  };

  const validateMemory = (mem: any) => {
      const settings = getSettings();
      if (!mem.content || !mem.domain || !mem.entity) return false;
      
      if (settings.pii_filter_enabled && containsSensitiveData(mem.content)) {
          console.warn("[Privacy] Blocked memory ingestion: Sensitive data detected.");
          return false;
      }

      const invalidWords = [' it ', ' they ', ' he ', ' she ', ' his ', ' her ', ' its '];
      const lower = ` ${mem.content.toLowerCase()} `;
      if (invalidWords.some(w => lower.includes(w))) return false;
      
      return true;
  };

  const processItem = async (item: any) => {
    isProcessingRef.current = true;
    const settings = getSettings();
    const modelTag = settings.cloud_disabled ? 'local-llm' : 'gemini-3-flash';
    
    try {
      updateQueueItem(item.id, { status: 'processing' });

      if (item.type === 'maintenance') {
          // Maintenance now includes Cold Storage flip AND Audit Log purge
          runColdStorageMaintenance(); 
          await triggerSync();
          addToQueue("Insight Synthesis Task", 'insight_gen');
      } 
      else if (item.type === 'insight_gen') {
          const memories = getMemories();
          const insights = await generateLongitudinalInsights(memories);
          
          insights.forEach((ins: any) => {
              addMemory({
                  content: ins.content,
                  domain: ins.domain || 'general',
                  type: 'insight',
                  entity: ins.entity,
                  distilled_by: 'autonomous-metacognition',
                  justification: ins.justification
              });
          });
      }
      else {
          const { memories } = await distillInput(item.content);
          if (memories?.length > 0) {
              for (const mem of memories) {
                  if (validateMemory(mem)) {
                      const validation = await verifyCrossMemoryConsistency(mem.content, mem.domain);
                      const memoryObj = addMemory({
                          content: mem.content,
                          domain: mem.domain,
                          type: mem.type,
                          entity: mem.entity,
                          confidence: mem.confidence,
                          speaker: 'user',
                          distilled_by: modelTag,
                          images: item.imageBase64 ? [item.imageBase64] : undefined
                      });

                      if (memoryObj && validation.isContradictory) {
                          updateMemory(memoryObj.id, { 
                              status: 'contradictory', 
                              metadata: { 
                                  validation_reason: validation.reasoning,
                                  contradicts_id: validation.conflicting_id 
                              } 
                          });
                      }
                  }
              }
          }
      }
      
      removeFromQueue(item.id);
      window.dispatchEvent(new Event('storage-update'));
    } catch (e: any) {
      updateQueueItem(item.id, { status: 'failed', retryCount: (item.retryCount || 0) + 1, error: e.message });
    } finally {
      isProcessingRef.current = false;
    }
  };

  return null;
};

export default ProcessingUnit;
