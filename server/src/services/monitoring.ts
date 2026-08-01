import { AgentStatus } from '../types';

let agents: AgentStatus[] = [];

export const addAgent = (agent: AgentStatus) => {
    agents.push(agent);
};

export const removeAgent = (agentId: string) => {
    agents = agents.filter(agent => agent.id !== agentId);
};

export const getAgents = () => {
    return agents;
};

export const updateAgentStatus = (agentId: string, status: string) => {
    const agent = agents.find(agent => agent.id === agentId);
    if (agent) {
        agent.status = status;
    }
};