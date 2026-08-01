import { Router } from 'express';
import { startSimulation, stopSimulation, getSimulationStatus } from '../controllers/simulations';

const router = Router();

router.post('/simulate/start', startSimulation);
router.post('/simulate/stop', stopSimulation);
router.get('/simulate/status', getSimulationStatus);

export default router;