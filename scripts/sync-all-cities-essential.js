#!/usr/bin/env node

/**
 * Essential prayer times sync script for all cities
 * This syncs with the most commonly used calculation methods and schools
 * Focuses on quality over quantity for faster execution
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();
const API_BASE_URL = 'http://localhost:3000/api/v4';

// Admin credentials
const ADMIN_CREDENTIALS = {
  email: 'admin@deenmate.app',
  password: 'admin123'
};

// Essential prayer calculation methods (most commonly used)
const ESSENTIAL_METHODS = [
  { code: 'MWL', name: 'Muslim World League', id: 3, description: 'Most widely used internationally' },
  { code: 'ISNA', name: 'Islamic Society of North America', id: 2, description: 'Common in North America' },
  { code: 'KARACHI', name: 'University of Islamic Sciences, Karachi', id: 1, description: 'Common in South Asia' },
  { code: 'MAKKAH', name: 'Umm al-Qura University, Makkah', id: 4, description: 'Official Saudi method' },
  { code: 'EGAS', name: 'Egyptian General Authority of Survey', id: 5, description: 'Common in Middle East' },
  { code: 'TEHRAN', name: 'Institute of Geophysics, University of Tehran', id: 7, description: 'Common in Iran' },
  { code: 'JAFARI', name: 'Shia Ithna-Ansari', id: 0, description: 'Shia method' },
  { code: 'GULF', name: 'Gulf Region', id: 8, description: 'Gulf countries' },
  { code: 'KUWAIT', name: 'Kuwait', id: 9, description: 'Kuwait official method' },
  { code: 'QATAR', name: 'Qatar', id: 10, description: 'Qatar official method' }
];

// Schools of thought (Madhabs)
const SCHOOLS = [
  { code: '0', name: 'Shafi (Standard)', description: 'Standard calculation method' },
  { code: '1', name: 'Hanafi', description: 'Hanafi school of thought' }
];

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

async function syncPrayerTimesForLocation(location, method, school) {
  try {
    console.log(`🔄 Syncing ${method.name} (${school.name}) for ${location.city || 'Unknown'}, ${location.country || 'Unknown'}...`);
    
    const response = await axios.post(
      `${API_BASE_URL}/admin/sync/prayer/times`,
      {},
      {
        params: {
          lat: location.lat,
          lng: location.lng,
          methodCode: method.code,
          school: school.code,
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
      console.log(`✅ Successfully synced ${method.name} (${school.name}) for ${location.city || 'Unknown'}`);
      return { success: true, location: location.city || 'Unknown', method: method.name, school: school.name };
    } else {
      console.log(`⚠️  Sync failed for ${location.city || 'Unknown'} (${method.name}, ${school.name}): ${response.data.message}`);
      return { success: false, location: location.city || 'Unknown', method: method.name, school: school.name, error: response.data.message };
    }
  } catch (error) {
    console.log(`❌ Error syncing ${location.city || 'Unknown'} (${method.name}, ${school.name}): ${error.response?.data?.message || error.message}`);
    return { success: false, location: location.city || 'Unknown', method: method.name, school: school.name, error: error.message };
  }
}

async function syncAllCitiesEssential() {
  try {
    console.log('🚀 Starting essential prayer times sync for all cities...\n');
    console.log(`📊 Will sync ${ESSENTIAL_METHODS.length} essential methods × ${SCHOOLS.length} schools = ${ESSENTIAL_METHODS.length * SCHOOLS.length} combinations per location\n`);

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

    const totalCombinations = locations.length * ESSENTIAL_METHODS.length * SCHOOLS.length;
    console.log(`📈 Total sync operations: ${totalCombinations}\n`);

    const results = {
      total: totalCombinations,
      successful: 0,
      failed: 0,
      errors: [],
      methodStats: {},
      schoolStats: {}
    };

    // Initialize stats
    ESSENTIAL_METHODS.forEach(method => {
      results.methodStats[method.name] = { successful: 0, failed: 0 };
    });
    SCHOOLS.forEach(school => {
      results.schoolStats[school.name] = { successful: 0, failed: 0 };
    });

    let operationCount = 0;

    // Sync each location with each essential method and school combination
    for (let i = 0; i < locations.length; i++) {
      const location = locations[i];
      console.log(`\n📍 [${i + 1}/${locations.length}] Processing location: ${location.city || 'Unknown'}, ${location.country || 'Unknown'}`);
      
      for (let j = 0; j < ESSENTIAL_METHODS.length; j++) {
        const method = ESSENTIAL_METHODS[j];
        
        for (let k = 0; k < SCHOOLS.length; k++) {
          const school = SCHOOLS[k];
          operationCount++;
          
          console.log(`[${operationCount}/${totalCombinations}] ${method.name} (${school.name})...`);
          
          const result = await syncPrayerTimesForLocation(location, method, school);
          
          if (result.success) {
            results.successful++;
            results.methodStats[method.name].successful++;
            results.schoolStats[school.name].successful++;
          } else {
            results.failed++;
            results.methodStats[method.name].failed++;
            results.schoolStats[school.name].failed++;
            results.errors.push({
              location: result.location,
              method: result.method,
              school: result.school,
              error: result.error
            });
          }

          // Add a small delay between requests to be respectful to the API
          await new Promise(resolve => setTimeout(resolve, 300)); // 0.3 second delay
        }
      }
    }

    // Print summary
    console.log('\n📈 ESSENTIAL SYNC SUMMARY');
    console.log('==========================');
    console.log(`Total operations: ${results.total}`);
    console.log(`✅ Successful: ${results.successful}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📊 Success rate: ${((results.successful / results.total) * 100).toFixed(1)}%`);

    console.log('\n📊 METHOD STATISTICS:');
    console.log('=====================');
    Object.entries(results.methodStats).forEach(([method, stats]) => {
      const total = stats.successful + stats.failed;
      const successRate = total > 0 ? ((stats.successful / total) * 100).toFixed(1) : '0.0';
      console.log(`${method}: ${stats.successful}/${total} (${successRate}%)`);
    });

    console.log('\n📊 SCHOOL STATISTICS:');
    console.log('=====================');
    Object.entries(results.schoolStats).forEach(([school, stats]) => {
      const total = stats.successful + stats.failed;
      const successRate = total > 0 ? ((stats.successful / total) * 100).toFixed(1) : '0.0';
      console.log(`${school}: ${stats.successful}/${total} (${successRate}%)`);
    });

    if (results.errors.length > 0) {
      console.log('\n❌ ERRORS (showing first 10):');
      results.errors.slice(0, 10).forEach((error, index) => {
        console.log(`${index + 1}. ${error.location} (${error.method}, ${error.school}): ${error.error}`);
      });
      if (results.errors.length > 10) {
        console.log(`... and ${results.errors.length - 10} more errors`);
      }
    }

    console.log('\n🎉 Essential sync process completed!');
    console.log('💡 You can now check the admin dashboard to see the prayer times data.');
    console.log('💡 The database now contains prayer times for essential calculation methods and schools of thought.');

  } catch (error) {
    console.error('❌ Fatal error during sync process:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the essential sync
syncAllCitiesEssential().catch(console.error);
