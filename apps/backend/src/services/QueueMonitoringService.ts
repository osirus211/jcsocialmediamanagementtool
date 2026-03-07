/**
 * Queue Monitoring Service
 * 
 * Monitors queue health and triggers alerts
 * 
 * Features:
 * - Monitor all queues
 * - Collect statistics
 * - Alert on thresholds
 * - Historical tracking
 */

import { logger } from '../utils/logger';
import { QueueManager } from '../queue/QueueManager';

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
  completed: number;
  failureRate: number;
  health: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
}

export interface AlertCondition {
  name: string;
  check: (stats: QueueStats[]) => boolean;
  message: (stats: QueueStats[]) => string;
  severity: 'warning' | 'error' | 'critical';
}

export class QueueMonitoringService {
  private static instance: QueueMonitoringService;
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;
  private queueNames: string[] = [
    'posting-queue',
    'scheduler-queue',
  ];
  
  // Alert thresholds
  private readonly THRESHOLDS = {
    HIGH_BACKLOG: 1000,
    HIGH_FAILURE_RATE: 5, // percent
    STALLED_DURATION: 5 * 60 * 1000, // 5 minutes
  };
  
  // Historical metrics
  private metricsHistory: Map<string, QueueStats[]> = new Map();
  private readonly MAX_HISTORY_SIZE = 100;
  
  // Alert tracking (prevent spam)
  private lastAlerts: Map<string, Date> = new Map();
  private readonly ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): QueueMonitoringService {
    if (!QueueMonitoringService.instance) {
      QueueMonitoringService.instance = new QueueMonitoringService();
    }
    return QueueMonitoringService.instance;
  }

  /**
   * Start monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      logger.warn('Queue monitoring already running');
      return;
    }
    
    this.isMonitoring = true;
    
    logger.info('Starting queue monitoring', {
      interval: intervalMs,
      queues: this.queueNames,
    });
    
    // Run immediately
    this.collectMetrics().catch(error => {
      logger.error('Error collecting initial metrics', { error: error.message });
    });
    
    // Then run periodically
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics().catch(error => {
        logger.error('Error collecting metrics', { error: error.message });
      });
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      logger.warn('Queue monitoring not running');
      return;
    }
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    
    logger.info('Queue monitoring stopped');
  }

  /**
   * Collect metrics from all queues
   */
  private async collectMetrics(): Promise<void> {
    const queueManager = QueueManager.getInstance();
    const allStats: QueueStats[] = [];
    
    for (const queueName of this.queueNames) {
      try {
        const stats = await queueManager.getQueueStats(queueName);
        
        const queueStats: QueueStats = {
          name: queueName,
          waiting: stats.waiting,
          active: stats.active,
          failed: stats.failed,
          delayed: stats.delayed,
          completed: stats.completed,
          failureRate: parseFloat(stats.failureRate),
          health: stats.health,
          timestamp: new Date(),
        };
        
        allStats.push(queueStats);
        
        // Store in history
        this.addToHistory(queueName, queueStats);
        
        // Log metrics
        logger.info('Queue metrics', {
          queue: queueName,
          waiting: queueStats.waiting,
          active: queueStats.active,
          failed: queueStats.failed,
          delayed: queueStats.delayed,
          completed: queueStats.completed,
          failureRate: queueStats.failureRate,
          health: queueStats.health,
        });
      } catch (error: any) {
        logger.error('Error collecting queue metrics', {
          queue: queueName,
          error: error.message,
        });
      }
    }
    
    // Check alert conditions
    this.checkAlertConditions(allStats);
  }

  /**
   * Add stats to history
   */
  private addToHistory(queueName: string, stats: QueueStats): void {
    if (!this.metricsHistory.has(queueName)) {
      this.metricsHistory.set(queueName, []);
    }
    
    const history = this.metricsHistory.get(queueName)!;
    history.push(stats);
    
    // Keep only last N entries
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift();
    }
  }

  /**
   * Check alert conditions
   */
  private checkAlertConditions(allStats: QueueStats[]): void {
    const conditions: AlertCondition[] = [
      {
        name: 'high_queue_backlog',
        check: (stats) => stats.some(s => s.waiting > this.THRESHOLDS.HIGH_BACKLOG),
        message: (stats) => {
          const queue = stats.find(s => s.waiting > this.THRESHOLDS.HIGH_BACKLOG);
          return `High queue backlog: ${queue?.name} has ${queue?.waiting} waiting jobs`;
        },
        severity: 'warning',
      },
      {
        name: 'high_failure_rate',
        check: (stats) => stats.some(s => s.failureRate > this.THRESHOLDS.HIGH_FAILURE_RATE),
        message: (stats) => {
          const queue = stats.find(s => s.failureRate > this.THRESHOLDS.HIGH_FAILURE_RATE);
          return `High failure rate: ${queue?.name} has ${queue?.failureRate}% failure rate`;
        },
        severity: 'error',
      },
      {
        name: 'queue_unhealthy',
        check: (stats) => stats.some(s => s.health === 'unhealthy'),
        message: (stats) => {
          const queue = stats.find(s => s.health === 'unhealthy');
          return `Queue unhealthy: ${queue?.name}`;
        },
        severity: 'critical',
      },
    ];
    
    for (const condition of conditions) {
      if (condition.check(allStats)) {
        this.triggerAlert(condition, allStats);
      }
    }
  }

  /**
   * Trigger alert
   */
  private triggerAlert(condition: AlertCondition, stats: QueueStats[]): void {
    // Check cooldown
    const lastAlert = this.lastAlerts.get(condition.name);
    if (lastAlert) {
      const timeSinceLastAlert = Date.now() - lastAlert.getTime();
      if (timeSinceLastAlert < this.ALERT_COOLDOWN) {
        return; // Skip alert (cooldown)
      }
    }
    
    // Log alert
    const message = condition.message(stats);
    
    logger.warn('Alert triggered', {
      alert: condition.name,
      severity: condition.severity,
      message,
      timestamp: new Date().toISOString(),
      queues: stats.map(s => ({
        name: s.name,
        waiting: s.waiting,
        active: s.active,
        failed: s.failed,
        failureRate: s.failureRate,
        health: s.health,
      })),
    });
    
    // Update last alert time
    this.lastAlerts.set(condition.name, new Date());
  }

  /**
   * Get current stats for all queues
   */
  async getAllQueueStats(): Promise<QueueStats[]> {
    const queueManager = QueueManager.getInstance();
    const allStats: QueueStats[] = [];
    
    for (const queueName of this.queueNames) {
      try {
        const stats = await queueManager.getQueueStats(queueName);
        
        allStats.push({
          name: queueName,
          waiting: stats.waiting,
          active: stats.active,
          failed: stats.failed,
          delayed: stats.delayed,
          completed: stats.completed,
          failureRate: parseFloat(stats.failureRate),
          health: stats.health,
          timestamp: new Date(),
        });
      } catch (error: any) {
        logger.error('Error getting queue stats', {
          queue: queueName,
          error: error.message,
        });
      }
    }
    
    return allStats;
  }

  /**
   * Get stats for specific queue
   */
  async getQueueStats(queueName: string): Promise<QueueStats | null> {
    try {
      const queueManager = QueueManager.getInstance();
      const stats = await queueManager.getQueueStats(queueName);
      
      return {
        name: queueName,
        waiting: stats.waiting,
        active: stats.active,
        failed: stats.failed,
        delayed: stats.delayed,
        completed: stats.completed,
        failureRate: parseFloat(stats.failureRate),
        health: stats.health,
        timestamp: new Date(),
      };
    } catch (error: any) {
      logger.error('Error getting queue stats', {
        queue: queueName,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get historical metrics for queue
   */
  getHistory(queueName: string): QueueStats[] {
    return this.metricsHistory.get(queueName) || [];
  }

  /**
   * Get all historical metrics
   */
  getAllHistory(): Map<string, QueueStats[]> {
    return new Map(this.metricsHistory);
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.metricsHistory.clear();
    logger.info('Queue metrics history cleared');
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    isMonitoring: boolean;
    queues: string[];
    historySize: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      queues: this.queueNames,
      historySize: Array.from(this.metricsHistory.values())
        .reduce((sum, history) => sum + history.length, 0),
    };
  }
}

export const queueMonitoringService = QueueMonitoringService.getInstance();
