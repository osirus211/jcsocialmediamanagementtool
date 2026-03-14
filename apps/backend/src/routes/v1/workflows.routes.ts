/**
 * Workflow Routes
 * 
 * API routes for managing automation workflows
 */

import { Router } from 'express';
import { workflowController } from '../../controllers/WorkflowController';
import { requireAuth } from '../../middleware/auth';
import { requireWorkspace } from '../../middleware/tenant';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// All routes require authentication and workspace context
router.use(requireAuth);
router.use(requireWorkspace);

// Rate limiting for workflow APIs
const workflowRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(workflowRateLimiter);

/**
 * @openapi
 * /api/v1/workflows:
 *   post:
 *     summary: Create a workflow
 *     description: Create a new automation workflow
 *     tags:
 *       - Workflows
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workspaceId
 *               - name
 *               - trigger
 *               - actions
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID
 *               name:
 *                 type: string
 *                 description: Workflow name
 *               description:
 *                 type: string
 *                 description: Workflow description
 *               trigger:
 *                 type: object
 *                 description: Workflow trigger configuration
 *               actions:
 *                 type: array
 *                 description: Workflow actions
 *               enabled:
 *                 type: boolean
 *                 description: Whether workflow is enabled
 *     responses:
 *       201:
 *         description: Workflow created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', (req, res, next) => {
  workflowController.createWorkflow(req, res, next);
});

/**
 * @openapi
 * /api/v1/workflows:
 *   get:
 *     summary: Get workflows
 *     description: Retrieve workflows with pagination
 *     tags:
 *       - Workflows
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *       - in: query
 *         name: enabled
 *         schema:
 *           type: boolean
 *         description: Filter by enabled status
 *       - in: query
 *         name: triggerType
 *         schema:
 *           type: string
 *         description: Filter by trigger type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Workflows retrieved successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.get('/', (req, res, next) => {
  workflowController.getWorkflows(req, res, next);
});

/**
 * @openapi
 * /api/v1/workflows/{id}:
 *   get:
 *     summary: Get workflow by ID
 *     description: Retrieve a specific workflow
 *     tags:
 *       - Workflows
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow ID
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Workflow retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workflow not found
 */
router.get('/:id', (req, res, next) => {
  workflowController.getWorkflowById(req, res, next);
});

/**
 * @openapi
 * /api/v1/workflows/{id}:
 *   put:
 *     summary: Update workflow
 *     description: Update an existing workflow
 *     tags:
 *       - Workflows
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workspaceId
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID
 *               name:
 *                 type: string
 *                 description: Workflow name
 *               description:
 *                 type: string
 *                 description: Workflow description
 *               trigger:
 *                 type: object
 *                 description: Workflow trigger configuration
 *               actions:
 *                 type: array
 *                 description: Workflow actions
 *               enabled:
 *                 type: boolean
 *                 description: Whether workflow is enabled
 *     responses:
 *       200:
 *         description: Workflow updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workflow not found
 */
router.put('/:id', (req, res, next) => {
  workflowController.updateWorkflow(req, res, next);
});

/**
 * @openapi
 * /api/v1/workflows/{id}:
 *   delete:
 *     summary: Delete workflow
 *     description: Delete a workflow and cancel pending executions
 *     tags:
 *       - Workflows
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow ID
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Workflow deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workflow not found
 */
router.delete('/:id', (req, res, next) => {
  workflowController.deleteWorkflow(req, res, next);
});

/**
 * @openapi
 * /api/v1/workflows/{id}/executions:
 *   get:
 *     summary: Get workflow execution history
 *     description: Retrieve execution history for a workflow
 *     tags:
 *       - Workflows
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow ID
 *       - in: query
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Execution history retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workflow not found
 */
router.get('/:id/executions', (req, res, next) => {
  workflowController.getWorkflowExecutions(req, res, next);
});

export default router;

