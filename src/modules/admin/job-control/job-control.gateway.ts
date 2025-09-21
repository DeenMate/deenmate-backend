import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JobStatus, JobProgress, JobControlResult } from './interfaces/job-control.interface';

@WebSocketGateway({
  namespace: '/job-control',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class JobControlGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(JobControlGateway.name);
  private connectedClients = new Map<string, Socket>();

  handleConnection(client: Socket) {
    // Completely disable connection logging to prevent spam
    this.connectedClients.set(client.id, client);
    
    // Send initial connection confirmation
    client.emit('connected', {
      message: 'Connected to job control gateway',
      clientId: client.id,
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    // Completely disable disconnection logging to prevent spam
    this.connectedClients.delete(client.id);
  }

  // Emit job status updates to all connected clients
  emitJobStatusUpdate(jobId: string, status: JobStatus): void {
    // Only log significant status changes
    if (status.status === 'completed' || status.status === 'failed') {
      this.logger.log(`Job ${jobId} ${status.status}`);
    }
    this.server.emit('job-status-update', {
      jobId,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit job progress updates to all connected clients
  emitJobProgressUpdate(jobId: string, progress: JobProgress): void {
    // Only log progress milestones (every 25%)
    if (progress.progressPercentage % 25 === 0) {
      this.logger.log(`Job ${jobId} progress: ${progress.progressPercentage}%`);
    }
    this.server.emit('job-progress-update', {
      jobId,
      progress,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit job control action results to all connected clients
  emitJobControlAction(jobId: string, action: string, result: JobControlResult): void {
    this.logger.log(`Job ${jobId} ${action} action completed`);
    this.server.emit('job-control-action', {
      jobId,
      action,
      result,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit queue status updates to all connected clients
  emitQueueStatusUpdate(queueStatus: any): void {
    // Only log queue status changes, not every update
    this.server.emit('queue-status-update', {
      queueStatus,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit system health updates to all connected clients
  emitSystemHealthUpdate(health: any): void {
    // Only log health status changes, not every update
    this.server.emit('system-health-update', {
      health,
      timestamp: new Date().toISOString(),
    });
  }

  // Handle client subscription to specific job updates
  @SubscribeMessage('subscribe-job')
  handleSubscribeJob(
    @MessageBody() data: { jobId: string },
    @ConnectedSocket() client: Socket,
  ): void {
    // Reduced logging - only log in debug mode
    client.join(`job-${data.jobId}`);
    client.emit('subscribed', {
      jobId: data.jobId,
      message: `Subscribed to job ${data.jobId} updates`,
    });
  }

  // Handle client unsubscription from specific job updates
  @SubscribeMessage('unsubscribe-job')
  handleUnsubscribeJob(
    @MessageBody() data: { jobId: string },
    @ConnectedSocket() client: Socket,
  ): void {
    // Reduced logging - only log in debug mode
    client.leave(`job-${data.jobId}`);
    client.emit('unsubscribed', {
      jobId: data.jobId,
      message: `Unsubscribed from job ${data.jobId} updates`,
    });
  }

  // Handle client subscription to all job updates
  @SubscribeMessage('subscribe-all-jobs')
  handleSubscribeAllJobs(@ConnectedSocket() client: Socket): void {
    // Reduced logging - only log in debug mode
    client.join('all-jobs');
    client.emit('subscribed-all', {
      message: 'Subscribed to all job updates',
    });
  }

  // Handle client unsubscription from all job updates
  @SubscribeMessage('unsubscribe-all-jobs')
  handleUnsubscribeAllJobs(@ConnectedSocket() client: Socket): void {
    // Reduced logging - only log in debug mode
    client.leave('all-jobs');
    client.emit('unsubscribed-all', {
      message: 'Unsubscribed from all job updates',
    });
  }

  // Emit job status update to specific job subscribers
  emitJobStatusUpdateToSubscribers(jobId: string, status: JobStatus): void {
    // Reduced logging - only log significant status changes
    if (status.status === 'completed' || status.status === 'failed') {
      this.logger.log(`Job ${jobId} ${status.status} - notifying subscribers`);
    }
    this.server.to(`job-${jobId}`).emit('job-status-update', {
      jobId,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit job progress update to specific job subscribers
  emitJobProgressUpdateToSubscribers(jobId: string, progress: JobProgress): void {
    // Reduced logging - only log progress milestones
    if (progress.progressPercentage % 25 === 0) {
      this.logger.log(`Job ${jobId} progress: ${progress.progressPercentage}% - notifying subscribers`);
    }
    this.server.to(`job-${jobId}`).emit('job-progress-update', {
      jobId,
      progress,
      timestamp: new Date().toISOString(),
    });
  }

  // Get connected clients count
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  // Get connected clients info
  getConnectedClientsInfo(): Array<{ id: string; connectedAt: Date }> {
    return Array.from(this.connectedClients.entries()).map(([id, socket]) => ({
      id,
      connectedAt: new Date(), // Note: In a real implementation, you'd store the actual connection time
    }));
  }
}
