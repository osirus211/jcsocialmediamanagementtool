/**
 * QueueSlot Service
 * 
 * Business logic for queue slot management and next available slot calculation
 */

import mongoose from 'mongoose';
import { QueueSlot, IQueueSlot } from '../models/QueueSlot';
import { ScheduledPost } from '../models/ScheduledPost';
import { logger } from '../utils/logger';
import { BadRequestError, NotFoundError } from '../utils/errors';

export interface CreateQueueSlotInput {
  workspaceId: string;
  platform: string;
  dayOfWeek: number;
  time: string;
  timezone: string;
}

export interface UpdateQueueSlotInput {
  time?: string;
  timezone?: string;
  isActive?: boolean;
}

export class QueueSlotService {
  private static instance: QueueSlotService;

  private constructor() {}

  static getInstance(): QueueSlotService {
    if (!QueueSlotService.instance) {
      QueueSlotService.instance = new QueueSlotService();
    }
    return QueueSlotService.instance;
  }

  /**
   * Get all queue slots for workspace and platform
   */
  async getSlots(workspaceId: string, platform?: string): Promise<IQueueSlot[]> {
    try {
      const query: Record<string, unknown> = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      };

      if (platform) {
        query.platform = platform;
      }

      const slots = await QueueSlot.find(query)
        .sort({ dayOfWeek: 1, time: 1 })
        .lean();

      return slots as IQueueSlot[];
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to get queue slots', {
        workspaceId,
        platform,
        error: err.message,
      });
      throw new Error(`Failed to get queue slots: ${err.message}`);
    }
  }

  /**
   * Create a new queue slot
   */
  async createSlot(input: CreateQueueSlotInput): Promise<IQueueSlot> {
    try {
      const { workspaceId, platform, dayOfWeek, time, timezone } = input;

      // Validate time format
      if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
        throw new BadRequestError('Invalid time format. Use HH:MM (24-hour)');
      }

      // Validate day of week
      if (dayOfWeek < 0 || dayOfWeek > 6) {
        throw new BadRequestError('Invalid dayOfWeek. Must be 0-6 (0=Sunday)');
      }

      // Check for duplicate
      const existing = await QueueSlot.findOne({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        platform,
        dayOfWeek,
        time,
      });

      if (existing) {
        throw new BadRequestError('A slot already exists for this day and time');
      }

      const slot = await QueueSlot.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        platform,
        dayOfWeek,
        time,
        timezone,
        isActive: true,
      });

      logger.info('Queue slot created', {
        slotId: slot._id.toString(),
        workspaceId,
        platform,
        dayOfWeek,
        time,
      });

      return slot;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to create queue slot', {
        input,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Update a queue slot
   */
  async updateSlot(
    slotId: string,
    workspaceId: string,
    updates: UpdateQueueSlotInput
  ): Promise<IQueueSlot> {
    try {
      const slot = await QueueSlot.findOne({
        _id: slotId,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (!slot) {
        throw new NotFoundError('Queue slot not found');
      }

      if (updates.time !== undefined) {
        if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(updates.time)) {
          throw new BadRequestError('Invalid time format. Use HH:MM (24-hour)');
        }
        slot.time = updates.time;
      }

      if (updates.timezone !== undefined) {
        slot.timezone = updates.timezone;
      }

      if (updates.isActive !== undefined) {
        slot.isActive = updates.isActive;
      }

      await slot.save();

      logger.info('Queue slot updated', {
        slotId,
        workspaceId,
        updates,
      });

      return slot;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to update queue slot', {
        slotId,
        workspaceId,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Delete a queue slot
   */
  async deleteSlot(slotId: string, workspaceId: string): Promise<void> {
    try {
      const slot = await QueueSlot.findOne({
        _id: slotId,
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (!slot) {
        throw new NotFoundError('Queue slot not found');
      }

      await QueueSlot.findByIdAndDelete(slotId);

      logger.info('Queue slot deleted', {
        slotId,
        workspaceId,
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to delete queue slot', {
        slotId,
        workspaceId,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Get next available slot for a platform
   * Returns the next future slot datetime that has no post scheduled
   */
  async getNextAvailableSlot(
    workspaceId: string,
    platform: string
  ): Promise<{ scheduledAt: Date; slotId: string } | null> {
    try {
      // Get all active slots for this workspace and platform
      const slots = await QueueSlot.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        platform,
        isActive: true,
      }).sort({ dayOfWeek: 1, time: 1 });

      if (slots.length === 0) {
        return null;
      }

      const now = new Date();
      const candidates: Array<{ date: Date; slotId: string }> = [];

      // Generate candidate datetimes for the next 14 days
      for (let daysAhead = 0; daysAhead < 14; daysAhead++) {
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + daysAhead);
        const targetDayOfWeek = targetDate.getDay();

        // Find slots for this day of week
        const daySlots = slots.filter((s) => s.dayOfWeek === targetDayOfWeek);

        for (const slot of daySlots) {
          const [hours, minutes] = slot.time.split(':').map(Number);
          const candidateDate = new Date(targetDate);
          candidateDate.setHours(hours, minutes, 0, 0);

          // Only consider future times
          if (candidateDate > now) {
            candidates.push({
              date: candidateDate,
              slotId: slot._id.toString(),
            });
          }
        }
      }

      // Sort candidates by date
      candidates.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Find first candidate that doesn't have a post scheduled
      for (const candidate of candidates) {
        const existingPost = await ScheduledPost.findOne({
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          scheduledAt: candidate.date,
          status: { $in: ['pending', 'scheduled'] },
        });

        if (!existingPost) {
          return {
            scheduledAt: candidate.date,
            slotId: candidate.slotId,
          };
        }
      }

      // No available slots found
      return null;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to get next available slot', {
        workspaceId,
        platform,
        error: err.message,
      });
      throw new Error(`Failed to get next available slot: ${err.message}`);
    }
  }

  /**
   * Add post to queue (schedule to next available slot)
   */
  async addToQueue(
    workspaceId: string,
    postId: string,
    platform: string
  ): Promise<{ scheduledAt: Date; slotId: string }> {
    try {
      const nextSlot = await this.getNextAvailableSlot(workspaceId, platform);

      if (!nextSlot) {
        throw new BadRequestError(
          'No available queue slots. Please configure queue slots in settings or all slots are occupied.'
        );
      }

      // Update the post with the scheduled time
      await ScheduledPost.findByIdAndUpdate(postId, {
        scheduledAt: nextSlot.scheduledAt,
        status: 'scheduled',
      });

      logger.info('Post added to queue', {
        postId,
        workspaceId,
        platform,
        scheduledAt: nextSlot.scheduledAt,
        slotId: nextSlot.slotId,
      });

      return nextSlot;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Failed to add post to queue', {
        postId,
        workspaceId,
        platform,
        error: err.message,
      });
      throw err;
    }
  }
}

export const queueSlotService = QueueSlotService.getInstance();
