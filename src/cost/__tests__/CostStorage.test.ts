/**
 * Cost Storage Tests
 */

import { InMemoryCostStorage } from '../CostStorage';
import { CostRecord } from '../types';

describe('InMemoryCostStorage', () => {
  let storage: InMemoryCostStorage;

  beforeEach(() => {
    storage = new InMemoryCostStorage();
  });

  const createMockRecord = (overrides: Partial<CostRecord> = {}): CostRecord => ({
    id: `record-${Date.now()}-${Math.random()}`,
    requestId: 'req-123',
    agentId: 'agent-456',
    model: 'gpt-4',
    provider: 'openai',
    actualTokens: {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
    },
    actualCost: 0.06,
    breakdown: {
      inputCost: 0.03,
      outputCost: 0.03,
    },
    timestamp: new Date().toISOString(),
    ...overrides,
  });

  describe('store and get', () => {
    it('should store and retrieve a cost record', async () => {
      const record = createMockRecord();

      await storage.store(record);
      const retrieved = await storage.get(record.id);

      expect(retrieved).toEqual(record);
    });

    it('should return undefined for non-existent record', async () => {
      const retrieved = await storage.get('non-existent');

      expect(retrieved).toBeUndefined();
    });

    it('should overwrite existing record with same ID', async () => {
      const record1 = createMockRecord({ id: 'same-id', actualCost: 0.05 });
      const record2 = createMockRecord({ id: 'same-id', actualCost: 0.10 });

      await storage.store(record1);
      await storage.store(record2);

      const retrieved = await storage.get('same-id');

      expect(retrieved?.actualCost).toBe(0.10);
    });
  });

  describe('getByRequestId', () => {
    it('should retrieve records by request ID', async () => {
      const record1 = createMockRecord({ requestId: 'req-1' });
      const record2 = createMockRecord({ requestId: 'req-1' });
      const record3 = createMockRecord({ requestId: 'req-2' });

      await storage.store(record1);
      await storage.store(record2);
      await storage.store(record3);

      const records = await storage.getByRequestId('req-1');

      expect(records).toHaveLength(2);
      expect(records.every(r => r.requestId === 'req-1')).toBe(true);
    });

    it('should return empty array for non-existent request ID', async () => {
      const records = await storage.getByRequestId('non-existent');

      expect(records).toEqual([]);
    });
  });

  describe('getByAgentId', () => {
    it('should retrieve records by agent ID', async () => {
      const record1 = createMockRecord({ agentId: 'agent-1' });
      const record2 = createMockRecord({ agentId: 'agent-1' });
      const record3 = createMockRecord({ agentId: 'agent-2' });

      await storage.store(record1);
      await storage.store(record2);
      await storage.store(record3);

      const records = await storage.getByAgentId('agent-1');

      expect(records).toHaveLength(2);
      expect(records.every(r => r.agentId === 'agent-1')).toBe(true);
    });

    it('should filter by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const record1 = createMockRecord({ agentId: 'agent-1', timestamp: yesterday.toISOString() });
      const record2 = createMockRecord({ agentId: 'agent-1', timestamp: now.toISOString() });
      const record3 = createMockRecord({ agentId: 'agent-1', timestamp: tomorrow.toISOString() });

      await storage.store(record1);
      await storage.store(record2);
      await storage.store(record3);

      const records = await storage.getByAgentId('agent-1', now, tomorrow);

      expect(records).toHaveLength(2);
      expect(records.some(r => r.id === record1.id)).toBe(false);
    });
  });

  describe('getByDateRange', () => {
    it('should retrieve records within date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const record1 = createMockRecord({ timestamp: twoDaysAgo.toISOString() });
      const record2 = createMockRecord({ timestamp: yesterday.toISOString() });
      const record3 = createMockRecord({ timestamp: now.toISOString() });

      await storage.store(record1);
      await storage.store(record2);
      await storage.store(record3);

      const records = await storage.getByDateRange(yesterday, now);

      expect(records).toHaveLength(2);
      expect(records.some(r => r.id === record1.id)).toBe(false);
    });
  });

  describe('getSummary', () => {
    it('should calculate cost summary', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const record1 = createMockRecord({
        agentId: 'agent-1',
        model: 'gpt-4',
        provider: 'openai',
        actualCost: 0.05,
        actualTokens: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
        timestamp: now.toISOString(),
      });

      const record2 = createMockRecord({
        agentId: 'agent-1',
        model: 'gpt-3.5-turbo',
        provider: 'openai',
        actualCost: 0.03,
        actualTokens: { inputTokens: 2000, outputTokens: 1000, totalTokens: 3000 },
        timestamp: now.toISOString(),
      });

      const record3 = createMockRecord({
        agentId: 'agent-2',
        model: 'claude-3-opus-20240229',
        provider: 'anthropic',
        actualCost: 0.10,
        actualTokens: { inputTokens: 1500, outputTokens: 750, totalTokens: 2250 },
        timestamp: now.toISOString(),
      });

      await storage.store(record1);
      await storage.store(record2);
      await storage.store(record3);

      const summary = await storage.getSummary(yesterday, now);

      expect(summary.totalCost).toBe(0.18);
      expect(summary.totalRequests).toBe(3);
      expect(summary.averageCostPerRequest).toBeCloseTo(0.06, 2);
      expect(summary.byModel['gpt-4']).toBe(0.05);
      expect(summary.byModel['gpt-3.5-turbo']).toBe(0.03);
      expect(summary.byModel['claude-3-opus-20240229']).toBe(0.10);
      expect(summary.byProvider['openai']).toBe(0.08);
      expect(summary.byProvider['anthropic']).toBe(0.10);
      expect(summary.byAgent['agent-1']).toBe(0.08);
      expect(summary.byAgent['agent-2']).toBe(0.10);
      expect(summary.totalTokens.input).toBe(4500);
      expect(summary.totalTokens.output).toBe(2250);
      expect(summary.totalTokens.total).toBe(6750);
    });

    it('should filter summary by agent ID', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const record1 = createMockRecord({ agentId: 'agent-1', actualCost: 0.05 });
      const record2 = createMockRecord({ agentId: 'agent-2', actualCost: 0.10 });

      await storage.store(record1);
      await storage.store(record2);

      const summary = await storage.getSummary(yesterday, now, 'agent-1');

      expect(summary.totalCost).toBe(0.05);
      expect(summary.totalRequests).toBe(1);
    });

    it('should handle empty results', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const summary = await storage.getSummary(yesterday, now);

      expect(summary.totalCost).toBe(0);
      expect(summary.totalRequests).toBe(0);
      expect(summary.averageCostPerRequest).toBe(0);
    });
  });

  describe('deleteOlderThan', () => {
    it('should delete records older than specified date', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const record1 = createMockRecord({ timestamp: twoDaysAgo.toISOString() });
      const record2 = createMockRecord({ timestamp: yesterday.toISOString() });
      const record3 = createMockRecord({ timestamp: now.toISOString() });

      await storage.store(record1);
      await storage.store(record2);
      await storage.store(record3);

      const deletedCount = await storage.deleteOlderThan(yesterday);

      expect(deletedCount).toBe(1);
      expect(storage.size()).toBe(2);
      expect(await storage.get(record1.id)).toBeUndefined();
      expect(await storage.get(record2.id)).toBeDefined();
      expect(await storage.get(record3.id)).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should clear all records', async () => {
      const record1 = createMockRecord();
      const record2 = createMockRecord();

      await storage.store(record1);
      await storage.store(record2);

      expect(storage.size()).toBe(2);

      await storage.clear();

      expect(storage.size()).toBe(0);
      expect(await storage.get(record1.id)).toBeUndefined();
      expect(await storage.get(record2.id)).toBeUndefined();
    });
  });
});
