/**
 * Empty Queue State Component
 * 
 * Displays when the queue is empty with helpful actions
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Plus,
  Settings,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function EmptyQueueState() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-8 w-8 text-gray-400" />
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Your queue is empty
          </h3>
          
          <p className="text-gray-600 mb-6">
            Start scheduling posts to see them appear in your queue. You can create posts, 
            set up queue slots, or import content to get started.
          </p>

          <div className="space-y-3">
            <Button
              onClick={() => navigate('/composer')}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Post
            </Button>
            
            <Button
              onClick={() => navigate('/settings/queue-slots')}
              variant="outline"
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Set Up Queue Slots
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center text-sm text-gray-500">
              <BookOpen className="h-4 w-4 mr-2" />
              <span>Learn about queue management</span>
              <ArrowRight className="h-4 w-4 ml-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}