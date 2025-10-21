#!/bin/bash

# ClipFlow Pro - Installation Script
# Advanced Clipboard Manager for GNOME Shell
# Created by Nick Otmazgin
# https://github.com/nickotmazgin/clipflow-pro

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Extension details
EXTENSION_UUID="clipflow-pro@nickotmazgin.github.io"
EXTENSION_NAME="ClipFlow Pro"
GITHUB_REPO="https://github.com/nickotmazgin/clipflow-pro"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

# Functions
print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}           ClipFlow Pro Installer${NC}"
    echo -e "${BLUE}   Advanced Clipboard Manager for GNOME Shell${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_requirements() {
    print_info "Checking system requirements..."
    
    # Check if GNOME Shell is available
    if ! command -v gnome-shell &> /dev/null; then
        print_error "GNOME Shell is not installed or not in PATH"
        exit 1
    fi
    
    # Check GNOME Shell version
    GNOME_VERSION=$(gnome-shell --version | grep -oE '[0-9]+' | head -1)
    if [ "$GNOME_VERSION" -lt 40 ]; then
        print_error "GNOME Shell version 40+ is required. Found version: $GNOME_VERSION"
        exit 1
    fi
    
    print_success "GNOME Shell version $GNOME_VERSION detected"
    
    # Check for required tools
    local missing_tools=()
    for tool in curl unzip glib-compile-schemas; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_info "Please install them using your package manager:"
        print_info "Ubuntu/Debian: sudo apt install curl unzip libglib2.0-dev-bin"
        print_info "Fedora: sudo dnf install curl unzip glib2-devel"
        print_info "Arch Linux: sudo pacman -S curl unzip glib2"
        exit 1
    fi
    
    print_success "All requirements satisfied"
}

download_extension() {
    print_info "Downloading ClipFlow Pro..."
    
    local temp_dir=$(mktemp -d)
    local zip_file="$temp_dir/clipflow-pro.zip"
    
    # Try to download from GitHub releases
    if curl -L -f -s -o "$zip_file" "$GITHUB_REPO/releases/latest/download/$EXTENSION_UUID.zip"; then
        print_success "Downloaded from GitHub releases"
    else
        print_warning "Release not found, downloading from main branch..."
        if curl -L -f -s -o "$temp_dir/clipflow-pro-main.zip" "$GITHUB_REPO/archive/main.zip"; then
            print_success "Downloaded source from main branch"
            # For source installation, we'll need to build it
            cd "$temp_dir"
            unzip -q clipflow-pro-main.zip
            cd clipflow-pro-main
            if [ -f "Makefile" ]; then
                make build
                zip_file="dist/$EXTENSION_UUID.zip"
                if [ ! -f "$zip_file" ]; then
                    print_error "Failed to build extension from source"
                    exit 1
                fi
            else
                print_error "Invalid source package"
                exit 1
            fi
        else
            print_error "Failed to download ClipFlow Pro"
            print_info "Please check your internet connection and try again"
            exit 1
        fi
    fi
    
    echo "$zip_file"
}

install_extension() {
    local zip_file="$1"
    
    print_info "Installing ClipFlow Pro..."
    
    # Remove existing installation if present
    if [ -d "$EXTENSION_DIR" ]; then
        print_warning "Existing installation found, removing..."
        rm -rf "$EXTENSION_DIR"
    fi
    
    # Create extension directory
    mkdir -p "$EXTENSION_DIR"
    
    # Extract extension
    if unzip -q "$zip_file" -d "$EXTENSION_DIR"; then
        print_success "Extension files extracted"
    else
        print_error "Failed to extract extension files"
        exit 1
    fi
    
    # Compile GSettings schema if present
    if [ -d "$EXTENSION_DIR/schemas" ]; then
        if glib-compile-schemas "$EXTENSION_DIR/schemas/"; then
            print_success "GSettings schema compiled"
        else
            print_error "Failed to compile GSettings schema"
            exit 1
        fi
    fi
    
    # Set proper permissions
    chmod -R 755 "$EXTENSION_DIR"
    
    print_success "ClipFlow Pro installed successfully"
}

enable_extension() {
    print_info "Enabling ClipFlow Pro..."
    
    # Check if gnome-extensions command exists
    if command -v gnome-extensions &> /dev/null; then
        if gnome-extensions enable "$EXTENSION_UUID" 2>/dev/null; then
            print_success "Extension enabled"
        else
            print_warning "Failed to enable extension automatically"
            print_info "You can enable it manually using:"
            print_info "  - GNOME Extensions app"
            print_info "  - gnome-extensions enable $EXTENSION_UUID"
        fi
    else
        print_warning "gnome-extensions command not found"
        print_info "Please enable the extension manually using GNOME Extensions app"
    fi
}

restart_gnome_shell() {
    print_info "Restarting GNOME Shell..."
    
    # Check if running on Wayland
    if [ "$XDG_SESSION_TYPE" = "wayland" ]; then
        print_warning "Running on Wayland - you need to log out and back in"
        print_info "Or restart your system to activate the extension"
    else
        print_info "Restarting GNOME Shell (X11 session)..."
        print_info "Press Alt+F2, type 'r', and press Enter to restart GNOME Shell"
    fi
}

print_completion() {
    echo ""
    print_success "Installation completed successfully!"
    echo ""
    print_info "What's next:"
    echo "  1. If on X11: Press Alt+F2, type 'r', press Enter"
    echo "  2. If on Wayland: Log out and back in"
    echo "  3. Look for the clipboard icon in your top panel"
    echo "  4. Press Super+Shift+V to open clipboard menu"
    echo "  5. Access settings via Extensions app or extension menu"
    echo ""
    print_info "Documentation: $GITHUB_REPO"
    print_info "Support: $GITHUB_REPO/issues"
    print_info "Donate: https://www.paypal.com/donate/?hosted_button_id=4HM44VH47LSMW"
    echo ""
    print_success "Thank you for using ClipFlow Pro!"
}

cleanup() {
    if [ -n "$temp_dir" ] && [ -d "$temp_dir" ]; then
        rm -rf "$temp_dir"
    fi
}

# Main installation process
main() {
    trap cleanup EXIT
    
    print_header
    
    check_requirements
    echo ""
    
    zip_file=$(download_extension)
    echo ""
    
    install_extension "$zip_file"
    echo ""
    
    enable_extension
    echo ""
    
    restart_gnome_shell
    echo ""
    
    print_completion
}

# Handle script arguments
case "$1" in
    --help|-h)
        echo "ClipFlow Pro Installation Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --uninstall    Remove ClipFlow Pro"
        echo "  --update       Update to latest version"
        echo ""
        echo "For more information, visit:"
        echo "$GITHUB_REPO"
        exit 0
        ;;
    --uninstall)
        print_header
        print_info "Uninstalling ClipFlow Pro..."
        
        # Disable extension
        if command -v gnome-extensions &> /dev/null; then
            gnome-extensions disable "$EXTENSION_UUID" 2>/dev/null || true
        fi
        
        # Remove extension directory
        if [ -d "$EXTENSION_DIR" ]; then
            rm -rf "$EXTENSION_DIR"
            print_success "Extension files removed"
        else
            print_warning "Extension not found"
        fi
        
        # Optionally remove user data
        if [ -d "$HOME/.config/clipflow-pro" ]; then
            read -p "Remove clipboard history and settings? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rm -rf "$HOME/.config/clipflow-pro"
                print_success "User data removed"
            fi
        fi
        
        print_success "ClipFlow Pro uninstalled"
        exit 0
        ;;
    --update)
        print_header
        print_info "Updating ClipFlow Pro..."
        main
        exit 0
        ;;
    "")
        # No arguments, run normal installation
        main
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac