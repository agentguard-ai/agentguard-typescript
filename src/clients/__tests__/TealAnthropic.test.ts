/**
 * TealAnthropic Tests
 */

import { TealAnthropic, MessageCreateRequest } from '../TealAnthropic';
import { GuardrailEngine, Guardrail, GuardrailResult } from '../../guardrails';
import { CostTracker } from '../../cost/CostTracker';
import { BudgetManager } from '../../cost/BudgetManager';
import { InMemoryCostStorage } from '../../cost/CostStorage';

describe('TealAnthropic', () => {
  let storage: InMemoryCostStorage;
  let costTracker: CostTracker;
  let budgetManager: BudgetManager;
  let guardrailEngine: GuardrailEngine;

  beforeEach(() => {
    storage = new InMemoryCostStorage();
    costTracker = new CostTracker({
      enabled: true,
      persistRecords: true,
      enableBudgets: true,
      enableAlerts: true,
    });
    budgetManager = new BudgetManager(storage);
    guardrailEngine = new GuardrailEngine();
  });

  describe('initialization', () => {
    it('should create a TealAnthropic client', () => {
      const client = new TealAnthropic({
        apiKey: 'test-key',
        agentId: 'test-agent',
      });

      expect(client).toBeDefined();
      expect(client.messages).toBeDefined();
      expect(client.messages.create).toBeDefined();
    });

    it('should accept custom components', () => {
      const client = new TealAnthropic({
        apiKey: 'test-key',
        guardrailEngine,
        costTracker,
        budgetManager,
        costStorage: storage,
      });

      expect(client).toBeDefined();
    });

    it('should have default configuration', () => {
      const client = new TealAnthropic({
        apiKey: 'test-key',
      });

      const config = client.getConfig();
      expect(config.enableGuardrails).toBe(true);
      expect(config.enableCostTracking).toBe(true);
    });
  });

  describe('messages.create', () => {
    it('should create a message', async () => {
      const client = new TealAnthropic({
        apiKey: 'test-key',
        agentId: 'test-agent',
        enableGuardrails: false,
        enableCostTracking: false,
      });

      const request: MessageCreateRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello, how are you?' },
        ],
      };

      const response = await client.messages.create(request);

      expect(response).toBeDefined();
      expect(response.id).toBeDefined();
      expect(response.model).toBe('claude-3-opus-20240229');
      expect(response.content).toHaveLength(1);
      expect(response.content[0].text).toBeDefined();
      expect(response.usage).toBeDefined();
    });

    it('should include security metadata', async () => {
      const client = new TealAnthropic({
        apiKey: 'test-key',
        agentId: 'test-agent',
        enableGuardrails: false,
        enableCostTracking: false,
      });

      const request: MessageCreateRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
      };

      const response = await client.messages.create(request);

      expect(response.security).toBeDefined();
    });

    it('should maintain API compatibility', async () => {
      const client = new TealAnthropic({
        apiKey: 'test-key',
        enableGuardrails: false,
        enableCostTracking: false,
      });

      const request: MessageCreateRequest = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'What is 2+2?' },
        ],
        system: 'You are a helpful assistant.',
        temperature: 0.7,
      };

      const response = await client.messages.create(request);

      // Check standard Anthropic response structure
      expect(response.id).toMatch(/^msg-/);
      expect(response.type).toBe('message');
      expect(response.role).toBe('assistant');
      expect(response.model).toBe('claude-3-sonnet-20240229');
      expect(response.content[0].type).toBe('text');
      expect(response.stop_reason).toBeDefined();
      expect(response.usage.input_tokens).toBeGreaterThan(0);
      expect(response.usage.output_tokens).toBeGreaterThan(0);
    });

    it('should handle array content format', async () => {
      const client = new TealAnthropic({
        apiKey: 'test-key',
        enableGuardrails: false,
        enableCostTracking: false,
      });

      const request: MessageCreateRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Hello!' },
            ],
          },
        ],
      };

      const response = await client.messages.create(request);

      expect(response).toBeDefined();
      expect(response.content[0].text).toBeDefined();
    });
  });

  describe('guardrail integration', () => {
    it('should run guardrails on input', async () => {
      // Create a test guardrail that always passes
      class TestGuardrail extends Guardrail {
        async evaluate(_input: string): Promise<GuardrailResult> {
          return new GuardrailResult({
            passed: true,
            action: 'allow',
            reason: 'Test passed',
            riskScore: 0,
          });
        }
      }

      guardrailEngine.registerGuardrail(new TestGuardrail({ name: 'test' }));

      const client = new TealAnthropic({
        apiKey: 'test-key',
        agentId: 'test-agent',
        guardrailEngine,
        enableCostTracking: false,
      });

      const request: MessageCreateRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
      };

      const response = await client.messages.create(request);

      expect(response.security?.guardrailResult).toBeDefined();
      expect(response.security?.guardrailResult?.passed).toBe(true);
    });

    it('should block requests when guardrails fail', async () => {
      // Create a test guardrail that always fails
      class FailingGuardrail extends Guardrail {
        async evaluate(_input: string): Promise<GuardrailResult> {
          return new GuardrailResult({
            passed: false,
            action: 'block',
            reason: 'High risk detected',
            riskScore: 90,
          });
        }
      }

      guardrailEngine.registerGuardrail(new FailingGuardrail({ name: 'failing' }));

      const client = new TealAnthropic({
        apiKey: 'test-key',
        agentId: 'test-agent',
        guardrailEngine,
        enableCostTracking: false,
      });

      const request: MessageCreateRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Dangerous input' },
        ],
      };

      await expect(client.messages.create(request)).rejects.toThrow(
        /Guardrail check failed/
      );
    });

    it('should work without guardrails when disabled', async () => {
      const client = new TealAnthropic({
        apiKey: 'test-key',
        agentId: 'test-agent',
        enableGuardrails: false,
        enableCostTracking: false,
      });

      const request: MessageCreateRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
      };

      const response = await client.messages.create(request);

      expect(response).toBeDefined();
      expect(response.security?.guardrailResult).toBeUndefined();
    });
  });

  describe('cost tracking integration', () => {
    it('should track costs', async () => {
      const client = new TealAnthropic({
        apiKey: 'test-key',
        agentId: 'test-agent',
        costTracker,
        costStorage: storage,
        enableGuardrails: false,
      });

      const request: MessageCreateRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
      };

      const response = await client.messages.create(request);

      expect(response.security?.costRecord).toBeDefined();
      expect(response.security?.costRecord?.actualCost).toBeGreaterThan(0);

      // Verify cost was stored
      const records = await storage.getByAgentId('test-agent');
      expect(records.length).toBe(1);
      expect(records[0].model).toBe('claude-3-opus-20240229');
    });

    it('should check budgets before requests', async () => {
      // Create a strict budget
      budgetManager.createBudget({
        name: 'Test Budget',
        limit: 0.002, // Enough for one small request but not two
        period: 'daily',
        alertThresholds: [100],
        action: 'block',
        enabled: true,
      });

      const client = new TealAnthropic({
        apiKey: 'test-key',
        agentId: 'test-agent',
        costTracker,
        budgetManager,
        costStorage: storage,
        enableGuardrails: false,
      });

      const request: MessageCreateRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 20, // Small response to keep cost low
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
      };

      // First request should succeed
      const response1 = await client.messages.create(request);
      expect(response1.security?.budgetCheck?.allowed).toBe(true);

      // Second request should be blocked (budget exceeded)
      await expect(client.messages.create(request)).rejects.toThrow(
        /Budget exceeded/
      );
    });

    it('should work without cost tracking when disabled', async () => {
      const client = new TealAnthropic({
        apiKey: 'test-key',
        agentId: 'test-agent',
        enableGuardrails: false,
        enableCostTracking: false,
      });

      const request: MessageCreateRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
      };

      const response = await client.messages.create(request);

      expect(response).toBeDefined();
      expect(response.security?.costRecord).toBeUndefined();
      expect(response.security?.budgetCheck).toBeUndefined();
    });
  });

  describe('combined guardrails and cost tracking', () => {
    it('should run both guardrails and cost tracking', async () => {
      // Create a passing guardrail
      class PassingGuardrail extends Guardrail {
        async evaluate(_input: string): Promise<GuardrailResult> {
          return new GuardrailResult({
            passed: true,
            action: 'allow',
            reason: 'Safe',
            riskScore: 0,
          });
        }
      }

      guardrailEngine.registerGuardrail(new PassingGuardrail({ name: 'test' }));

      const client = new TealAnthropic({
        apiKey: 'test-key',
        agentId: 'test-agent',
        guardrailEngine,
        costTracker,
        costStorage: storage,
      });

      const request: MessageCreateRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello!' },
        ],
      };

      const response = await client.messages.create(request);

      expect(response.security?.guardrailResult).toBeDefined();
      expect(response.security?.guardrailResult?.passed).toBe(true);
      expect(response.security?.costRecord).toBeDefined();
      expect(response.security?.costRecord?.actualCost).toBeGreaterThan(0);
    });

    it('should block on guardrail failure before incurring costs', async () => {
      // Create a failing guardrail
      class FailingGuardrail extends Guardrail {
        async evaluate(_input: string): Promise<GuardrailResult> {
          return new GuardrailResult({
            passed: false,
            action: 'block',
            reason: 'Blocked',
            riskScore: 95,
          });
        }
      }

      guardrailEngine.registerGuardrail(new FailingGuardrail({ name: 'failing' }));

      const client = new TealAnthropic({
        apiKey: 'test-key',
        agentId: 'test-agent',
        guardrailEngine,
        costTracker,
        costStorage: storage,
      });

      const request: MessageCreateRequest = {
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Dangerous!' },
        ],
      };

      await expect(client.messages.create(request)).rejects.toThrow();

      // Verify no cost was recorded
      const records = await storage.getByAgentId('test-agent');
      expect(records.length).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should get configuration', () => {
      const client = new TealAnthropic({
        apiKey: 'test-key',
        agentId: 'test-agent',
        baseURL: 'https://api.anthropic.com',
      });

      const config = client.getConfig();

      expect(config.apiKey).toBe('test-key');
      expect(config.agentId).toBe('test-agent');
      expect(config.baseURL).toBe('https://api.anthropic.com');
    });

    it('should update configuration', () => {
      const client = new TealAnthropic({
        apiKey: 'test-key',
      });

      client.updateConfig({
        agentId: 'new-agent',
        enableGuardrails: false,
      });

      const config = client.getConfig();

      expect(config.agentId).toBe('new-agent');
      expect(config.enableGuardrails).toBe(false);
    });
  });
});

