# ClipFlow Pro - Makefile
# Advanced Clipboard Manager for GNOME Shell
# Created by Nick Otmazgin

EXTENSION_UUID = clipflow-pro@nickotmazgin.github.io
EXTENSION_NAME = ClipFlow Pro

# Directories
BUILD_DIR = build
DIST_DIR = dist
SCHEMAS_DIR = schemas
LOCALE_DIR = locale

# Extension installation path
INSTALL_PATH = ~/.local/share/gnome-shell/extensions/$(EXTENSION_UUID)

# Files to include in distribution
EXTENSION_FILES = \
	extension.js \
	prefs.js \
	metadata.json \
	stylesheet.css \
	schemas/org.gnome.shell.extensions.clipflow-pro.gschema.xml \
	icons/clipflow-pro-symbolic.svg

EXTRA_FILES = \
	README.md \
	LICENSE \
	CHANGELOG.md \
	CONTRIBUTING.md

# Default target
all: build

# Clean build artifacts
clean:
	rm -rf $(BUILD_DIR)
	rm -rf $(DIST_DIR)
	rm -f *.zip

# Build the extension
build:
	./build.sh

# Install the extension locally
install: build
	./install.sh

# Uninstall the extension
uninstall:
	@echo "Uninstalling $(EXTENSION_NAME)..."
	rm -rf $(INSTALL_PATH)
	@echo "Extension uninstalled"

# Create distribution package
dist: build
	@echo "Creating distribution packages (EGO flat zip + source)..."
	mkdir -p $(DIST_DIR)
	# EGO flat zip (top-level files)
	rm -f $(DIST_DIR)/$(EXTENSION_UUID).shell-extension.zip
	cd $(BUILD_DIR) && zip -r ../$(DIST_DIR)/$(EXTENSION_UUID).shell-extension.zip .
	# Source zip
	rm -f $(DIST_DIR)/clipflow-pro-source.zip
	zip -r $(DIST_DIR)/clipflow-pro-source.zip \
		$(EXTENSION_FILES) $(EXTRA_FILES) Makefile \
		$(SCHEMAS_DIR) $(LOCALE_DIR) 2>/dev/null || true
	@echo "Distribution packages created in $(DIST_DIR)/"

# Pack using GNOME Extensions tool
pack: build
	@echo "Packing flat zip for extensions.gnome.org..."
	mkdir -p $(DIST_DIR)
	rm -f $(DIST_DIR)/$(EXTENSION_UUID).shell-extension.zip
	cd $(BUILD_DIR) && zip -r ../$(DIST_DIR)/$(EXTENSION_UUID).shell-extension.zip .
	@echo "Packed: $(DIST_DIR)/$(EXTENSION_UUID).shell-extension.zip"

# Development mode - install and watch for changes
dev: install
	@echo "Development mode - watching for changes..."
	@echo "Press Ctrl+C to stop"
	while true; do \
		inotifywait -e modify,create,delete -r . --exclude '\.git|$(BUILD_DIR)|$(DIST_DIR)' 2>/dev/null && \
		make install && \
		echo "Extension reloaded - restart GNOME Shell to see changes"; \
	done

# Validate extension files
validate:
	@echo "Validating extension files..."
	
	# Check for required files
	@for file in extension.js metadata.json; do \
		if [ ! -f "$$file" ]; then \
			echo "ERROR: Required file $$file is missing"; \
			exit 1; \
		fi; \
	done
	
	# Validate metadata.json
	@if ! python3 -m json.tool metadata.json > /dev/null 2>&1; then \
		echo "ERROR: metadata.json is not valid JSON"; \
		exit 1; \
	fi
	
	# Check for GSettings schema
	@if [ -f "$(SCHEMAS_DIR)/org.gnome.shell.extensions.clipflow-pro.gschema.xml" ]; then \
		if ! xmllint --noout $(SCHEMAS_DIR)/org.gnome.shell.extensions.clipflow-pro.gschema.xml; then \
			echo "ERROR: GSettings schema is not valid XML"; \
			exit 1; \
		fi; \
	fi
	
	@echo "Validation passed!"

# Test the extension
test: validate install
	@echo "Testing extension..."
	gnome-extensions enable $(EXTENSION_UUID)
	@echo "Extension enabled - check GNOME Shell for any errors"
	journalctl -f | grep -i clipflow &
	sleep 5
	kill %1 2>/dev/null || true

# Package for different distribution methods
package: dist
	@echo "Creating distribution packages..."
	
	# Create Flatpak manifest (if needed in future)
	# Create .deb package structure (if needed)
	# Create RPM spec (if needed)
	
	@echo "Packaging complete!"

# Help target
help:
	@echo "ClipFlow Pro Build System"
	@echo ""
	@echo "Available targets:"
	@echo "  all      - Build the extension (default)"
	@echo "  build    - Build the extension"
	@echo "  install  - Install the extension locally"
	@echo "  uninstall- Uninstall the extension"
	@echo "  dist     - Create distribution packages"
	@echo "  dev      - Development mode with file watching"
	@echo "  validate - Validate extension files"
	@echo "  test     - Test the extension"
	@echo "  package  - Create packages for distribution"
	@echo "  clean    - Clean build artifacts"
	@echo "  help     - Show this help message"

# Version management
version:
	@python3 tools/version.py show

bump-version:
	@python3 tools/version.py bump

.PHONY: all build install uninstall dist dev validate test package clean help version bump-version
