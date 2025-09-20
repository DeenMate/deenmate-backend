'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { jobControlApi } from '@/lib/job-control-api';
import { JobStatus } from '@/lib/job-control-api';
import { 
  Trash2, 
  Pause, 
  Play, 
  Square, 
  AlertTriangle, 
  CheckCircle,
  Loader2 
} from 'lucide-react';

interface BulkJobOperationsProps {
  jobs: JobStatus[];
  onJobsUpdate: () => void;
}

export function BulkJobOperations({ jobs, onJobsUpdate }: BulkJobOperationsProps) {
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [isOperating, setIsOperating] = useState(false);
  const [operation, setOperation] = useState<string>('');

  const handleSelectJob = (jobId: string, checked: boolean) => {
    const newSelected = new Set(selectedJobs);
    if (checked) {
      newSelected.add(jobId);
    } else {
      newSelected.delete(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobs(new Set(jobs.map(job => job.jobId)));
    } else {
      setSelectedJobs(new Set());
    }
  };

  const handleBulkOperation = async () => {
    if (selectedJobs.size === 0 || !operation) return;

    setIsOperating(true);
    const selectedJobIds = Array.from(selectedJobs);
    const results = [];

    try {
      for (const jobId of selectedJobIds) {
        let result;
        switch (operation) {
          case 'pause':
            result = await jobControlApi.pauseJob(jobId);
            break;
          case 'resume':
            result = await jobControlApi.resumeJob(jobId);
            break;
          case 'cancel':
            result = await jobControlApi.cancelJob(jobId);
            break;
          case 'delete':
            result = await jobControlApi.deleteJob(jobId);
            break;
          default:
            continue;
        }
        results.push({ jobId, success: result.success, message: result.message });
      }

      // Show results
      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;
      
      if (failCount > 0) {
        alert(`Operation completed: ${successCount} successful, ${failCount} failed`);
      } else {
        alert(`Operation completed successfully for ${successCount} jobs`);
      }

      // Refresh data
      onJobsUpdate();
      setSelectedJobs(new Set());
      setOperation('');
    } catch (error) {
      console.error('Bulk operation failed:', error);
      alert('Bulk operation failed');
    } finally {
      setIsOperating(false);
    }
  };

  const getOperationIcon = (op: string) => {
    switch (op) {
      case 'pause':
        return <Pause className="h-4 w-4" />;
      case 'resume':
        return <Play className="h-4 w-4" />;
      case 'cancel':
        return <Square className="h-4 w-4" />;
      case 'delete':
        return <Trash2 className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getOperationColor = (op: string) => {
    switch (op) {
      case 'pause':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'resume':
        return 'bg-green-500 hover:bg-green-600';
      case 'cancel':
        return 'bg-orange-500 hover:bg-orange-600';
      case 'delete':
        return 'bg-red-500 hover:bg-red-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const canPerformOperation = (op: string, job: JobStatus) => {
    switch (op) {
      case 'pause':
        return job.status === 'running';
      case 'resume':
        return job.status === 'paused';
      case 'cancel':
        return ['running', 'pending', 'paused'].includes(job.status);
      case 'delete':
        return ['completed', 'failed', 'cancelled'].includes(job.status);
      default:
        return false;
    }
  };

  const getAvailableOperations = () => {
    const selectedJobObjects = jobs.filter(job => selectedJobs.has(job.jobId));
    const operations = new Set<string>();

    selectedJobObjects.forEach(job => {
      if (canPerformOperation('pause', job)) operations.add('pause');
      if (canPerformOperation('resume', job)) operations.add('resume');
      if (canPerformOperation('cancel', job)) operations.add('cancel');
      if (canPerformOperation('delete', job)) operations.add('delete');
    });

    return Array.from(operations);
  };

  const availableOperations = getAvailableOperations();
  const selectedJobsCount = selectedJobs.size;
  const allSelected = selectedJobsCount === jobs.length && jobs.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5" />
          <span>Bulk Operations</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selection Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={allSelected}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm font-medium">
                Select All ({jobs.length})
              </label>
            </div>
            <Badge variant="outline">
              {selectedJobsCount} selected
            </Badge>
          </div>
        </div>

        {/* Job List with Checkboxes */}
        {jobs.length > 0 && (
          <div className="max-h-64 overflow-y-auto border rounded-lg">
            <div className="divide-y">
              {jobs.map((job) => (
                <div key={job.jobId} className="flex items-center space-x-3 p-3 hover:bg-gray-50">
                  <Checkbox
                    id={`job-${job.jobId}`}
                    checked={selectedJobs.has(job.jobId)}
                    onCheckedChange={(checked) => handleSelectJob(job.jobId, checked as boolean)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium truncate">{job.jobName}</span>
                      <Badge variant="outline" className="text-xs">
                        {job.jobType}
                      </Badge>
                      <Badge 
                        variant={job.status === 'completed' ? 'default' : 'secondary'}
                        className={`text-xs ${
                          job.status === 'completed' ? 'bg-green-500' :
                          job.status === 'failed' ? 'bg-red-500' :
                          job.status === 'running' ? 'bg-blue-500' :
                          job.status === 'paused' ? 'bg-yellow-500' : 'bg-gray-500'
                        }`}
                      >
                        {job.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500">
                      ID: {job.jobId}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Operation Controls */}
        {selectedJobsCount > 0 && (
          <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <Select value={operation} onValueChange={setOperation}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select operation" />
                </SelectTrigger>
                <SelectContent>
                  {availableOperations.map((op) => (
                    <SelectItem key={op} value={op}>
                      <div className="flex items-center space-x-2">
                        {getOperationIcon(op)}
                        <span className="capitalize">{op}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleBulkOperation}
              disabled={!operation || isOperating}
              className={`${getOperationColor(operation)} text-white`}
            >
              {isOperating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {getOperationIcon(operation)}
                  <span className="ml-2 capitalize">
                    {operation} {selectedJobsCount} job{selectedJobsCount > 1 ? 's' : ''}
                  </span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* Operation Summary */}
        {selectedJobsCount > 0 && (
          <div className="text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>Selected jobs can be:</span>
              <div className="flex space-x-2">
                {availableOperations.map((op) => (
                  <Badge key={op} variant="outline" className="text-xs">
                    {getOperationIcon(op)}
                    <span className="ml-1 capitalize">{op}</span>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedJobsCount === 0 && (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>Select jobs to perform bulk operations</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
