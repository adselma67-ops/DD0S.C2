export interface TrafficSimulation {
    id: string;
    name: string;
    status: 'running' | 'stopped' | 'paused';
    load: number; // Represents the load percentage
    duration: number; // Duration of the simulation in seconds
}

export interface AgentStatus {
    id: string;
    name: string;
    isActive: boolean;
    responseTime: number; // Response time in milliseconds
    errorRate: number; // Percentage of errors
}

export interface LoadTestResult {
    simulationId: string;
    timestamp: Date;
    metrics: {
        averageResponseTime: number;
        maxResponseTime: number;
        minResponseTime: number;
        totalRequests: number;
        successfulRequests: number;
        failedRequests: number;
    };
}