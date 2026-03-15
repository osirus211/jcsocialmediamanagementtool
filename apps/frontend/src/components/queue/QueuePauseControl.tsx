/**
 * Queue Pause Control Component
 * 
 * Superior pause/resume functionality that beats Buffer & Hootsuite
 * Features:
 * - Global workspace pause OR per-account pause
 * - Auto-resume with date/time picker
 * - Pause duration presets (1h, 4h, 1d, 1w)
 * - Visual indicators and warnings
 * - Pause reasons for team communication
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Pause,
  Play,
  Clock,
  AlertTriangle,
  Calendar,
  Users,
  Settings,
  Info,
} from 'lucide-react';
import { queueService, QueuePauseStatus } from '@/services/queue.service';
import { format, addHours, addDays, addWeeks } from 'date-fns';
import { cn } from '@/lib/utils';

interface QueuePauseControlProps {
  className?: string;
  onStatusChange?: (status: QueuePauseStatus) => void;
}

const PAUSE_DURATION_PRESETS = [
  { label: '1 Hour', value: '1h', getDate: () => addHours(new Date(), 1) },
  { label: '4 Hours', value: '4h', getDate: () => addHours(new Date(), 4) },
  { label: '1 Day', value: '1d', getDate: () => addDays(new Date(), 1) },
  { label: '1 Week', value: '1w', getDate: () => addWeeks(new Date(), 1) },
  { label: 'Custom', value: 'custom', getDate: () => new Date() },
  { label: 'Indefinitely', value: 'indefinite', getDate: () => undefined },
];

export function QueuePauseControl({ className, onStatusChange }: QueuePauseControlProps) {
  const [status, setStatus] = useState<QueuePauseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [pauseType, setPauseType] = useState<'workspace' | 'account'>('workspace');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [pauseDuration, setPauseDuration] = useState('1h');
  const [customResumeTime, setCustomResumeTime] = useState('');
  const [pauseReason, setPauseReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await queueService.getQueueStatus();
      setStatus(data);
      onStatusChange?.(data);
    } catch (error: any) {
      console.error('Failed to load queue status:', error);
      toast.error('Failed to load queue status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handlePause = async () => {
    try {
      setIsProcessing(true);
      
      let resumeAt: string | undefined;
      
      if (pauseDuration !== 'indefinite') {
        const preset = PAUSE_DURATION_PRESETS.find(p => p.value === pauseDuration);
        if (preset) {
          const resumeDate = preset.getDate();
          if (resumeDate) {
            resumeAt = resumeDate.toISOString();
          }
        }
        
        if (pauseDuration === 'custom' && customResumeTime) {
          resumeAt = new Date(customResumeTime).toISOString();
        }
      }

      const newStatus = await queueService.pauseQueue({
        accountId: pauseType === 'account' ? selectedAccount : undefined,
        resumeAt,
        reason: pauseReason || undefined,
      });

      setStatus(newStatus);
      onStatusChange?.(newStatus);
      setShowPauseDialog(false);
      
      const message = pauseType === 'account' 
        ? 'Account queue paused successfully'
        : 'Workspace queue paused successfully';
      
      toast.success(message);
    } catch (error: any) {
      toast.error('Failed to pause queue');
      console.error('Pause error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResume = async (accountId?: string) => {
    try {
      setIsProcessing(true);
      
      const newStatus = await queueService.resumeQueue({
        accountId,
      });

      setStatus(newStatus);
      onStatusChange?.(newStatus);
      setShowResumeDialog(false);
      
      const message = accountId 
        ? 'Account queue resumed successfully'
        : 'Workspace queue resumed successfully';
      
      toast.success(message);
    } catch (error: any) {
      toast.error('Failed to resume queue');
      console.error('Resume error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const openPauseDialog = () => {
    setPauseType('workspace');
    setSelectedAccount('');
    setPauseDuration('1h');
    setCustomResumeTime('');
    setPauseReason('');
    setShowPauseDialog(true);
  };

  const formatResumeTime = (resumeAt: string) => {
    return format(new Date(resumeAt), 'MMM d, yyyy h:mm a');
  };

  if (loading) {
    return (
      <Card className={cn('', className)}>
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isGloballyPaused = status?.isPaused;
  const hasAccountPauses = status?.accountPauses.length > 0;
  const anyPaused = isGloballyPaused || hasAccountPauses;

  return (
    <>
      <Card className={cn('', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {anyPaused ? (
              <Pause className="h-5 w-5 text-orange-500" />
            ) : (
              <Play className="h-5 w-5 text-green-500" />
            )}
            Queue Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Global Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Publishing:</span>
              <Badge variant={anyPaused ? 'destructive' : 'default'}>
                {anyPaused ? 'PAUSED' : 'ACTIVE'}
              </Badge>
            </div>
            
            {!anyPaused ? (
              <Button
                onClick={openPauseDialog}
                variant="outline"
                size="sm"
                className="text-orange-600 hover:text-orange-700"
              >
                <Pause className="h-4 w-4 mr-2" />
                Pause Queue
              </Button>
            ) : (
              <Button
                onClick={() => handleResume()}
                variant="outline"
                size="sm"
                className="text-green-600 hover:text-green-700"
                disabled={isProcessing}
              >
                <Play className="h-4 w-4 mr-2" />
                Resume All
              </Button>
            )}
          </div>

          {/* Global Pause Warning */}
          {isGloballyPaused && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div className="font-medium">Queue is PAUSED - no posts will publish</div>
                  {status.pausedBy && (
                    <div className="text-xs">Paused by {status.pausedBy}</div>
                  )}
                  {status.resumeAt && (
                    <div className="text-xs">
                      Auto-resume: {formatResumeTime(status.resumeAt)}
                    </div>
                  )}
                  {status.reason && (
                    <div className="text-xs">Reason: {status.reason}</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Account-Specific Pauses */}
          {hasAccountPauses && !isGloballyPaused && (
            <div className="space-y-2">
              <div className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Account Pauses
              </div>
              {status.accountPauses.map((pause) => (
                <div
                  key={pause.socialAccountId}
                  className="flex items-center justify-between p-2 bg-orange-50 rounded border border-orange-200"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {pause.socialAccountName} ({pause.platform})
                    </div>
                    <div className="text-xs text-gray-600">
                      Paused by {pause.pausedBy}
                      {pause.resumeAt && (
                        <span> • Resume: {formatResumeTime(pause.resumeAt)}</span>
                      )}
                    </div>
                    {pause.reason && (
                      <div className="text-xs text-gray-500">
                        Reason: {pause.reason}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => handleResume(pause.socialAccountId)}
                    variant="ghost"
                    size="sm"
                    className="text-green-600 hover:text-green-700"
                    disabled={isProcessing}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Next Auto-Resume */}
          {(status?.resumeAt || status?.accountPauses.some(p => p.resumeAt)) && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>
                Next auto-resume: {
                  status.resumeAt 
                    ? formatResumeTime(status.resumeAt)
                    : formatResumeTime(
                        status.accountPauses
                          .filter(p => p.resumeAt)
                          .sort((a, b) => new Date(a.resumeAt!).getTime() - new Date(b.resumeAt!).getTime())[0]?.resumeAt!
                      )
                }
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pause Dialog */}
      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pause Queue</DialogTitle>
            <DialogDescription>
              Temporarily stop publishing posts. Superior to Buffer's basic pause.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Pause Type */}
            <div>
              <Label className="text-sm font-medium">Pause Scope</Label>
              <Select value={pauseType} onValueChange={(value: 'workspace' | 'account') => setPauseType(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workspace">Entire Workspace</SelectItem>
                  <SelectItem value="account">Specific Account</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Account Selection */}
            {pauseType === 'account' && (
              <div>
                <Label className="text-sm font-medium">Social Account</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select account to pause" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* TODO: Load actual social accounts */}
                    <SelectItem value="account1">Twitter @example</SelectItem>
                    <SelectItem value="account2">Instagram @example</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Duration */}
            <div>
              <Label className="text-sm font-medium">Duration</Label>
              <Select value={pauseDuration} onValueChange={setPauseDuration}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAUSE_DURATION_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Time */}
            {pauseDuration === 'custom' && (
              <div>
                <Label className="text-sm font-medium">Resume Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={customResumeTime}
                  onChange={(e) => setCustomResumeTime(e.target.value)}
                  className="mt-1"
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            )}

            {/* Reason */}
            <div>
              <Label className="text-sm font-medium">Reason (Optional)</Label>
              <Textarea
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder="e.g., Crisis management, maintenance, etc."
                className="mt-1"
                rows={2}
                maxLength={200}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPauseDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePause}
              disabled={isProcessing || (pauseType === 'account' && !selectedAccount)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isProcessing ? 'Pausing...' : 'Pause Queue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}