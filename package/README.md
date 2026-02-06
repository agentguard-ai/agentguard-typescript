# AgentGuard SDK

> Enterprise-grade security for AI agents - Runtime protection, policy enforcement, and comprehensive audit trails

[![npm version](https://badge.fury.io/js/agentguard-sdk.svg)](https://www.npmjs.com/package/agentguard-sdk)
[![npm downloads](https://img.shields.io/npm/dm/agentguard-sdk.svg)](https://www.npmjs.com/package/agentguard-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 🚀 Quick Start

```bash
npm install agentguard-sdk
```

```typescript
import { AgentGuard } from 'agentguard-sdk';

// Initialize the security client
const guard = new AgentGuard({
  apiKey: 'your-api-key',
  ssaUrl: 'https://ssa.agentguard.io'
});

// Secure your agent tool calls
const result = await guard.executeTool(
  'web-search',
  { query: 'AI agent security' },
  { sessionId: 'user-session-123' }
);

console.log('Secure result:', result.data);
console.log('Security decision:', result.securityDecision);
```

## ✨ Features

- 🛡️ **Runtime Security Enforcement** - Mediate all agent tool/API calls through security policies
- 📋 **Policy-Based Access Control** - Define and enforce security policies with ease
- 🔍 **Comprehensive Audit Trails** - Track every agent action with tamper-evident logs
- ⚡ **High Performance** - <100ms latency for security decisions
- 🔧 **TypeScript Support** - Full type definitions included
- 🎯 **Request Transformation** - Automatically transform risky requests into safer alternatives
- 🔐 **Zero-Trust Architecture** - Never trust, always verify
- 📊 **Real-time Monitoring** - Track agent behavior and security events

## 📖 Documentation

- [Getting Started Guide](https://github.com/agentguard/agentguard-sdk#getting-started)
- [API Reference](https://github.com/agentguard/agentguard-sdk/blob/main/docs/API.md)
- [Policy Configuration](https://github.com/agentguard/agentguard-sdk/blob/main/docs/POLICIES.md)
- [Examples](https://github.com/agentguard/agentguard-sdk/tree/main/examples)

## 🎯 Use Cases

### Secure AI Agent Tool Calls

```typescript
import { AgentGuard } from 'agentguard-sdk';

const guard = new AgentGuard({
  apiKey: process.env.AGENTGUARD_API_KEY,
  ssaUrl: 'https://ssa.agentguard.io'
});

// Execute tool with automatic security evaluation
const result = await guard.executeTool(
  'file-write',
  { 
    path: '/data/output.txt',
    content: 'Agent generated content'
  },
  {
    sessionId: 'agent-session-456',
    userId: 'user-123'
  }
);

if (result.success) {
  console.log('Tool executed securely:', result.data);
} else {
  console.error('Security policy blocked:', result.error);
}
```

### Policy Testing and Validation

```typescript
import { PolicyTester } from 'agentguard-sdk';

const tester = new PolicyTester();

// Test your policies before deployment
const testResult = await tester.testPolicy(
  myPolicy,
  {
    toolName: 'database-query',
    parameters: { query: 'SELECT * FROM users' }
  }
);

console.log('Policy decision:', testResult.decision);
console.log('Reasoning:', testResult.reason);
```

### Custom Policy Builder

```typescript
import { PolicyBuilder } from 'agentguard-sdk';

const policy = new PolicyBuilder()
  .name('restrict-file-operations')
  .description('Prevent file write operations')
  .addRule({
    condition: { toolName: 'file-write' },
    action: 'deny',
    reason: 'File write operations are not allowed'
  })
  .addRule({
    condition: { toolName: 'file-read' },
    action: 'allow',
    reason: 'File read operations are permitted'
  })
  .build();

console.log('Policy created:', policy);
```

## 🏗️ Architecture

AgentGuard SDK works with your Security Sidecar Agent (SSA) to provide comprehensive security:

```
┌─────────────┐
│  Your Agent │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ AgentGuard SDK  │  ◄── You are here
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Security Sidecar│
│     Agent       │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Policy Engine  │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│   Tool/API      │
└─────────────────┘
```

## 🔧 Configuration

### Basic Configuration

```typescript
const guard = new AgentGuard({
  apiKey: 'your-api-key',
  ssaUrl: 'https://ssa.agentguard.io',
  timeout: 5000,
  retries: 3
});
```

### Advanced Configuration

```typescript
const guard = new AgentGuard({
  apiKey: process.env.AGENTGUARD_API_KEY,
  ssaUrl: process.env.AGENTGUARD_SSA_URL,
  
  // Timeout settings
  timeout: 10000,
  retries: 3,
  retryDelay: 1000,
  
  // Logging
  logLevel: 'info',
  
  // Custom headers
  headers: {
    'X-Custom-Header': 'value'
  },
  
  // Callback hooks
  onSecurityDecision: (decision) => {
    console.log('Security decision made:', decision);
  },
  
  onError: (error) => {
    console.error('Security error:', error);
  }
});
```

## 📊 API Reference

### AgentGuard Class

#### `executeTool(toolName, parameters, context, executor?)`

Execute a tool with security evaluation.

**Parameters:**
- `toolName` (string): Name of the tool to execute
- `parameters` (object): Tool parameters
- `context` (object): Execution context (sessionId, userId, etc.)
- `executor` (function, optional): Custom executor function

**Returns:** `Promise<ExecutionResult>`

```typescript
interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: Error;
  securityDecision: SecurityDecision;
  metadata: {
    executionTime: number;
    timestamp: Date;
  };
}
```

### PolicyBuilder Class

Build security policies programmatically.

```typescript
const policy = new PolicyBuilder()
  .name('my-policy')
  .description('Policy description')
  .addRule(rule)
  .build();
```

### PolicyTester Class

Test policies before deployment.

```typescript
const tester = new PolicyTester();
const result = await tester.testPolicy(policy, request);
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/agentguard/agentguard-sdk.git
cd agentguard-sdk

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build
```

## 📝 Examples

Check out our [examples directory](./examples) for complete working examples:

- [Basic Usage](./examples/basic-usage.js) - Simple tool execution
- [Advanced Usage](./examples/advanced-usage.ts) - Advanced features and configuration
- [Policy Utilities](./examples/policy-utilities.js) - Policy building and testing

## 🔒 Security

Security is our top priority. If you discover a security vulnerability, please email agentguard@proton.me instead of using the issue tracker.

See [SECURITY.md](SECURITY.md) for more details.

## 📄 License

MIT © AgentGuard

See [LICENSE](LICENSE) for details.

## 🌟 Why AgentGuard?

### The Problem

AI agents are powerful but pose significant security risks:
- Unrestricted access to tools and APIs
- No audit trail of agent actions
- Difficult to enforce security policies
- Hard to debug agent behavior

### The Solution

AgentGuard provides:
- ✅ **Runtime Security** - Every tool call is evaluated before execution
- ✅ **Policy Enforcement** - Define what agents can and cannot do
- ✅ **Audit Trails** - Complete visibility into agent actions
- ✅ **Request Transformation** - Automatically make risky requests safer
- ✅ **Zero-Trust** - Never trust, always verify

## 🚀 Roadmap

- [x] Core SDK with policy enforcement
- [x] TypeScript support
- [x] Comprehensive test suite
- [x] Drop-in client wrappers (GuardedOpenAI, GuardedAnthropic)
- [ ] Built-in guardrails library
- [ ] Cost monitoring and budget enforcement
- [ ] Visual policy management UI
- [ ] Real-time monitoring dashboard

See our [full roadmap](https://github.com/agentguard-ai/agentguard-sdk/issues) for more details.

## 💬 Community

- [GitHub Discussions](https://github.com/agentguard-ai/agentguard-sdk/discussions) - Ask questions and share ideas
- [GitHub Issues](https://github.com/agentguard-ai/agentguard-sdk/issues) - Report bugs and request features
- [Email](mailto:agentguard@proton.me) - Direct contact

## 📈 Stats

![GitHub stars](https://img.shields.io/github/stars/agentguard-ai/agentguard-sdk?style=social)
![GitHub forks](https://img.shields.io/github/forks/agentguard-ai/agentguard-sdk?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/agentguard-ai/agentguard-sdk?style=social)

---

**Built with ❤️ by the AgentGuard team**

[GitHub](https://github.com/agentguard-ai/agentguard-sdk) • [npm](https://www.npmjs.com/package/agentguard-sdk) • [Email](mailto:agentguard@proton.me)
