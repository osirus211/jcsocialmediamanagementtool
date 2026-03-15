import { BlackoutDate, IBlackoutDate } from '../models/BlackoutDate';
import { ScheduledPost } from '../models/ScheduledPost';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export interface CreateBlackoutDateData {
  workspaceId: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  recurring?: boolean;
  recurringPattern?: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom';
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    customDates?: Date[];
    endRecurrence?: Date;
  };
  action?: 'hold' | 'reschedule' | 'cancel';
  createdBy: string;
}

export interface UpdateBlackoutDateData {
  startDate?: Date;
  endDate?: Date;
  reason?: string;
  recurring?: boolean;
  recurringPattern?: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom';
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    customDates?: Date[];
    endRecurrence?: Date;
  };
  action?: 'hold' | 'reschedule' | 'cancel';
  isActive?: boolean;
}

export interface BlackoutConflict {
  postId: string;
  scheduledAt: Date;
  blackoutDate: IBlackoutDate;
  action: 'hold' | 'reschedule' | 'cancel';
}

class BlackoutDateService {
  /**
   * Create a new blackout date
   */
  async createBlackoutDate(data: CreateBlackoutDateData): Promise<IBlackoutDate> {
    try {
      const blackoutDate = new BlackoutDate({
        workspaceId: new mongoose.Types.ObjectId(data.workspaceId),
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason,
        recurring: data.recurring || false,
        recurringPattern: data.recurringPattern,
        action: data.action || 'hold',
        createdBy: new mongoose.Types.ObjectId(data.createdBy),
      });

      await blackoutDate.save();
      
      logger.info('Blackout date created', {
        blackoutDateId: blackoutDate._id,
        workspaceId: data.workspaceId,
        startDate: data.startDate,
        endDate: data.endDate,
      });

      return blackoutDate;
    } catch (error: any) {
      logger.error('Failed to create blackout date', {
        error: error.message,
        workspaceId: data.workspaceId,
      });
      throw error;
    }
  }

  /**
   * Get all blackout dates for a workspace
   */
  async getBlackoutDates(
    workspaceId: string,
    options: {
      isActive?: boolean;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<IBlackoutDate[]> {
    try {
      const query: any = {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      };

      if (options.isActive !== undefined) {
        query.isActive = options.isActive;
      }

      if (options.startDate || options.endDate) {
        query.$or = [];
        
        if (options.startDate && options.endDate) {
          // Find blackouts that overlap with the date range
          query.$or.push(
            { startDate: { $lte: options.endDate }, endDate: { $gte: options.startDate } }
          );
        } else if (options.startDate) {
          query.$or.push({ endDate: { $gte: options.startDate } });
        } else if (options.endDate) {
          query.$or.push({ startDate: { $lte: options.endDate } });
        }
      }

      const queryBuilder = BlackoutDate.find(query)
        .sort({ startDate: 1 })
        .populate('createdBy', 'name email');

      if (options.limit) {
        queryBuilder.limit(options.limit);
      }

      if (options.skip) {
        queryBuilder.skip(options.skip);
      }

      return await queryBuilder.exec();
    } catch (error: any) {
      logger.error('Failed to get blackout dates', {
        error: error.message,
        workspaceId,
      });
      throw error;
    }
  }

  /**
   * Get a single blackout date by ID
   */
  async getBlackoutDateById(id: string, workspaceId: string): Promise<IBlackoutDate | null> {
    try {
      return await BlackoutDate.findOne({
        _id: new mongoose.Types.ObjectId(id),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      }).populate('createdBy', 'name email');
    } catch (error: any) {
      logger.error('Failed to get blackout date by ID', {
        error: error.message,
        id,
        workspaceId,
      });
      throw error;
    }
  }

  /**
   * Update a blackout date
   */
  async updateBlackoutDate(
    id: string,
    workspaceId: string,
    data: UpdateBlackoutDateData
  ): Promise<IBlackoutDate | null> {
    try {
      const blackoutDate = await BlackoutDate.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(id),
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
        },
        { $set: data },
        { new: true, runValidators: true }
      ).populate('createdBy', 'name email');

      if (blackoutDate) {
        logger.info('Blackout date updated', {
          blackoutDateId: id,
          workspaceId,
        });
      }

      return blackoutDate;
    } catch (error: any) {
      logger.error('Failed to update blackout date', {
        error: error.message,
        id,
        workspaceId,
      });
      throw error;
    }
  }

  /**
   * Delete a blackout date
   */
  async deleteBlackoutDate(id: string, workspaceId: string): Promise<boolean> {
    try {
      const result = await BlackoutDate.deleteOne({
        _id: new mongoose.Types.ObjectId(id),
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });

      if (result.deletedCount > 0) {
        logger.info('Blackout date deleted', {
          blackoutDateId: id,
          workspaceId,
        });
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error('Failed to delete blackout date', {
        error: error.message,
        id,
        workspaceId,
      });
      throw error;
    }
  }

  /**
   * Check if a date falls within any active blackout period
   */
  async isDateBlackedOut(
    workspaceId: string,
    date: Date
  ): Promise<{ isBlackedOut: boolean; blackoutDate?: IBlackoutDate }> {
    try {
      // Check for direct blackout dates
      const directBlackout = await BlackoutDate.findOne({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        isActive: true,
        startDate: { $lte: date },
        endDate: { $gte: date },
      });

      if (directBlackout) {
        return { isBlackedOut: true, blackoutDate: directBlackout };
      }

      // Check for recurring blackout dates
      const recurringBlackouts = await BlackoutDate.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        isActive: true,
        recurring: true,
      });

      for (const blackout of recurringBlackouts) {
        if (this.isDateInRecurringPattern(date, blackout)) {
          return { isBlackedOut: true, blackoutDate: blackout };
        }
      }

      return { isBlackedOut: false };
    } catch (error: any) {
      logger.error('Failed to check if date is blacked out', {
        error: error.message,
        workspaceId,
        date,
      });
      throw error;
    }
  }

  /**
   * Check if a date matches a recurring pattern
   */
  private isDateInRecurringPattern(date: Date, blackout: IBlackoutDate): boolean {
    if (!blackout.recurring || !blackout.recurringPattern) {
      return false;
    }

    const pattern = blackout.recurringPattern;
    const checkDate = new Date(date);
    
    // Check if we're past the end recurrence date
    if (pattern.endRecurrence && checkDate > pattern.endRecurrence) {
      return false;
    }

    // Check if we're before the original start date
    if (checkDate < blackout.startDate) {
      return false;
    }

    switch (pattern.type) {
      case 'daily':
        return this.checkDailyPattern(checkDate, blackout.startDate, pattern.interval || 1);
      
      case 'weekly':
        return this.checkWeeklyPattern(checkDate, pattern.daysOfWeek || []);
      
      case 'monthly':
        return this.checkMonthlyPattern(checkDate, pattern.dayOfMonth || 1);
      
      case 'custom':
        return this.checkCustomPattern(checkDate, pattern.customDates || []);
      
      default:
        return false;
    }
  }

  private checkDailyPattern(date: Date, startDate: Date, interval: number): boolean {
    const daysDiff = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff >= 0 && daysDiff % interval === 0;
  }

  private checkWeeklyPattern(date: Date, daysOfWeek: number[]): boolean {
    const dayOfWeek = date.getDay();
    return daysOfWeek.includes(dayOfWeek);
  }

  private checkMonthlyPattern(date: Date, dayOfMonth: number): boolean {
    return date.getDate() === dayOfMonth;
  }

  private checkCustomPattern(date: Date, customDates: Date[]): boolean {
    const dateStr = date.toISOString().split('T')[0];
    return customDates.some(customDate => 
      customDate.toISOString().split('T')[0] === dateStr
    );
  }

  /**
   * Find posts that conflict with blackout dates
   */
  async findConflictingPosts(workspaceId: string): Promise<BlackoutConflict[]> {
    try {
      const conflicts: BlackoutConflict[] = [];
      
      // Get all scheduled posts for the workspace
      const scheduledPosts = await ScheduledPost.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        status: { $in: ['scheduled', 'queued'] },
        isActive: true,
      }).select('_id scheduledAt');

      // Check each post against blackout dates
      for (const post of scheduledPosts) {
        const blackoutCheck = await this.isDateBlackedOut(workspaceId, post.scheduledAt);
        
        if (blackoutCheck.isBlackedOut && blackoutCheck.blackoutDate) {
          conflicts.push({
            postId: post._id.toString(),
            scheduledAt: post.scheduledAt,
            blackoutDate: blackoutCheck.blackoutDate,
            action: blackoutCheck.blackoutDate.action,
          });
        }
      }

      return conflicts;
    } catch (error: any) {
      logger.error('Failed to find conflicting posts', {
        error: error.message,
        workspaceId,
      });
      throw error;
    }
  }

  /**
   * Get next available slot after a blackout period
   */
  async getNextAvailableSlot(
    workspaceId: string,
    originalDate: Date,
    maxDaysAhead: number = 30
  ): Promise<Date | null> {
    try {
      const checkDate = new Date(originalDate);
      const maxDate = new Date(originalDate);
      maxDate.setDate(maxDate.getDate() + maxDaysAhead);

      while (checkDate <= maxDate) {
        const blackoutCheck = await this.isDateBlackedOut(workspaceId, checkDate);
        
        if (!blackoutCheck.isBlackedOut) {
          return new Date(checkDate);
        }

        // Move to next day
        checkDate.setDate(checkDate.getDate() + 1);
      }

      return null; // No available slot found within the time limit
    } catch (error: any) {
      logger.error('Failed to get next available slot', {
        error: error.message,
        workspaceId,
        originalDate,
      });
      throw error;
    }
  }

  /**
   * Get blackout dates for a specific date range (for calendar display)
   */
  async getBlackoutDatesInRange(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ date: Date; reason: string; action: string }[]> {
    try {
      const blackoutDates: { date: Date; reason: string; action: string }[] = [];
      
      // Get all active blackout dates that might affect this range
      const blackouts = await BlackoutDate.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        isActive: true,
        $or: [
          // Direct overlaps
          { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
          // Recurring patterns (we'll check these separately)
          { recurring: true }
        ]
      });

      // Check each day in the range
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        for (const blackout of blackouts) {
          let isBlackedOut = false;

          if (!blackout.recurring) {
            // Direct blackout
            if (currentDate >= blackout.startDate && currentDate <= blackout.endDate) {
              isBlackedOut = true;
            }
          } else {
            // Recurring blackout
            isBlackedOut = this.isDateInRecurringPattern(currentDate, blackout);
          }

          if (isBlackedOut) {
            blackoutDates.push({
              date: new Date(currentDate),
              reason: blackout.reason,
              action: blackout.action,
            });
            break; // Only add once per date
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return blackoutDates;
    } catch (error: any) {
      logger.error('Failed to get blackout dates in range', {
        error: error.message,
        workspaceId,
        startDate,
        endDate,
      });
      throw error;
    }
  }
}

export const blackoutDateService = new BlackoutDateService();