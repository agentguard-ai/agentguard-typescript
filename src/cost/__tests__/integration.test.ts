/**
 * Cost System Integration Tests
 * 
 * Tests the complete cost tracking system with all components working together
 */

import { CostTracker } from '../CostTracker';
import { BudgetManager } from '../BudgetManager';
import { InMemoryCostStorage } from '../CostStorage';
import { CostRecord } from '../types';

describe('Cost System Integration', () => {
  let tracker: CostTracker;
  let budgetManager: BudgetManager;
  let storage: InMemoryCostStorage;

  beforeEach(() => {
    storage = new InMemoryCostStorage();
    tracker = new CostTracker({ enabled: true, persistRecords: true, enableBudgets: true, enableAlerts: true });
    budgetManager = new BudgetManager(storage);
  });

  describe('Complete Cost Tracking Flow', () => {
    it('should track costs, enforce budgets, and generate alerts', async () => {
      // 1. Create a budget
      const budget = budgetManager.createBudget({
        name: 'Daily GPT-4 Budget',
        limit: 1.0,
        period: 'daily',
        alertThresholds: [50, 75, 90, 100],
        action: 'alert',
        enabled: true,
      });

      expect(budget.id).toBeDefined();

      // 2. Estimate cost for a request
      const estimate = tracker.estimateCost(
        'gpt-4',
        {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
        },
        'openai'
      );

      expect(estimate.estimatedCost).toBeGreaterThan(0);
      expect(estimate.estimatedCost).toBeLessThan(0.1);

      // 3. Check budget before making request
      const budgetCheck = await budgetManager.checkBudget('agent-123', estimate.estimatedCost);

      expect(budgetCheck.allowed).toBe(true);
      expect(budgetCheck.blockedBy).toBeUndefined();

      // 4. Calculate actual cost after request
      const actualCost = tracker.calculateActualCost(
        'req-123',
        'agent-123',
        'gpt-4',
        {
          inputTokens: 1050,
          outputTokens: 480,
          totalTokens: 1530,
        },
        'openai'
      );

      expect(actualCost.actualCost).toBeGreaterThan(0);

      // 5. Store cost record
      const record = {
        ...actualCost,
        timestamp: new Date().toISOString(),
      };

      await storage.store(record);

      // 6. Record cost with budget manager
      await budgetManager.recordCost(record);

      // 7. Check budget status
      const status = await budgetManager.getBudgetStatus(budget.id);

      expect(status).toBeDefined();
      expect(status?.currentSpending).toBe(actualCost.actualCost);
      expect(status?.percentageUsed).toBeLessThan(10);
      expect(status?.isExceeded).toBe(false);
    });

    it('should block requests when budget is exceeded', async () => {
      // 1. Create a strict budget
      const budget = budgetManager.createBudget({
        name: 'Strict Budget',
        limit: 0.10,
        period: 'daily',
        alertThresholds: [50, 75, 90, 100],
        action: 'block',
        enabled: true,
      });

      // 2. Make several requests that exceed the budget
      let requestsMade = 0;
      for (let i = 0; i < 5; i++) {
        const estimate = tracker.estimateCost(
          'gpt-4',
          {
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
          },
          'openai'
        );

        const budgetCheck = await budgetManager.checkBudget('agent-456', estimate.estimatedCost);

        if (budgetCheck.allowed) {
          // Process request
          const actualCost = tracker.calculateActualCost(
            `req-${i}`,
            'agent-456',
            'gpt-4',
            {
              inputTokens: 1000,
              outputTokens: 500,
              totalTokens: 1500,
            },
            'openai'
          );

          await storage.store(actualCost);
          await budgetManager.recordCost(actualCost);
          requestsMade++;
        } else {
          // Request blocked
          expect(budgetCheck.blockedBy).toEqual(budget);
          expect(budgetCheck.allowed).toBe(false);
          break;
        }
      }

      // 3. Verify budget enforcement worked
      expect(requestsMade).toBeLessThan(5); // Should have been blocked before 5 requests
      expect(requestsMade).toBeGreaterThanOrEqual(1); // At least one request should have succeeded
      
      const status = await budgetManager.getBudgetStatus(budget.id);

      // The budget may or may not be exceeded depending on when blocking occurred
      // But we should have made at least one request
      expect(status?.currentSpending).toBeGreaterThan(0);
    });

    it('should generate alerts at threshold crossings', async () => {
      // 1. Create budget with multiple thresholds
      const budget = budgetManager.createBudget({
        name: 'Alert Budget',
        limit: 0.50,
        period: 'daily',
        alertThresholds: [25, 50, 75, 90],
        action: 'alert',
        enabled: true,
      });

      // 2. Gradually increase spending to cross thresholds
      // Each GPT-4 request costs ~$0.06, so we need ~8 requests to reach 90% of $0.50
      for (let i = 0; i < 10; i++) {
        const actualCost = tracker.calculateActualCost(
          `req-${i}`,
          'agent-789',
          'gpt-4',
          {
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
          },
          'openai'
        );

        await storage.store(actualCost);
        await budgetManager.recordCost(actualCost);

        // Small delay to ensure unique timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // 3. Check alerts
      const alerts = budgetManager.getAlerts(budget.id);

      expect(alerts.length).toBeGreaterThan(0);
      
      // Should have alerts for thresholds we crossed
      const thresholds = alerts.map(a => a.threshold);
      expect(thresholds).toContain(25);
      expect(thresholds).toContain(50);
      expect(thresholds).toContain(75);
      expect(thresholds).toContain(90);
    });

    it('should support multiple models and providers', async () => {
      // 1. Create a general budget
      const budget = budgetManager.createBudget({
        name: 'Multi-Model Budget',
        limit: 5.0,
        period: 'daily',
        alertThresholds: [100],
        action: 'alert',
        enabled: true,
      });

      // 2. Track costs for different models
      const models = [
        { model: 'gpt-4', provider: 'openai' as const, tokens: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 } },
        { model: 'claude-3-opus-20240229', provider: 'anthropic' as const, tokens: { inputTokens: 2000, outputTokens: 1000, totalTokens: 3000 } },
        { model: 'gpt-3.5-turbo', provider: 'openai' as const, tokens: { inputTokens: 5000, outputTokens: 2500, totalTokens: 7500 } },
      ];

      let totalCost = 0;

      for (let i = 0; i < models.length; i++) {
        const { model, provider, tokens } = models[i];

        const actualCost = tracker.calculateActualCost(
          `req-${i}`,
          'agent-multi',
          model,
          tokens,
          provider
        );

        await storage.store(actualCost);
        await budgetManager.recordCost(actualCost);

        totalCost += actualCost.actualCost;

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // 3. Verify total spending
      const status = await budgetManager.getBudgetStatus(budget.id);

      expect(status?.currentSpending).toBeCloseTo(totalCost, 4);
      expect(status?.isExceeded).toBe(false);

      // 4. Verify storage has all records
      const allRecords = await storage.getByAgentId('agent-multi');
      expect(allRecords.length).toBe(models.length);
    });

    it('should handle agent-scoped budgets correctly', async () => {
      // 1. Create agent-specific budgets
      const budget1 = budgetManager.createBudget({
        name: 'Agent 1 Budget',
        limit: 0.10,
        period: 'daily',
        alertThresholds: [100],
        action: 'block',
        scope: {
          type: 'agent',
          id: 'agent-1',
        },
        enabled: true,
      });

      const budget2 = budgetManager.createBudget({
        name: 'Agent 2 Budget',
        limit: 1.0,
        period: 'daily',
        alertThresholds: [100],
        action: 'block',
        scope: {
          type: 'agent',
          id: 'agent-2',
        },
        enabled: true,
      });

      // 2. Make multiple requests for agent-1 to exceed its budget
      for (let i = 0; i < 3; i++) {
        const cost1 = tracker.calculateActualCost(
          `req-1-${i}`,
          'agent-1',
          'gpt-4',
          {
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
          },
          'openai'
        );

        await storage.store(cost1);
        await budgetManager.recordCost(cost1);
      }

      // 3. Make one request for agent-2 (should not exceed)
      const cost2 = tracker.calculateActualCost(
        'req-2',
        'agent-2',
        'gpt-4',
        {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
        },
        'openai'
      );

      await storage.store(cost2);
      await budgetManager.recordCost(cost2);

      // 3. Check budget status for each agent
      const status1 = await budgetManager.getBudgetStatus(budget1.id);
      const status2 = await budgetManager.getBudgetStatus(budget2.id);

      // Agent 1 should be over budget (3 * ~$0.06 = ~$0.18 > $0.10)
      expect(status1?.currentSpending).toBeGreaterThan(budget1.limit);
      expect(status1?.isExceeded).toBe(true);
      
      // Agent 2 should not be over budget (1 * ~$0.06 < $1.00)
      expect(status2?.currentSpending).toBeLessThan(budget2.limit);
      expect(status2?.isExceeded).toBe(false);
    });
  });

  describe('Cost Analytics', () => {
    it('should query costs by date range', async () => {
      // 1. Create records over time
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const records = [
        {
          id: 'record-1',
          requestId: 'req-1',
          agentId: 'agent-123',
          model: 'gpt-4',
          provider: 'openai' as const,
          actualTokens: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
          actualCost: 0.06,
          breakdown: { inputCost: 0.03, outputCost: 0.03 },
          timestamp: twoDaysAgo.toISOString(),
        },
        {
          id: 'record-2',
          requestId: 'req-2',
          agentId: 'agent-123',
          model: 'gpt-4',
          provider: 'openai' as const,
          actualTokens: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
          actualCost: 0.06,
          breakdown: { inputCost: 0.03, outputCost: 0.03 },
          timestamp: yesterday.toISOString(),
        },
        {
          id: 'record-3',
          requestId: 'req-3',
          agentId: 'agent-123',
          model: 'gpt-4',
          provider: 'openai' as const,
          actualTokens: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
          actualCost: 0.06,
          breakdown: { inputCost: 0.03, outputCost: 0.03 },
          timestamp: now.toISOString(),
        },
      ];

      for (const record of records) {
        await storage.store(record);
      }

      // 2. Query by date range
      const recentRecords = await storage.getByDateRange(yesterday, now);

      expect(recentRecords.length).toBe(2);
      expect(recentRecords.every(r => new Date(r.timestamp) >= yesterday)).toBe(true);
    });

    it('should query costs by agent', async () => {
      // 1. Create records for different agents
      const agents = ['agent-1', 'agent-2', 'agent-3'];

      for (let i = 0; i < agents.length; i++) {
        const cost = tracker.calculateActualCost(
          `req-${i}`,
          agents[i],
          'gpt-3.5-turbo',
          {
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
          },
          'openai'
        );

        await storage.store(cost);
      }

      // 2. Query by agent
      const agent1Records = await storage.getByAgentId('agent-1');

      expect(agent1Records.length).toBe(1);
      expect(agent1Records[0].agentId).toBe('agent-1');
    });

    it('should calculate total costs', async () => {
      // 1. Create multiple records
      const costs = [0.06, 0.04, 0.08, 0.05];

      for (let i = 0; i < costs.length; i++) {
        const record = {
          id: `record-${i}`,
          requestId: `req-${i}`,
          agentId: 'agent-123',
          model: 'gpt-4',
          provider: 'openai' as const,
          actualTokens: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
          actualCost: costs[i],
          breakdown: { inputCost: costs[i] / 2, outputCost: costs[i] / 2 },
          timestamp: new Date().toISOString(),
        };

        await storage.store(record);
      }

      // 2. Calculate total
      const allRecords = await storage.getByAgentId('agent-123');
      const totalCost = allRecords.reduce((sum: number, r: CostRecord) => sum + r.actualCost, 0);

      expect(totalCost).toBeCloseTo(0.23, 2);
    });
  });
});
