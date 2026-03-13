import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { emailSequenceService } from '../services/EmailSequenceService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Unsubscribe from email sequence
 * GET /unsubscribe?token=userId&type=sequence
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { token, type } = req.query;

    if (!token || !type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters',
      });
    }

    if (type !== 'sequence') {
      return res.status(400).json({
        success: false,
        message: 'Invalid unsubscribe type',
      });
    }

    // Find user
    const user = await User.findById(token);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Stop email sequence
    await emailSequenceService.stopSequence(user._id.toString());

    // Update user notification preferences
    user.notificationPreferences.email.weeklyReport = false;
    await user.save();

    logger.info('User unsubscribed from email sequence', {
      userId: user._id,
      email: user.email,
    });

    // Return success page
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribed</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            text-align: center;
            background-color: #f8f9fa;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .success {
            color: #28a745;
            font-size: 24px;
            margin-bottom: 20px;
          }
          .message {
            color: #666;
            font-size: 16px;
            line-height: 1.5;
            margin-bottom: 30px;
          }
          .button {
            background: #007bff;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✅ Successfully Unsubscribed</div>
          <div class="message">
            You have been unsubscribed from our welcome email sequence.<br>
            You can still receive important account notifications.
          </div>
          <a href="${process.env.FRONTEND_URL || 'https://app.example.com'}" class="button">
            Return to Dashboard
          </a>
        </div>
      </body>
      </html>
    `);
  } catch (error: any) {
    logger.error('Unsubscribe error', {
      error: error.message,
      token: req.query.token,
      type: req.query.type,
    });

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;