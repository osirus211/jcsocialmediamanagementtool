import { getRedisClientSafe, isRedisHealthy, getCircuitBreakerStatus } from '../config/redis';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

/**
 * Health Check Service
 * 
 * Provides comprehensive health checks for all system components
 * Used by load balancers and monitoring systems
 */

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  components: {
    redis: ComponentHealth;
    mongodb: ComponentHealth;
    workers: ComponentHealth;
    memory: ComponentHealth;
  };
  details?: any;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  responseTime?: number;
  details?: any;
}

export class HealthCheckService {
  private static instance: HealthCheckService;

  static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  /**
   * Perform comprehensive health check
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const [redis, mongodb, workers, memory] = await Promise.all([
        this.checkRedis(),
        this.checkMongoDB(),
        this.checkWorkers(),
        this.checkMemory(),
      ]);

      // Determine overall status
      const components = { redis, mongodb, workers, memory };
      const overallStatus = this.determineOverallStatus(components);

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        version: process.env.npm_package_version || '1.0.0',
        components,
        details: {
          responseTime: Date.now() - startTime,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      };
    } catch (error: any) {
      logger.error('Health check failed', { error: error.message });
      
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        version: process.env.npm_package_version || '1.0.0',
        components: {
          redis: { status: 'unhealthy', message: 'Health check failed' },
          mongodb: { status: 'unhealthy', message: 'Health check failed' },
          workers: { status: 'unhealthy', message: 'Health check failed' },
          memory: { status: 'unhealthy', message: 'Health check failed' },
        },
        details: {
          error: error.message,
          responseTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Check Redis health with circuit breaker status
   */
  private async checkRedis(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const redis = getRedisClientSafe();
      
      if (!redis) {
        const circuitStatus = getCircuitBreakerStatus();
        return {
          status: 'unhealthy',
          message: `Redis unavailable - circuit breaker ${circuitStatus.state}`,
          responseTime: Date.now() - startTime,
          details: circuitStatus,
        };
      }

      // Test Redis connection with timeout
      await Promise.race([
        redis.ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis ping timeout')), 2000)
        )
      ]);

      const isHealthy = isRedisHealthy();
      const circuitStatus = getCircuitBreakerStatus();

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        message: isHealthy ? 'Connected' : `Degraded - circuit breaker ${circuitStatus.state}`,
        responseTime: Date.now() - startTime,
        details: {
          circuitBreaker: circuitStatus,
          connected: true,
        },
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: error.message,
        responseTime: Date.now() - startTime,
        details: {
          error: error.message,
          circuitBreaker: getCircuitBreakerStatus(),
        },
      };
    }
  }

  /**
   * Check MongoDB health
   */
  private async checkMongoDB(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // In VALIDATION_MODE, MongoDB is intentionally skipped
      if (process.env.VALIDATION_MODE === 'true') {
        return {
          status: 'healthy',
          message: 'Skipped (VALIDATION_MODE)',
          responseTime: Date.now() - startTime,
          details: {
            validationMode: true,
            note: 'MongoDB connection skipped for validation testing',
          },
        };
      }

      // Check connection state
      if (mongoose.connection.readyState !== 1) {
        return {
          status: 'unhealthy',
          message: `MongoDB not connected (state: ${mongoose.connection.readyState})`,
          responseTime: Date.now() - startTime,
          details: {
            readyState: mongoose.connection.readyState,
            states: {
              0: 'disconnected',
              1: 'connected',
              2: 'connecting',
              3: 'disconnecting',
            },
          },
        };
      }

      // Test database operation with timeout
      await Promise.race([
        mongoose.connection.db.admin().ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('MongoDB ping timeout')), 2000)
        )
      ]);

      return {
        status: 'healthy',
        message: 'Connected',
        responseTime: Date.now() - startTime,
        details: {
          readyState: mongoose.connection.readyState,
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name,
        },
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: error.message,
        responseTime: Date.now() - startTime,
        details: {
          error: error.message,
          readyState: mongoose.connection.readyState,
        },
      };
    }
  }

  /**
   * Check worker health (placeholder - will be enhanced when workers have heartbeats)
   */
  private async checkWorkers(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // For now, just check if QueueManager is available
      const { QueueManager } = await import('../queue/QueueManager');
      const queueManager = QueueManager.getInstance();
      
      if (queueManager.isShutdown()) {
        return {
          status: 'unhealthy',
          message: 'Queue manager is shutting down',
          responseTime: Date.now() - startTime,
        };
      }

      // Get worker health status
      const workerHealth = queueManager.getWorkerHealth();
      const workerCount = Object.keys(workerHealth).length;
      
      if (workerCount === 0) {
        return {
          status: 'degraded',
          message: 'No workers running',
          responseTime: Date.now() - startTime,
          details: { workerCount: 0 },
        };
      }

      // Check if any workers are not running
      const unhealthyWorkers = Object.entries(workerHealth)
        .filter(([_, health]: [string, any]) => !health.isRunning)
        .map(([name]) => name);

      if (unhealthyWorkers.length > 0) {
        return {
          status: 'degraded',
          message: `${unhealthyWorkers.length} workers not running`,
          responseTime: Date.now() - startTime,
          details: {
            workerCount,
            unhealthyWorkers,
            workerHealth,
          },
        };
      }

      return {
        status: 'healthy',
        message: `${workerCount} workers running`,
        responseTime: Date.now() - startTime,
        details: {
          workerCount,
          workerHealth,
        },
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: error.message,
        responseTime: Date.now() - startTime,
        details: {
          error: error.message,
        },
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const memoryUsage = process.memoryUsage();
      const totalMemoryMB = Math.round(memoryUsage.rss / 1024 / 1024);
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
      
      // Memory thresholds (in MB)
      const WARNING_THRESHOLD = 512; // 512MB
      const CRITICAL_THRESHOLD = 1024; // 1GB
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = `Memory usage: ${totalMemoryMB}MB`;
      
      if (totalMemoryMB > CRITICAL_THRESHOLD) {
        status = 'unhealthy';
        message = `High memory usage: ${totalMemoryMB}MB (critical threshold: ${CRITICAL_THRESHOLD}MB)`;
      } else if (totalMemoryMB > WARNING_THRESHOLD) {
        status = 'degraded';
        message = `Elevated memory usage: ${totalMemoryMB}MB (warning threshold: ${WARNING_THRESHOLD}MB)`;
      }

      return {
        status,
        message,
        responseTime: Date.now() - startTime,
        details: {
          rss: totalMemoryMB,
          heapUsed: heapUsedMB,
          heapTotal: heapTotalMB,
          external: Math.round(memoryUsage.external / 1024 / 1024),
          arrayBuffers: Math.round((memoryUsage as any).arrayBuffers / 1024 / 1024),
          thresholds: {
            warning: WARNING_THRESHOLD,
            critical: CRITICAL_THRESHOLD,
          },
        },
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: error.message,
        responseTime: Date.now() - startTime,
        details: {
          error: error.message,
        },
      };
    }
  }

  /**
   * Determine overall system status based on component health
   */
  private determineOverallStatus(components: Record<string, ComponentHealth>): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(components).map(c => c.status);
    
    // If any component is unhealthy, system is unhealthy
    if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    }
    
    // If any component is degraded, system is degraded
    if (statuses.includes('degraded')) {
      return 'degraded';
    }
    
    // All components healthy
    return 'healthy';
  }

  /**
   * Simple health check (just returns 200/503)
   */
  async isHealthy(): Promise<boolean> {
    try {
      const status = await this.getHealthStatus();
      return status.status !== 'unhealthy';
    } catch {
      return false;
    }
  }
}

export const healthCheckService = HealthCheckService.getInstance();