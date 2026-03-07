/**
 * UpgradeModalProvider
 * Global provider for showing upgrade modal on 402 errors
 */

import { useState, useEffect, ReactNode } from 'react';
import UpgradeModal from './UpgradeModal';
import { registerUpgradeModalCallback } from '../../lib/api-client';

interface UpgradeModalProviderProps {
  children: ReactNode;
}

export function UpgradeModalProvider({ children }: UpgradeModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [limitType, setLimitType] = useState<'posts' | 'social_accounts' | 'team_members' | 'ai_credits'>('posts');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    // Register callback with API client
    registerUpgradeModalCallback((type: string, msg: string) => {
      // Map backend limit types to frontend types
      const typeMap: Record<string, 'posts' | 'social_accounts' | 'team_members' | 'ai_credits'> = {
        posts: 'posts',
        post: 'posts',
        social_accounts: 'social_accounts',
        social_account: 'social_accounts',
        team_members: 'team_members',
        team_member: 'team_members',
        ai_credits: 'ai_credits',
        ai_credit: 'ai_credits',
      };

      setLimitType(typeMap[type] || 'posts');
      setMessage(msg);
      setIsOpen(true);
    });
  }, []);

  return (
    <>
      {children}
      <UpgradeModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        limitType={limitType}
        message={message}
      />
    </>
  );
}
