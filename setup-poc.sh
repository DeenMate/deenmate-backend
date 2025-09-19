#!/bin/bash

# Setup Script for NestJS + Next.js Integration Proof of Concept
# This script prepares the environment for testing the integrated application

set -e

echo "🚀 Setting up NestJS + Next.js Integration Proof of Concept"
echo "=========================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_node() {
    print_status "Checking Node.js installation..."
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 20+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        print_error "Node.js version 20+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    print_success "Node.js $(node --version) is installed"
}

# Check if npm is installed
check_npm() {
    print_status "Checking npm installation..."
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    print_success "npm $(npm --version) is installed"
}

# Install backend dependencies
install_backend_deps() {
    print_status "Installing backend dependencies..."
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Are you in the correct directory?"
        exit 1
    fi
    
    npm install
    print_success "Backend dependencies installed"
}

# Install frontend dependencies
install_frontend_deps() {
    print_status "Installing frontend dependencies..."
    if [ ! -d "admin-dashboard" ]; then
        print_error "admin-dashboard directory not found"
        exit 1
    fi
    
    cd admin-dashboard
    npm install
    cd ..
    print_success "Frontend dependencies installed"
}

# Build backend
build_backend() {
    print_status "Building backend..."
    npm run build
    print_success "Backend built successfully"
}

# Build frontend
build_frontend() {
    print_status "Building frontend..."
    cd admin-dashboard
    
    # Create integrated Next.js config
    if [ ! -f "next.config.integrated.ts" ]; then
        print_warning "next.config.integrated.ts not found, using default config"
    fi
    
    # Build with integrated config
    if [ -f "next.config.integrated.ts" ]; then
        cp next.config.integrated.ts next.config.ts
        print_status "Using integrated Next.js configuration"
    fi
    
    npm run build
    cd ..
    print_success "Frontend built successfully"
}

# Check database connection
check_database() {
    print_status "Checking database connection..."
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Please create one with database configuration."
        return 0
    fi
    
    # Try to run a simple database command
    if command -v npx &> /dev/null; then
        if npx prisma db pull --preview-feature &> /dev/null; then
            print_success "Database connection is working"
        else
            print_warning "Database connection test failed. Please check your database configuration."
        fi
    else
        print_warning "npx not available, skipping database check"
    fi
}

# Check Redis connection
check_redis() {
    print_status "Checking Redis connection..."
    
    # Try to connect to Redis
    if command -v redis-cli &> /dev/null; then
        if redis-cli ping &> /dev/null; then
            print_success "Redis connection is working"
        else
            print_warning "Redis connection test failed. Please check your Redis configuration."
        fi
    else
        print_warning "redis-cli not available, skipping Redis check"
    fi
}

# Create test script
create_test_script() {
    print_status "Creating test script..."
    
    if [ ! -f "test-integration.js" ]; then
        print_error "test-integration.js not found"
        exit 1
    fi
    
    chmod +x test-integration.js
    print_success "Test script created and made executable"
}

# Main setup function
main() {
    echo ""
    print_status "Starting setup process..."
    echo ""
    
    # Pre-flight checks
    check_node
    check_npm
    echo ""
    
    # Install dependencies
    install_backend_deps
    install_frontend_deps
    echo ""
    
    # Build applications
    build_backend
    build_frontend
    echo ""
    
    # Check external dependencies
    check_database
    check_redis
    echo ""
    
    # Prepare test environment
    create_test_script
    echo ""
    
    print_success "Setup completed successfully!"
    echo ""
    echo "🎉 Proof of Concept is ready!"
    echo ""
    echo "To start the integrated server:"
    echo "  node poc-server.js"
    echo ""
    echo "To run integration tests:"
    echo "  node test-integration.js"
    echo ""
    echo "To start in development mode:"
    echo "  npm run start:poc:dev"
    echo ""
    echo "📚 Documentation: docs/integration-research.md"
    echo ""
}

# Run main function
main "$@"
