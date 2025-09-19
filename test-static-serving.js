// Simple test to verify static file serving works
const express = require('express');
const path = require('path');
const { ServeStaticModule } = require('@nestjs/serve-static');

const app = express();

// Test if the admin dashboard build files exist
const adminBuildPath = path.join(__dirname, 'admin-dashboard', 'dist');
const fs = require('fs');

console.log('🔍 Checking admin dashboard build files...');
console.log('Admin build path:', adminBuildPath);

if (fs.existsSync(adminBuildPath)) {
    console.log('✅ Admin dashboard build directory exists');
    
    // List contents
    const contents = fs.readdirSync(adminBuildPath);
    console.log('Build contents:', contents);
    
    // Check for static directory
    const staticPath = path.join(adminBuildPath, 'static');
    if (fs.existsSync(staticPath)) {
        console.log('✅ Static directory exists');
        const staticContents = fs.readdirSync(staticPath);
        console.log('Static contents:', staticContents);
    } else {
        console.log('❌ Static directory not found');
    }
    
    // Check for server directory
    const serverPath = path.join(adminBuildPath, 'server');
    if (fs.existsSync(serverPath)) {
        console.log('✅ Server directory exists');
        const serverContents = fs.readdirSync(serverPath);
        console.log('Server contents:', serverContents);
    } else {
        console.log('❌ Server directory not found');
    }
    
} else {
    console.log('❌ Admin dashboard build directory not found');
    console.log('Please run: npm run build:admin');
}

// Test basic static serving
app.use('/admin', express.static(adminBuildPath));

app.get('/test', (req, res) => {
    res.json({ message: 'Static serving test endpoint' });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`\n🚀 Test server running on http://localhost:${PORT}`);
    console.log('Test endpoints:');
    console.log(`- http://localhost:${PORT}/test`);
    console.log(`- http://localhost:${PORT}/admin`);
    console.log('\nPress Ctrl+C to stop');
});
