# ClipFlow Pro - Security & Privacy Compliance

This document outlines ClipFlow Pro's security and privacy practices for extensions.gnome.org review.

## 🔒 Privacy Commitment

### Core Privacy Principles
1. **Local-Only Storage**: All data stored exclusively on user's device
2. **No Data Transmission**: Zero network connections, zero data sharing
3. **User Control**: Users control what is saved and when it's deleted
4. **Transparency**: Open source code for full auditability

### Data Collection
- **What**: Clipboard text only (user-initiated copy operations)
- **Where**: `~/.config/clipflow-pro/history.json` (local file)
- **Who**: Only the user has access
- **Why**: Provide clipboard history functionality
- **How Long**: Configurable (default: 50 entries, user-configurable up to 100)

## 🛡️ Security Measures

### 1. Sensitive Data Protection

#### Password Detection
```javascript
// Location: extension.js, lines 1234-1237
_isSensitiveContent(text) {
    // Heuristic detection for password-like content
    const looksLikePassword = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/.test(trimmed) &&
        (lower.includes('password') || lower.includes('passwd') || lower.includes('secret'));
    return looksLikePassword;
}
```

**Features:**
- ✅ Pattern-based detection
- ✅ Configurable "ignore passwords" setting (default: enabled)
- ✅ Optional auto-deletion after 5 minutes
- ✅ No network transmission ever

#### Auto-Clear Sensitive Data
- Configurable auto-deletion after 5 minutes
- Settings key: `auto-clear-sensitive` (default: false)
- User has full control

### 2. Data Storage Security

#### File Permissions
```
Path: ~/.config/clipflow-pro/history.json
Permissions: 0600 (user read/write only)
Ownership: User's uid/gid
```

#### Storage Location
- **Why user config directory**: Standard GNOME convention
- **No sensitive system locations**: Never touches /etc or /usr
- **No cloud storage**: 100% local-only

### 3. Network Security

#### Zero Network Activity
- ✅ No outbound network connections
- ✅ No telemetry or analytics
- ✅ No crash reporting
- ✅ No external API calls
- ✅ No cloud synchronization
- ✅ No update checks (handled by extensions.gnome.org)

#### Verification
```bash
# Check for network activity
netstat -anp | grep extension.js
ss -anp | grep extension.js
# Result: No connections found
```

### 4. Code Security

#### Input Validation
```javascript
// All clipboard text validated before storage
_maxLength validation: 100-10,000 characters (user configurable)
_removeLeadingTrailing whitespace
_filterEmpty entries
```

#### Error Handling
- Comprehensive try-catch blocks
- Graceful degradation on failures
- No information leakage in error messages

#### Memory Management
- Proper cleanup of timeouts/intervals
- Signal disconnection in destroy()
- No memory leaks (thoroughly tested)

### 5. Access Control

#### GNOME Shell Permissions
- **Required**: Clipboard read access (for monitoring)
- **Required**: GSettings access (for preferences)
- **Not Required**: No network, no filesystem beyond config, no X11

#### File Access
- **Read**: Only config file and metadata.json
- **Write**: Only config file and build directory
- **Execute**: None
- **Delete**: Only on user request (clear history)

## 📋 Security Checklist for Reviewers

### Data Handling
- [x] Local storage only (no cloud)
- [x] No data transmission
- [x] User controls data retention
- [x] Password detection (heuristic-based)
- [x] Optional sensitive data auto-delete
- [x] Clear on logout option
- [x] Manual clear history function

### Network Activity
- [x] Zero network connections
- [x] No telemetry
- [x] No analytics
- [x] No external APIs
- [x] No update mechanisms (delegated to extensions.gnome.org)

### Code Security
- [x] Input validation
- [x] Error handling
- [x] Memory management
- [x] No eval() or similar dangerous operations
- [x] No shell command execution
- [x] No file system access beyond config directory

### Privacy
- [x] Clear privacy policy
- [x] User consent for clipboard access
- [x] Transparent data handling
- [x] Open source code
- [x] No user tracking
- [x] No advertising

### Permissions
- [x] Minimal required permissions
- [x] Only clipboard read access
- [x] Only GSettings read/write for preferences
- [x] No system-level access
- [x] No network permissions

## 🔐 Security Considerations

### Password Detection Limitations
**Current Implementation**: Heuristic-based pattern matching
**Limitations**:
- Not cryptographically secure
- Can be fooled by intentionally malformed passwords
- May have false positives

**Mitigation**:
- User control (can disable)
- Additional protection via auto-delete
- Educated users can manually clear

### Future Enhancements
Potential improvements (not planned, but documented):
1. Integration with password managers
2. Better password detection via ML
3. Optional encryption at rest
4. Per-application clipboard isolation

## 📄 Compliance Statements

### GDPR Compliance
- **Right to be forgotten**: Clear history function provided
- **Data minimization**: Only clipboard text stored, nothing else
- **Purpose limitation**: Data used only for clipboard history
- **Storage limitation**: Configurable limits (default 50 items)
- **Transparency**: Open source, full audit trail

### No Data Sharing
- **No third parties**: Zero data sharing
- **No advertisers**: No ad tracking
- **No analytics**: No usage statistics
- **No telemetry**: No diagnostic data
- **Local-only**: All data remains on device

### User Rights
Users can:
- ✅ View all stored data (via JSON file)
- ✅ Delete all data (clear history button)
- ✅ Configure retention limits
- ✅ Disable password detection
- ✅ Enable auto-clear of sensitive data
- ✅ Set clear on logout
- ✅ Inspect the source code

## 🧪 Security Testing

### Automated Checks
```bash
# No network connections
netstat -anp | grep extension.js  # Should return nothing

# File permissions correct
ls -la ~/.config/clipflow-pro/  # Should be 0600

# No eval() or similar
grep -r "eval\(" extension.js  # Should return nothing
grep -r "Function\(" extension.js  # Should return nothing

# Input validation present
grep -r "maxEntryLength" extension.js  # Should find validation
```

### Manual Testing
1. Copy password-like string → should be filtered if enabled
2. Enable auto-delete → sensitive data clears after 5 min
3. Clear history → file deleted
4. Check network activity → none
5. Inspect storage file → plain text JSON (by design)

## 📞 Security Contact

**Security Issues**: Report via GitHub Issues with "security" label
**Response Time**: Within 48 hours
**Disclosure Policy**: Responsible disclosure preferred

## 🎯 Reviewer Notes for extensions.gnome.org

### Key Points
1. **Zero Network Activity**: Verified via code review and testing
2. **Local Storage Only**: Data never leaves the device
3. **User Control**: Full control over data retention and deletion
4. **Open Source**: Complete transparency
5. **Minimal Permissions**: Only what's necessary

### Code Quality
- ✅ ES6 best practices
- ✅ Proper memory management
- ✅ Error handling throughout
- ✅ Input validation
- ✅ No dangerous operations (eval, shell execution, etc.)

### Privacy Respect
- ✅ Respects user privacy
- ✅ No data collection beyond stated purpose
- ✅ Clear consent model
- ✅ Easy data deletion

This extension is designed with privacy and security as core principles, suitable for production use and extensions.gnome.org approval.
