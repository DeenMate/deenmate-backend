#!/usr/bin/env ts-node

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { QuranSyncService } from '../src/modules/quran/quran.sync.service';

async function testVerseTranslationsSync() {
  console.log('🧪 Testing Verse Translations Sync for Chapter 1...');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const quranSync = app.get(QuranSyncService);
  
  try {
    // Test with just Chapter 1 (Al-Fatiha) - 7 verses
    console.log('📖 Testing verse translations sync for Chapter 1 (Al-Fatiha)...');
    
    // First, let's check current count
    const prisma = app.get('PrismaService');
    const beforeCount = await prisma.verseTranslation.count();
    console.log(`📊 Verse translations before sync: ${beforeCount}`);
    
    // Sync verse translations for Chapter 1 only
    const result = await quranSync.syncVerseTranslations({ 
      force: true,
      // We'll modify the sync to only process Chapter 1
    });
    
    // Check count after sync
    const afterCount = await prisma.verseTranslation.count();
    console.log(`📊 Verse translations after sync: ${afterCount}`);
    
    console.log('✅ Test result:', {
      success: result.success,
      recordsProcessed: result.recordsProcessed,
      recordsInserted: result.recordsInserted,
      recordsUpdated: result.recordsUpdated,
      recordsFailed: result.recordsFailed,
      errors: result.errors,
      durationMs: result.durationMs
    });
    
    if (result.success && afterCount > beforeCount) {
      console.log('🎉 SUCCESS: Verse translations sync is working!');
      console.log(`📈 Added ${afterCount - beforeCount} new verse translations`);
    } else {
      console.log('❌ FAILED: Verse translations sync is not working');
      if (result.errors && result.errors.length > 0) {
        console.log('Errors:', result.errors);
      }
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await app.close();
  }
}

testVerseTranslationsSync().catch(console.error);
