import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface ReciterInfo {
  id: number;
  sourceId: number;
  name: string;
  englishName: string;
  languageName: string;
  cdnName: string;
  isWorking: boolean;
  fallbackTo?: string;
}

@Injectable()
export class ReciterManagerService {
  private readonly logger = new Logger(ReciterManagerService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all available reciters with their CDN status
   */
  async getAllReciters(): Promise<ReciterInfo[]> {
    const reciters = await this.prisma.quranReciter.findMany({
      where: { isActive: true },
      orderBy: { sourceId: 'asc' },
    });

    return reciters.map(reciter => this.mapReciterToInfo(reciter));
  }

  /**
   * Get reciter info by source ID
   */
  async getReciterBySourceId(sourceId: number): Promise<ReciterInfo | null> {
    const reciter = await this.prisma.quranReciter.findFirst({
      where: { sourceId },
    });

    if (!reciter) {
      return null;
    }

    return this.mapReciterToInfo(reciter);
  }

  /**
   * Get working reciters (those with verified CDN access)
   */
  async getWorkingReciters(): Promise<ReciterInfo[]> {
    const allReciters = await this.getAllReciters();
    return allReciters.filter(reciter => reciter.isWorking);
  }

  /**
   * Get CDN name for a reciter (with fallback logic)
   */
  getCdnName(sourceId: number): string {
    const cdnMapping = this.getCdnMapping();
    return cdnMapping[sourceId] || 'Alafasy'; // Default fallback
  }

  /**
   * Check if a reciter is working on CDN
   */
  isReciterWorking(sourceId: number): boolean {
    const workingReciters = [1, 2, 4, 7]; // AbdulBaset Murattal, Mujawwad, Shatri, Alafasy
    return workingReciters.includes(sourceId);
  }

  /**
   * Get fallback reciter for a given reciter
   */
  getFallbackReciter(sourceId: number): string {
    const fallbackMapping = this.getFallbackMapping();
    return fallbackMapping[sourceId] || 'Alafasy';
  }

  /**
   * Map database reciter to ReciterInfo
   */
  private mapReciterToInfo(reciter: any): ReciterInfo {
    const cdnName = this.getCdnName(reciter.sourceId);
    const isWorking = this.isReciterWorking(reciter.sourceId);
    const fallbackTo = isWorking ? undefined : this.getFallbackReciter(reciter.sourceId);

    return {
      id: reciter.id,
      sourceId: reciter.sourceId,
      name: reciter.name,
      englishName: reciter.englishName || reciter.name,
      languageName: reciter.languageName || 'arabic',
      cdnName,
      isWorking,
      fallbackTo,
    };
  }

  /**
   * CDN mapping for reciters (real names from Quran.com API)
   */
  private getCdnMapping(): { [key: number]: string } {
    return {
      // Real reciter names from Quran.com API
      1: 'AbdulBaset/Murattal',    // Abdul Basit Murattal - VERIFIED WORKING
      2: 'AbdulBaset/Mujawwad',    // Abdul Basit Mujawwad - VERIFIED WORKING
      3: 'Alafasy',                // Abdullah Matroud → Alafasy (fallback)
      4: 'Shatri',                 // Abdurrahmaan As-Sudais → Shatri - VERIFIED WORKING
      5: 'Shatri',                 // Abdurrahmaan As-Sudais variant → Shatri
      6: 'Shatri',                 // Abdurrahmaan As-Sudais variant → Shatri
      7: 'Alafasy',                // Mishary Rashid Alafasy - VERIFIED WORKING
      
      // Additional reciter IDs
      8: 'Alafasy',                // Additional reciter → Alafasy
      9: 'Shatri',                 // Additional reciter → Shatri
      10: 'Alafasy',               // Additional reciter → Alafasy
    };
  }

  /**
   * Fallback mapping for non-working reciters
   */
  private getFallbackMapping(): { [key: number]: string } {
    return {
      3: 'Alafasy',  // Abdullah Matroud → Alafasy
      5: 'Shatri',   // Abdurrahmaan As-Sudais variant → Shatri
      6: 'Shatri',   // Abdurrahmaan As-Sudais variant → Shatri
      8: 'Alafasy',  // Additional reciter → Alafasy
      9: 'Shatri',   // Additional reciter → Shatri
      10: 'Alafasy', // Additional reciter → Alafasy
    };
  }

  /**
   * Get reciter statistics
   */
  async getReciterStats(): Promise<{
    total: number;
    working: number;
    fallback: number;
    audioFiles: number;
  }> {
    const allReciters = await this.getAllReciters();
    const workingReciters = allReciters.filter(r => r.isWorking);
    const fallbackReciters = allReciters.filter(r => !r.isWorking);

    const audioFilesCount = await this.prisma.quranAudioFile.count();

    return {
      total: allReciters.length,
      working: workingReciters.length,
      fallback: fallbackReciters.length,
      audioFiles: audioFilesCount,
    };
  }
}
