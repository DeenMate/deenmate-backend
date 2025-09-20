'use client';

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface JobProgressBarProps {
  jobId: string;
  progress: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentStep?: string;
  totalSteps?: number;
  estimatedTimeRemaining?: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export function JobProgressBar({
  jobId,
  progress,
  status,
  currentStep,
  totalSteps,
  estimatedTimeRemaining,
  startedAt,
  completedAt,
  errorMessage,
}: JobProgressBarProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'paused':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge variant="secondary">Running</Badge>;
      case 'paused':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Paused</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const formatDuration = (startTime: Date, endTime?: Date) => {
    const end = endTime || new Date();
    const duration = end.getTime() - startTime.getTime();
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatEstimatedTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m remaining`;
    } else if (minutes > 0) {
      return `${minutes}m remaining`;
    } else {
      return `${seconds}s remaining`;
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <span className="font-medium text-sm">Job {jobId}</span>
              {getStatusBadge()}
            </div>
            <div className="text-sm text-gray-500">
              {progress}%
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            {currentStep && (
              <div className="text-xs text-gray-600">
                {currentStep}
                {totalSteps && ` (${Math.floor((progress / 100) * totalSteps)}/${totalSteps})`}
              </div>
            )}
          </div>

          {/* Time Information */}
          <div className="flex justify-between text-xs text-gray-500">
            <div>
              {startedAt && (
                <div>
                  Started: {startedAt.toLocaleString()}
                </div>
              )}
              {completedAt && (
                <div>
                  Completed: {completedAt.toLocaleString()}
                </div>
              )}
            </div>
            <div className="text-right">
              {startedAt && !completedAt && status === 'running' && (
                <div>
                  Duration: {formatDuration(startedAt)}
                </div>
              )}
              {startedAt && completedAt && (
                <div>
                  Total: {formatDuration(startedAt, completedAt)}
                </div>
              )}
              {estimatedTimeRemaining && status === 'running' && (
                <div>
                  {formatEstimatedTime(estimatedTimeRemaining)}
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              <strong>Error:</strong> {errorMessage}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
