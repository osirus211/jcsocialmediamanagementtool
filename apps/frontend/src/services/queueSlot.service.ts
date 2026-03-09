import { apiClient } from '@/lib/api-client';

export interface QueueSlot {
  id: string;
  workspaceId: string;
  platform: string;
  dayOfWeek: number;
  time: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQueueSlotRequest {
  platform: string;
  dayOfWeek: number;
  time: string;
  timezone: string;
}

export interface UpdateQueueSlotRequest {
  time?: string;
  timezone?: string;
  isActive?: boolean;
}

class QueueSlotService {
  async getSlots(platform?: string): Promise<QueueSlot[]> {
    const url = platform ? `/queue-slots?platform=${platform}` : '/queue-slots';
    const response = await apiClient.get<{ success: boolean; data: QueueSlot[] }>(url);
    return response.data;
  }

  async createSlot(data: CreateQueueSlotRequest): Promise<QueueSlot> {
    const response = await apiClient.post<{ success: boolean; data: QueueSlot }>(
      '/queue-slots',
      data
    );
    return response.data;
  }

  async updateSlot(slotId: string, data: UpdateQueueSlotRequest): Promise<QueueSlot> {
    const response = await apiClient.put<{ success: boolean; data: QueueSlot }>(
      `/queue-slots/${slotId}`,
      data
    );
    return response.data;
  }

  async deleteSlot(slotId: string): Promise<void> {
    await apiClient.delete(`/queue-slots/${slotId}`);
  }
}

export const queueSlotService = new QueueSlotService();
