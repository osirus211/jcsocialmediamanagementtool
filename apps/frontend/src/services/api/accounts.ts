import { socialService } from '../social.service';

export const disconnectSocialAccount = async (accountId: string): Promise<{ success: boolean }> => {
  return socialService.disconnectAccount(accountId);
};