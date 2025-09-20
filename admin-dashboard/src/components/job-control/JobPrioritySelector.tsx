'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { jobControlApi } from '@/lib/job-control-api';
import { ArrowUp, ArrowDown, Clock, AlertTriangle, Zap } from 'lucide-react';

interface JobPrioritySelectorProps {
  jobId: string;
  currentPriority: number;
  onPriorityChange?: (newPriority: number) => void;
  compact?: boolean;
}

const priorityConfig = {
  1: { label: 'Critical', color: 'bg-red-500', icon: AlertTriangle, description: 'Highest priority - runs immediately' },
  2: { label: 'High', color: 'bg-orange-500', icon: ArrowUp, description: 'High priority - runs soon' },
  3: { label: 'Medium-High', color: 'bg-yellow-500', icon: ArrowUp, description: 'Above normal priority' },
  4: { label: 'Medium', color: 'bg-blue-500', icon: Clock, description: 'Normal priority' },
  5: { label: 'Medium-Low', color: 'bg-indigo-500', icon: ArrowDown, description: 'Below normal priority' },
  6: { label: 'Low', color: 'bg-purple-500', icon: ArrowDown, description: 'Low priority' },
  7: { label: 'Very Low', color: 'bg-gray-500', icon: Clock, description: 'Very low priority' },
  8: { label: 'Background', color: 'bg-gray-400', icon: Clock, description: 'Background processing' },
  9: { label: 'Idle', color: 'bg-gray-300', icon: Clock, description: 'Idle priority' },
  10: { label: 'Lowest', color: 'bg-gray-200', icon: Clock, description: 'Lowest priority' },
};

export function JobPrioritySelector({
  jobId,
  currentPriority,
  onPriorityChange,
  compact = false,
}: JobPrioritySelectorProps) {
  const [selectedPriority, setSelectedPriority] = useState(currentPriority.toString());
  const [isUpdating, setIsUpdating] = useState(false);

  const handlePriorityChange = async (newPriority: string) => {
    const priority = parseInt(newPriority);
    setSelectedPriority(newPriority);
    setIsUpdating(true);

    try {
      const result = await jobControlApi.updateJobPriority(jobId, priority);
      if (result.success) {
        onPriorityChange?.(priority);
      } else {
        // Revert on failure
        setSelectedPriority(currentPriority.toString());
        alert(`Failed to update priority: ${result.message}`);
      }
    } catch (error) {
      // Revert on error
      setSelectedPriority(currentPriority.toString());
      console.error('Failed to update job priority:', error);
      alert('Failed to update job priority');
    } finally {
      setIsUpdating(false);
    }
  };

  const currentConfig = priorityConfig[currentPriority as keyof typeof priorityConfig];
  const Icon = currentConfig?.icon || Clock;

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <Icon className="h-4 w-4" />
        <Select
          value={selectedPriority}
          onValueChange={handlePriorityChange}
          disabled={isUpdating}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(priorityConfig).map(([priority, config]) => {
              const PriorityIcon = config.icon;
              return (
                <SelectItem key={priority} value={priority}>
                  <div className="flex items-center space-x-2">
                    <PriorityIcon className="h-4 w-4" />
                    <span>{config.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Job Priority</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Priority Display */}
        <div className="flex items-center space-x-3">
          <Icon className="h-6 w-6" />
          <div>
            <div className="flex items-center space-x-2">
              <Badge className={currentConfig?.color}>
                {currentConfig?.label}
              </Badge>
              <span className="text-sm text-gray-600">Priority {currentPriority}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {currentConfig?.description}
            </p>
          </div>
        </div>

        {/* Priority Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Change Priority</label>
          <Select
            value={selectedPriority}
            onValueChange={handlePriorityChange}
            disabled={isUpdating}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(priorityConfig).map(([priority, config]) => {
                const PriorityIcon = config.icon;
                return (
                  <SelectItem key={priority} value={priority}>
                    <div className="flex items-center space-x-2">
                      <PriorityIcon className="h-4 w-4" />
                      <span>{config.label}</span>
                      <span className="text-xs text-gray-500">({priority})</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Priority Legend */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Priority Levels</label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(priorityConfig).slice(0, 6).map(([priority, config]) => {
              const PriorityIcon = config.icon;
              return (
                <div key={priority} className="flex items-center space-x-2">
                  <PriorityIcon className="h-3 w-3" />
                  <Badge className={`${config.color} text-white text-xs`}>
                    {config.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {isUpdating && (
          <div className="text-sm text-blue-600 flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Updating priority...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
