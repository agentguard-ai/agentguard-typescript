/**
 * Cost Storage
 * 
 * Persists and retrieves cost records for analytics and reporting
 */

import { CostRecord, CostSummary, ModelProvider } from './types';

/**
 * Storage interface for cost records
 */
export interface ICostStorage {
  /**
   * Store a cost record
   * @param record Cost record to store
   */
  store(record: CostRecord): Promise<void>;

  /**
   * Get a cost record by ID
   * @param id Record ID
   * @returns Cost record or undefined
   */
  get(id: string): Promise<CostRecord | undefined>;

  /**
   * Get cost records by request ID
   * @param requestId Request ID
   * @returns Array of cost records
   */
  getByRequestId(requestId: string): Promise<CostRecord[]>;

  /**
   * Get cost records by agent ID
   * @param agentId Agent ID
   * @param startDate Optional start date filter
   * @param endDate Optional end date filter
   * @returns Array of cost records
   */
  getByAgentId(agentId: string, startDate?: Date, endDate?: Date): Promise<CostRecord[]>;

  /**
   * Get cost records within a time range
   * @param startDate Start date
   * @param endDate End date
   * @returns Array of cost records
   */
  getByDateRange(startDate: Date, endDate: Date): Promise<CostRecord[]>;

  /**
   * Get cost summary for a time period
   * @param startDate Start date
   * @param endDate End date
   * @param agentId Optional agent ID filter
   * @returns Cost summary
   */
  getSummary(startDate: Date, endDate: Date, agentId?: string): Promise<CostSummary>;

  /**
   * Delete cost records older than a date
   * @param beforeDate Date threshold
   * @returns Number of records deleted
   */
  deleteOlderThan(beforeDate: Date): Promise<number>;

  /**
   * Clear all cost records
   */
  clear(): Promise<void>;
}

/**
 * In-memory cost storage implementation
 * For production, use database-backed storage
 */
export class InMemoryCostStorage implements ICostStorage {
  private records: Map<string, CostRecord>;

  constructor() {
    this.records = new Map();
  }

  async store(record: CostRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async get(id: string): Promise<CostRecord | undefined> {
    return this.records.get(id);
  }

  async getByRequestId(requestId: string): Promise<CostRecord[]> {
    return Array.from(this.records.values()).filter(r => r.requestId === requestId);
  }

  async getByAgentId(
    agentId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<CostRecord[]> {
    let records = Array.from(this.records.values()).filter(r => r.agentId === agentId);

    if (startDate) {
      records = records.filter(r => new Date(r.timestamp) >= startDate);
    }

    if (endDate) {
      records = records.filter(r => new Date(r.timestamp) <= endDate);
    }

    return records;
  }

  async getByDateRange(startDate: Date, endDate: Date): Promise<CostRecord[]> {
    return Array.from(this.records.values()).filter(r => {
      const timestamp = new Date(r.timestamp);
      return timestamp >= startDate && timestamp <= endDate;
    });
  }

  async getSummary(startDate: Date, endDate: Date, agentId?: string): Promise<CostSummary> {
    let records = await this.getByDateRange(startDate, endDate);

    if (agentId) {
      records = records.filter(r => r.agentId === agentId);
    }

    // Calculate totals
    const totalCost = records.reduce((sum, r) => sum + r.actualCost, 0);
    const totalRequests = records.length;
    const averageCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0;

    // Breakdown by model
    const byModel: Record<string, number> = {};
    records.forEach(r => {
      byModel[r.model] = (byModel[r.model] || 0) + r.actualCost;
    });

    // Breakdown by provider
    const byProvider: Record<ModelProvider, number> = {} as Record<ModelProvider, number>;
    records.forEach(r => {
      byProvider[r.provider] = (byProvider[r.provider] || 0) + r.actualCost;
    });

    // Breakdown by agent
    const byAgent: Record<string, number> = {};
    records.forEach(r => {
      byAgent[r.agentId] = (byAgent[r.agentId] || 0) + r.actualCost;
    });

    // Total tokens
    const totalTokens = {
      input: records.reduce((sum, r) => sum + r.actualTokens.inputTokens, 0),
      output: records.reduce((sum, r) => sum + r.actualTokens.outputTokens, 0),
      total: records.reduce((sum, r) => sum + r.actualTokens.totalTokens, 0),
    };

    return {
      totalCost,
      totalRequests,
      averageCostPerRequest,
      byModel,
      byProvider,
      byAgent,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      totalTokens,
    };
  }

  async deleteOlderThan(beforeDate: Date): Promise<number> {
    let deletedCount = 0;
    for (const [id, record] of this.records.entries()) {
      if (new Date(record.timestamp) < beforeDate) {
        this.records.delete(id);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  async clear(): Promise<void> {
    this.records.clear();
  }

  /**
   * Get total number of records
   * @returns Record count
   */
  size(): number {
    return this.records.size;
  }
}

/**
 * Create a cost storage instance
 * @param type Storage type ('memory' or 'database')
 * @returns Cost storage instance
 */
export function createCostStorage(type: 'memory' | 'database' = 'memory'): ICostStorage {
  if (type === 'database') {
    // TODO: Implement database-backed storage
    throw new Error('Database storage not yet implemented. Use "memory" for now.');
  }

  return new InMemoryCostStorage();
}
