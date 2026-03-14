import { useState, useEffect } from 'react';
import { SocialAccount } from '@/types/social.types';
import { apiClient } from '@/lib/api-client';

interface UseSocialAccountsReturn {
  accounts: SocialAccount[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSocialAccounts(): UseSocialAccountsReturn {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get<{
        success: boolean;
        accounts: SocialAccount[];
      }>('/social/accounts');
      
      if (response.success) {
        setAccounts(response.accounts);
      } else {
        setError('Failed to fetch social accounts');
      }
    } catch (err) {
      console.error('Error fetching social accounts:', err);
      setError('Failed to fetch social accounts');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  return {
    accounts,
    loading,
    error,
    refetch: fetchAccounts
  };
}