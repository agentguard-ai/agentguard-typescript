/**
 * Cost Tracking Demo
 * 
 * Demonstrates how to use the cost tracking and budget management features
 */

import {
  CostTracker,
  BudgetManager,
  InMemoryCostStorage,
  CostTrackerConfig,
  BudgetConfig,
} from '../src/cost';

// Initialize storage
const storage = new InMemoryCostStorage();

// Initialize cost tracker
const trackerConfig: CostTrackerConfig = {
  enabled: true,
  persistRecords: true,
  enableBudgets: true,
  enableAlerts: true,
};

const tracker = new CostTracker(trackerConfig);

// Initialize budget manager
const budgetManager = new BudgetManager(storage);

async function demonstrateCostTracking() {
  console.log('=== Cost Tracking Demo ===\n');

  // 1. Estimate cost before making a request
  console.log('1. Estimating cost for GPT-4 request...');
  const estimate = tracker.estimateCost(
    'gpt-4',
    {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
    },
    'openai'
  );

  console.log(`   Estimated cost: $${estimate.estimatedCost.toFixed(4)}`);
  console.log(`   Input cost: $${estimate.breakdown.inputCost.toFixed(4)}`);
  console.log(`   Output cost: $${estimate.breakdown.outputCost.toFixed(4)}\n`);

  // 2. Calculate actual cost after request
  console.log('2. Calculating actual cost...');
  const actualCost = tracker.calculateActualCost(
    'req-123',
    'agent-456',
    'gpt-4',
    {
      inputTokens: 1050,
      outputTokens: 480,
      totalTokens: 1530,
    },
    'openai'
  );

  console.log(`   Actual cost: $${actualCost.actualCost.toFixed(4)}`);
  console.log(`   Cost record ID: ${actualCost.id}\n`);

  // 3. Store the cost record
  await storage.store(actualCost);
  console.log('3. Cost record stored successfully\n');

  // 4. Query costs by agent
  console.log('4. Querying costs by agent...');
  const agentCosts = await storage.getByAgentId('agent-456');
  console.log(`   Found ${agentCosts.length} cost records for agent-456`);
  console.log(`   Total cost: $${agentCosts.reduce((sum, r) => sum + r.actualCost, 0).toFixed(4)}\n`);
}

async function demonstrateBudgetManagement() {
  console.log('=== Budget Management Demo ===\n');

  // 1. Create a daily budget
  console.log('1. Creating daily budget...');
  const budget = budgetManager.createBudget({
    name: 'Daily GPT-4 Budget',
    limit: 10.0,
    period: 'daily',
    alertThresholds: [50, 75, 90, 100],
    action: 'alert',
    enabled: true,
  });

  console.log(`   Budget created: ${budget.name}`);
  console.log(`   Limit: $${budget.limit}`);
  console.log(`   Period: ${budget.period}`);
  console.log(`   Alert thresholds: ${budget.alertThresholds.join('%, ')}%\n`);

  // 2. Check budget before making a request
  console.log('2. Checking budget before request...');
  const estimate = tracker.estimateCost(
    'gpt-4',
    {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
    },
    'openai'
  );

  const budgetCheck = await budgetManager.checkBudget('agent-789', estimate.estimatedCost);

  if (budgetCheck.allowed) {
    console.log('   ✓ Request allowed - within budget');
  } else {
    console.log('   ✗ Request blocked - budget exceeded');
    console.log(`   Blocked by: ${budgetCheck.blockedBy?.name}`);
  }

  if (budgetCheck.alerts.length > 0) {
    console.log(`   ⚠ ${budgetCheck.alerts.length} alert(s) generated:`);
    budgetCheck.alerts.forEach(alert => {
      console.log(`     - ${alert.severity.toUpperCase()}: ${alert.message}`);
    });
  }
  console.log();

  // 3. Simulate some spending
  console.log('3. Simulating API requests...');
  for (let i = 0; i < 5; i++) {
    const cost = tracker.calculateActualCost(
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

    await storage.store(cost);
    await budgetManager.recordCost(cost);
    console.log(`   Request ${i + 1}: $${cost.actualCost.toFixed(4)}`);
  }
  console.log();

  // 4. Check budget status
  console.log('4. Checking budget status...');
  const status = await budgetManager.getBudgetStatus(budget.id);

  if (status) {
    console.log(`   Current spending: $${status.currentSpending.toFixed(4)}`);
    console.log(`   Remaining: $${status.remaining.toFixed(4)}`);
    console.log(`   Percentage used: ${status.percentageUsed.toFixed(2)}%`);
    console.log(`   Is exceeded: ${status.isExceeded ? 'Yes' : 'No'}`);
    
    if (status.activeAlerts.length > 0) {
      console.log(`   Active alerts: ${status.activeAlerts.join('%, ')}%`);
    }
  }
  console.log();

  // 5. Get all alerts
  console.log('5. Checking alerts...');
  const alerts = budgetManager.getAlerts(budget.id);
  console.log(`   Total alerts: ${alerts.length}`);
  
  alerts.forEach((alert, index) => {
    console.log(`   Alert ${index + 1}:`);
    console.log(`     - Threshold: ${alert.threshold}%`);
    console.log(`     - Severity: ${alert.severity}`);
    console.log(`     - Message: ${alert.message}`);
    console.log(`     - Acknowledged: ${alert.acknowledged ? 'Yes' : 'No'}`);
  });
  console.log();
}

async function demonstrateAgentScopedBudgets() {
  console.log('=== Agent-Scoped Budgets Demo ===\n');

  // 1. Create agent-specific budgets
  console.log('1. Creating agent-specific budgets...');
  
  const budget1 = budgetManager.createBudget({
    name: 'Agent 1 Budget',
    limit: 5.0,
    period: 'daily',
    alertThresholds: [80, 100],
    action: 'block',
    scope: {
      type: 'agent',
      id: 'agent-1',
    },
    enabled: true,
  });

  const budget2 = budgetManager.createBudget({
    name: 'Agent 2 Budget',
    limit: 10.0,
    period: 'daily',
    alertThresholds: [80, 100],
    action: 'block',
    scope: {
      type: 'agent',
      id: 'agent-2',
    },
    enabled: true,
  });

  console.log(`   Created budget for agent-1: $${budget1.limit} limit`);
  console.log(`   Created budget for agent-2: $${budget2.limit} limit\n`);

  // 2. Make requests for both agents
  console.log('2. Making requests for both agents...');
  
  // Agent 1 makes 3 requests
  for (let i = 0; i < 3; i++) {
    const cost = tracker.calculateActualCost(
      `agent1-req-${i}`,
      'agent-1',
      'gpt-4',
      {
        inputTokens: 2000,
        outputTokens: 1000,
        totalTokens: 3000,
      },
      'openai'
    );
    await storage.store(cost);
    await budgetManager.recordCost(cost);
  }
  console.log('   Agent 1: Made 3 requests');

  // Agent 2 makes 1 request
  const cost2 = tracker.calculateActualCost(
    'agent2-req-1',
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
  console.log('   Agent 2: Made 1 request\n');

  // 3. Check budget status for each agent
  console.log('3. Checking budget status...');
  
  const status1 = await budgetManager.getBudgetStatus(budget1.id);
  const status2 = await budgetManager.getBudgetStatus(budget2.id);

  console.log(`   Agent 1:`);
  console.log(`     - Spending: $${status1?.currentSpending.toFixed(4)}`);
  console.log(`     - Percentage: ${status1?.percentageUsed.toFixed(2)}%`);
  console.log(`     - Exceeded: ${status1?.isExceeded ? 'Yes' : 'No'}`);

  console.log(`   Agent 2:`);
  console.log(`     - Spending: $${status2?.currentSpending.toFixed(4)}`);
  console.log(`     - Percentage: ${status2?.percentageUsed.toFixed(2)}%`);
  console.log(`     - Exceeded: ${status2?.isExceeded ? 'Yes' : 'No'}`);
  console.log();
}

async function demonstrateMultiModelSupport() {
  console.log('=== Multi-Model Support Demo ===\n');

  console.log('1. Comparing costs across different models...\n');

  const models = [
    { name: 'GPT-4', model: 'gpt-4', provider: 'openai' as const },
    { name: 'GPT-3.5 Turbo', model: 'gpt-3.5-turbo', provider: 'openai' as const },
    { name: 'Claude 3 Opus', model: 'claude-3-opus-20240229', provider: 'anthropic' as const },
    { name: 'Claude 3 Sonnet', model: 'claude-3-sonnet-20240229', provider: 'anthropic' as const },
  ];

  const tokens = {
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
  };

  models.forEach(({ name, model, provider }) => {
    const estimate = tracker.estimateCost(model, tokens, provider);
    console.log(`   ${name}:`);
    console.log(`     - Estimated cost: $${estimate.estimatedCost.toFixed(4)}`);
    console.log(`     - Input cost: $${estimate.breakdown.inputCost.toFixed(4)}`);
    console.log(`     - Output cost: $${estimate.breakdown.outputCost.toFixed(4)}`);
    console.log();
  });
}

async function demonstrateCustomPricing() {
  console.log('=== Custom Pricing Demo ===\n');

  console.log('1. Adding custom pricing for a model...');
  
  // Add custom pricing for a hypothetical model
  tracker.addCustomPricing('custom-model-v1', {
    model: 'custom-model-v1',
    provider: 'custom',
    inputCostPer1K: 0.01,
    outputCostPer1K: 0.02,
    lastUpdated: new Date().toISOString(),
  });

  console.log('   Custom pricing added for custom-model-v1\n');

  // Estimate cost with custom pricing
  console.log('2. Estimating cost with custom pricing...');
  const estimate = tracker.estimateCost(
    'custom-model-v1',
    {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
    }
  );

  console.log(`   Estimated cost: $${estimate.estimatedCost.toFixed(4)}`);
  console.log(`   Input cost: $${estimate.breakdown.inputCost.toFixed(4)}`);
  console.log(`   Output cost: $${estimate.breakdown.outputCost.toFixed(4)}\n`);
}

// Run all demos
async function main() {
  try {
    await demonstrateCostTracking();
    await demonstrateBudgetManagement();
    await demonstrateAgentScopedBudgets();
    await demonstrateMultiModelSupport();
    await demonstrateCustomPricing();

    console.log('=== Demo Complete ===');
  } catch (error) {
    console.error('Error running demo:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main };
