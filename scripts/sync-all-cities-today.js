#!/usr/bin/env node

/**
 * Script to sync prayer times for all cities for today
 * This will populate the prayer_times table with today's data for all locations
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();
const API_BASE_URL = 'http://localhost:3000/api/v4';

// Admin credentials (you may need to adjust these)
const ADMIN_CREDENTIALS = {
  email: 'admin@deenmate.app',
  password: 'admin123'
};

let adminToken = null;

async function loginAdmin() {
  try {
    console.log('🔐 Logging in as admin...');
    const response = await axios.post(`${API_BASE_URL}/admin/auth/login`, ADMIN_CREDENTIALS);
    adminToken = response.data.data.accessToken;
    console.log('✅ Admin login successful');
    return true;
  } catch (error) {
    console.error('❌ Admin login failed:', error.response?.data || error.message);
    return false;
  }
}

async function getAllPrayerLocations() {
  try {
    console.log('📍 Fetching all prayer locations...');
    const locations = await prisma.prayerLocation.findMany({
      select: {
        id: true,
        lat: true,
        lng: true,
        city: true,
        country: true,
        locKey: true,
        timezone: true
      },
      orderBy: { id: 'asc' }
    });
    
    console.log(`✅ Found ${locations.length} prayer locations`);
    return locations;
  } catch (error) {
    console.error('❌ Failed to fetch locations:', error.message);
    return [];
  }
}

async function syncPrayerTimesForLocation(location) {
  try {
    console.log(`🔄 Syncing prayer times for ${location.city || 'Unknown'}, ${location.country || 'Unknown'} (${location.lat}, ${location.lng})...`);
    
    const response = await axios.post(
      `${API_BASE_URL}/admin/sync/prayer/times`,
      {},
      {
        params: {
          lat: location.lat,
          lng: location.lng,
          methodCode: 'MWL', // Muslim World League method
          school: '0',       // Shafi school
          days: '1',         // Today only
          force: 'true'      // Force sync even if data exists
        },
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.success) {
      console.log(`✅ Successfully synced prayer times for ${location.city || 'Unknown'}`);
      return { success: true, location: location.city || 'Unknown' };
    } else {
      console.log(`⚠️  Sync failed for ${location.city || 'Unknown'}: ${response.data.message}`);
      return { success: false, location: location.city || 'Unknown', error: response.data.message };
    }
  } catch (error) {
    console.log(`❌ Error syncing ${location.city || 'Unknown'}: ${error.response?.data?.message || error.message}`);
    return { success: false, location: location.city || 'Unknown', error: error.message };
  }
}

async function syncAllCities() {
  try {
    console.log('🚀 Starting prayer times sync for all cities...\n');

    // Login as admin
    const loginSuccess = await loginAdmin();
    if (!loginSuccess) {
      console.error('❌ Cannot proceed without admin authentication');
      process.exit(1);
    }

    // Get all locations
    const locations = await getAllPrayerLocations();
    if (locations.length === 0) {
      console.log('❌ No locations found to sync');
      process.exit(1);
    }

    console.log(`\n📊 Starting sync for ${locations.length} locations...\n`);

    const results = {
      total: locations.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    // Sync each location with a small delay to avoid overwhelming the API
    for (let i = 0; i < locations.length; i++) {
      const location = locations[i];
      console.log(`[${i + 1}/${locations.length}] Processing location ${location.id}...`);
      
      const result = await syncPrayerTimesForLocation(location);
      
      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
        results.errors.push({
          location: result.location,
          error: result.error
        });
      }

      // Add a small delay between requests to be respectful to the API
      if (i < locations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    // Print summary
    console.log('\n📈 SYNC SUMMARY');
    console.log('================');
    console.log(`Total locations: ${results.total}`);
    console.log(`✅ Successful: ${results.successful}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📊 Success rate: ${((results.successful / results.total) * 100).toFixed(1)}%`);

    if (results.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.location}: ${error.error}`);
      });
    }

    console.log('\n🎉 Sync process completed!');
    console.log('💡 You can now check the admin dashboard to see the prayer times data.');

  } catch (error) {
    console.error('❌ Fatal error during sync process:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncAllCities().catch(console.error);
