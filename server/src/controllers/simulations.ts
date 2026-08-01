import { Request, Response } from 'express';

let simulations: any[] = [];

export const startSimulation = (req: Request, res: Response) => {
    const { simulationId, load, duration } = req.body;
    const newSimulation = { simulationId, load, duration, status: 'running' };
    simulations.push(newSimulation);
    res.status(201).json(newSimulation);
};

export const stopSimulation = (req: Request, res: Response) => {
    const { simulationId } = req.params;
    const simulation = simulations.find(sim => sim.simulationId === simulationId);
    if (simulation) {
        simulation.status = 'stopped';
        res.status(200).json(simulation);
    } else {
        res.status(404).json({ message: 'Simulation not found' });
    }
};

export const getSimulations = (req: Request, res: Response) => {
    res.status(200).json(simulations);
};