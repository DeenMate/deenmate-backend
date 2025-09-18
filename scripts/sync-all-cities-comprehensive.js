#!/usr/bin/env node

/**
 * Comprehensive script to sync prayer times for all cities with proper methods and madhabs
 * This will populate the prayer_times table with today's data for all locations
 * using different calculation methods and schools of thought
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

// Prayer calculation methods and their codes
const PRAYER_METHODS = [
  { code: 'MWL', name: 'Muslim World League', id: 3 },
  { code: 'ISNA', name: 'Islamic Society of North America', id: 2 },
  { code: 'EGAS', name: 'Egyptian General Authority of Survey', id: 5 },
  { code: 'MAKKAH', name: 'Umm al-Qura University, Makkah', id: 4 },
  { code: 'KARACHI', name: 'University of Islamic Sciences, Karachi', id: 1 },
  { code: 'TEHRAN', name: 'Institute of Geophysics, University of Tehran', id: 7 },
  { code: 'JAFARI', name: 'Shia Ithna-Ansari', id: 0 },
  { code: 'GULF', name: 'Gulf Region', id: 8 },
  { code: 'KUWAIT', name: 'Kuwait', id: 9 },
  { code: 'QATAR', name: 'Qatar', id: 10 },
  { code: 'MAJMA', name: 'Majlis Ugama Islam Singapura, Singapore', id: 11 },
  { code: 'UOIF', name: 'Union Organization islamic de France', id: 12 },
  { code: 'DIB', name: 'Diyanet İşleri Başkanlığı, Turkey', id: 13 },
  { code: 'SPAIN', name: 'Ministry of Islamic Affairs, Algeria', id: 14 },
  { code: 'MOROCCO', name: 'Ministry of Islamic Affairs, Morocco', id: 15 },
  { code: 'TUNISIA', name: 'Ministry of Religious Affairs, Tunisia', id: 16 },
  { code: 'RUSSIA', name: 'Spiritual Administration of Muslims of Russia', id: 17 },
  { code: 'SINGAPORE', name: 'Majlis Ugama Islam Singapura, Singapore', id: 18 },
  { code: 'UAE', name: 'General Authority of Islamic Affairs & Endowments, UAE', id: 19 },
  { code: 'KEMENAG', name: 'Kementerian Agama Republik Indonesia', id: 20 },
  { code: 'JORDAN', name: 'Ministry of Awqaf, Islamic Affairs and Holy Places, Jordan', id: 21 },
  { code: 'LIBYA', name: 'Libya', id: 22 },
  { code: 'ALGERIA', name: 'Ministry of Religious Affairs, Algeria', id: 23 },
  { code: 'KOSOVO', name: 'Islamic Community of Kosovo', id: 24 },
  { code: 'BOSNIA', name: 'Islamic Community of Bosnia and Herzegovina', id: 25 },
  { code: 'MALAYSIA', name: 'Jabatan Kemajuan Islam Malaysia (JAKIM)', id: 26 },
  { code: 'BRUNEI', name: 'Majlis Ugama Islam Brunei', id: 27 },
  { code: 'SOMALIA', name: 'Ministry of Endowments and Religious Affairs, Somalia', id: 28 },
  { code: 'SUDAN', name: 'Ministry of Religious Affairs, Sudan', id: 29 },
  { code: 'LEBANON', name: 'Ministry of Awqaf, Lebanon', id: 30 },
  { code: 'SYRIA', name: 'Ministry of Awqaf, Syria', id: 31 },
  { code: 'IRAQ', name: 'Ministry of Awqaf, Iraq', id: 32 },
  { code: 'AFGHANISTAN', name: 'Ministry of Hajj and Religious Affairs, Afghanistan', id: 33 },
  { code: 'PAKISTAN', name: 'Ministry of Religious Affairs, Pakistan', id: 34 },
  { code: 'BANGLADESH', name: 'Islamic Foundation, Bangladesh', id: 35 },
  { code: 'INDIA', name: 'Islamic Society of North America (ISNA)', id: 36 },
  { code: 'SRI_LANKA', name: 'Department of Muslim Religious and Cultural Affairs, Sri Lanka', id: 37 },
  { code: 'MYANMAR', name: 'Ministry of Religious Affairs, Myanmar', id: 38 },
  { code: 'THAILAND', name: 'Office of the Chularajmontri, Thailand', id: 39 },
  { code: 'CAMBODIA', name: 'Ministry of Cults and Religion, Cambodia', id: 40 },
  { code: 'VIETNAM', name: 'Vietnam', id: 41 },
  { code: 'PHILIPPINES', name: 'National Commission on Muslim Filipinos, Philippines', id: 42 },
  { code: 'CHINA', name: 'China Islamic Association', id: 43 },
  { code: 'JAPAN', name: 'Japan Muslim Association', id: 44 },
  { code: 'SOUTH_KOREA', name: 'Korea Muslim Federation', id: 45 },
  { code: 'MONGOLIA', name: 'Mongolia', id: 46 },
  { code: 'KAZAKHSTAN', name: 'Spiritual Administration of Muslims of Kazakhstan', id: 47 },
  { code: 'UZBEKISTAN', name: 'Spiritual Administration of Muslims of Uzbekistan', id: 48 },
  { code: 'KYRGYZSTAN', name: 'Spiritual Administration of Muslims of Kyrgyzstan', id: 49 },
  { code: 'TAJIKISTAN', name: 'Spiritual Administration of Muslims of Tajikistan', id: 50 },
  { code: 'TURKMENISTAN', name: 'Spiritual Administration of Muslims of Turkmenistan', id: 51 },
  { code: 'AZERBAIJAN', name: 'Caucasus Muslims Office, Azerbaijan', id: 52 },
  { code: 'GEORGIA', name: 'Georgian Muslims Department', id: 53 },
  { code: 'ARMENIA', name: 'Armenia', id: 54 },
  { code: 'IRAN', name: 'Institute of Geophysics, University of Tehran', id: 55 },
  { code: 'SAUDI_ARABIA', name: 'Umm al-Qura University, Makkah', id: 56 },
  { code: 'YEMEN', name: 'Ministry of Awqaf, Yemen', id: 57 },
  { code: 'OMAN', name: 'Ministry of Awqaf, Oman', id: 58 },
  { code: 'BAHRAIN', name: 'Ministry of Justice, Islamic Affairs and Awqaf, Bahrain', id: 59 },
  { code: 'QATAR', name: 'Ministry of Awqaf, Qatar', id: 60 },
  { code: 'KUWAIT', name: 'Ministry of Awqaf, Kuwait', id: 61 },
  { code: 'UAE', name: 'General Authority of Islamic Affairs & Endowments, UAE', id: 62 },
  { code: 'EGYPT', name: 'Egyptian General Authority of Survey', id: 63 },
  { code: 'LIBYA', name: 'Libya', id: 64 },
  { code: 'TUNISIA', name: 'Ministry of Religious Affairs, Tunisia', id: 65 },
  { code: 'ALGERIA', name: 'Ministry of Religious Affairs, Algeria', id: 66 },
  { code: 'MOROCCO', name: 'Ministry of Islamic Affairs, Morocco', id: 67 },
  { code: 'MAURITANIA', name: 'Ministry of Islamic Affairs, Mauritania', id: 68 },
  { code: 'SENEGAL', name: 'Ministry of Islamic Affairs, Senegal', id: 69 },
  { code: 'MALI', name: 'Ministry of Religious Affairs, Mali', id: 70 },
  { code: 'NIGER', name: 'Ministry of Religious Affairs, Niger', id: 71 },
  { code: 'BURKINA_FASO', name: 'Ministry of Religious Affairs, Burkina Faso', id: 72 },
  { code: 'GUINEA', name: 'Ministry of Religious Affairs, Guinea', id: 73 },
  { code: 'SIERRA_LEONE', name: 'Ministry of Religious Affairs, Sierra Leone', id: 74 },
  { code: 'LIBERIA', name: 'Ministry of Religious Affairs, Liberia', id: 75 },
  { code: 'IVORY_COAST', name: 'Ministry of Religious Affairs, Ivory Coast', id: 76 },
  { code: 'GHANA', name: 'Ministry of Religious Affairs, Ghana', id: 77 },
  { code: 'TOGO', name: 'Ministry of Religious Affairs, Togo', id: 78 },
  { code: 'BENIN', name: 'Ministry of Religious Affairs, Benin', id: 79 },
  { code: 'NIGERIA', name: 'Ministry of Religious Affairs, Nigeria', id: 80 },
  { code: 'CAMEROON', name: 'Ministry of Religious Affairs, Cameroon', id: 81 },
  { code: 'CHAD', name: 'Ministry of Religious Affairs, Chad', id: 82 },
  { code: 'CENTRAL_AFRICAN_REPUBLIC', name: 'Ministry of Religious Affairs, Central African Republic', id: 83 },
  { code: 'SUDAN', name: 'Ministry of Religious Affairs, Sudan', id: 84 },
  { code: 'SOUTH_SUDAN', name: 'Ministry of Religious Affairs, South Sudan', id: 85 },
  { code: 'ETHIOPIA', name: 'Ministry of Religious Affairs, Ethiopia', id: 86 },
  { code: 'ERITREA', name: 'Ministry of Religious Affairs, Eritrea', id: 87 },
  { code: 'DJIBOUTI', name: 'Ministry of Religious Affairs, Djibouti', id: 88 },
  { code: 'SOMALIA', name: 'Ministry of Endowments and Religious Affairs, Somalia', id: 89 },
  { code: 'KENYA', name: 'Ministry of Religious Affairs, Kenya', id: 90 },
  { code: 'UGANDA', name: 'Ministry of Religious Affairs, Uganda', id: 91 },
  { code: 'TANZANIA', name: 'Ministry of Religious Affairs, Tanzania', id: 92 },
  { code: 'RWANDA', name: 'Ministry of Religious Affairs, Rwanda', id: 93 },
  { code: 'BURUNDI', name: 'Ministry of Religious Affairs, Burundi', id: 94 },
  { code: 'MADAGASCAR', name: 'Ministry of Religious Affairs, Madagascar', id: 95 },
  { code: 'MAURITIUS', name: 'Ministry of Religious Affairs, Mauritius', id: 96 },
  { code: 'SEYCHELLES', name: 'Ministry of Religious Affairs, Seychelles', id: 97 },
  { code: 'COMOROS', name: 'Ministry of Religious Affairs, Comoros', id: 98 },
  { code: 'MALDIVES', name: 'Ministry of Religious Affairs, Maldives', id: 99 },
  { code: 'SRI_LANKA', name: 'Department of Muslim Religious and Cultural Affairs, Sri Lanka', id: 100 }
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

async function syncAllCitiesComprehensive() {
  try {
    console.log('🚀 Starting comprehensive prayer times sync for all cities...\n');
    console.log(`📊 Will sync ${PRAYER_METHODS.length} methods × ${SCHOOLS.length} schools = ${PRAYER_METHODS.length * SCHOOLS.length} combinations per location\n`);

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

    const totalCombinations = locations.length * PRAYER_METHODS.length * SCHOOLS.length;
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
    PRAYER_METHODS.forEach(method => {
      results.methodStats[method.name] = { successful: 0, failed: 0 };
    });
    SCHOOLS.forEach(school => {
      results.schoolStats[school.name] = { successful: 0, failed: 0 };
    });

    let operationCount = 0;

    // Sync each location with each method and school combination
    for (let i = 0; i < locations.length; i++) {
      const location = locations[i];
      console.log(`\n📍 [${i + 1}/${locations.length}] Processing location: ${location.city || 'Unknown'}, ${location.country || 'Unknown'}`);
      
      for (let j = 0; j < PRAYER_METHODS.length; j++) {
        const method = PRAYER_METHODS[j];
        
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
          await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 second delay
        }
      }
    }

    // Print comprehensive summary
    console.log('\n📈 COMPREHENSIVE SYNC SUMMARY');
    console.log('==============================');
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
      console.log('\n❌ ERRORS (showing first 20):');
      results.errors.slice(0, 20).forEach((error, index) => {
        console.log(`${index + 1}. ${error.location} (${error.method}, ${error.school}): ${error.error}`);
      });
      if (results.errors.length > 20) {
        console.log(`... and ${results.errors.length - 20} more errors`);
      }
    }

    console.log('\n🎉 Comprehensive sync process completed!');
    console.log('💡 You can now check the admin dashboard to see the prayer times data.');
    console.log('💡 The database now contains prayer times for multiple calculation methods and schools of thought.');

  } catch (error) {
    console.error('❌ Fatal error during sync process:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the comprehensive sync
syncAllCitiesComprehensive().catch(console.error);
