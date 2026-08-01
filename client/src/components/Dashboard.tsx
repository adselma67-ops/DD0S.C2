import React, { useEffect, useState } from 'react';

const Dashboard: React.FC = () => {
    const [agentStatus, setAgentStatus] = useState([]);
    const [liveMetrics, setLiveMetrics] = useState({});
    const [activityLog, setActivityLog] = useState([]);

    useEffect(() => {
        // Simulate fetching agent status
        const fetchAgentStatus = () => {
            const simulatedStatus = [
                { id: 1, name: 'Agent 1', status: 'Active' },
                { id: 2, name: 'Agent 2', status: 'Inactive' },
            ];
            setAgentStatus(simulatedStatus);
        };

        // Simulate fetching live metrics
        const fetchLiveMetrics = () => {
            const simulatedMetrics = {
                requestsPerSecond: Math.floor(Math.random() * 100),
                errorRate: Math.random().toFixed(2),
            };
            setLiveMetrics(simulatedMetrics);
        };

        // Simulate fetching activity log
        const fetchActivityLog = () => {
            const simulatedLog = [
                'Simulation started at 10:00 AM',
                'Agent 1 responded at 10:01 AM',
                'Agent 2 failed at 10:02 AM',
            ];
            setActivityLog(simulatedLog);
        };

        fetchAgentStatus();
        fetchLiveMetrics();
        fetchActivityLog();

        const interval = setInterval(() => {
            fetchLiveMetrics();
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div>
            <h1>Traffic Resilience Dashboard</h1>
            <section>
                <h2>Agent Status</h2>
                <ul>
                    {agentStatus.map(agent => (
                        <li key={agent.id}>{agent.name}: {agent.status}</li>
                    ))}
                </ul>
            </section>
            <section>
                <h2>Live Metrics</h2>
                <p>Requests per second: {liveMetrics.requestsPerSecond}</p>
                <p>Error rate: {liveMetrics.errorRate}</p>
            </section>
            <section>
                <h2>Activity Log</h2>
                <ul>
                    {activityLog.map((log, index) => (
                        <li key={index}>{log}</li>
                    ))}
                </ul>
            </section>
        </div>
    );
};

export default Dashboard;