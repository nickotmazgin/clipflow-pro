# Contributing to ClipFlow Pro

Thank you for your interest in contributing to ClipFlow Pro! This guide will help you get started with contributing to this advanced clipboard manager for GNOME Shell.

## 🤝 Ways to Contribute

### 1. Report Bugs
- Use the [GitHub Issues](https://github.com/nickotmazgin/clipflow-pro/issues) page
- Search existing issues first to avoid duplicates
- Use the bug report template
- Include system information (GNOME Shell version, distribution, etc.)
- Provide clear steps to reproduce the issue

### 2. Suggest Features
- Open a [GitHub Discussion](https://github.com/nickotmazgin/clipflow-pro/discussions) for feature ideas
- Use the feature request template for formal requests
- Explain the use case and expected behavior
- Consider if it aligns with the project's goals

### 3. Improve Documentation
- Fix typos, grammar, or unclear explanations
- Add missing information or examples
- Translate documentation to other languages
- Create tutorials or guides

### 4. Submit Code
- Bug fixes
- New features (discuss first in GitHub Discussions)
- Performance improvements
- Code refactoring
- Test additions

### 5. Translate the Extension
- Help make ClipFlow Pro available in your language
- See the [Translation Guide](#translation-guide) below

## 🚀 Getting Started

### Prerequisites
- Git
- GNOME Shell 40+ (for testing)
- Basic knowledge of JavaScript/GJS
- Text editor or IDE of your choice

### Development Setup

1. **Fork the Repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/clipflow-pro.git
   cd clipflow-pro
   ```

2. **Install Dependencies**
   ```bash
   # Ubuntu/Debian
   sudo apt install git make glib2.0-dev gettext xmllint
   
   # Fedora
   sudo dnf install git make glib2-devel gettext xmllint
   
   # Arch Linux
   sudo pacman -S git make glib2 gettext libxml2
   ```

3. **Development Installation**
   ```bash
   make dev  # Installs extension and watches for changes
   ```

4. **Enable the Extension**
   ```bash
   gnome-extensions enable clipflow-pro@nickotmazgin.github.io
   ```

### Development Workflow

1. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Make Changes**
   - Follow the existing code style and conventions
   - Add comments for complex logic
   - Update documentation if needed
   - If you edit `schemas/*.gschema.xml`, run `glib-compile-schemas schemas/` so that `schemas/gschemas.compiled` stays in sync (this file is tracked to support rootless installs).

3. **Test Your Changes**
   ```bash
   make validate  # Check file validation
   make test      # Test the extension
   
   # Manual testing
   Alt + F2 → type 'r' → Enter  # Restart GNOME Shell
   ```

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   # or
   git commit -m "fix: resolve issue with clipboard monitoring"
   ```

5. **Push and Create Pull Request**
   ```bash
   git push origin your-branch-name
   # Then create a pull request on GitHub
   ```

### Managing Extension Versions

- Run `make version` to print the current integer `metadata.json` version alongside the human-friendly `version-name`.
- When preparing a release, use `make bump-version` to increment the numeric version safely. This command delegates to
  `tools/version.py`, which validates the manifest and keeps the version field as an integer so GNOME accepts the
  package.

### Keeping Your Branch Up to Date

- When a pull request falls behind `main`, click **Update branch** on GitHub (or merge `main` locally) to bring the
  latest changes into your topic branch. This does **not** discard or hide your commits—it simply adds a merge commit
  with the base branch’s updates.
- If GitHub reports conflicts after updating, resolve them either through the **Resolve conflicts** web editor or by
  merging locally, fixing the files in your editor, and pushing the resolution.
- You do not need to open a brand-new pull request after updating; pushing the resolved branch automatically refreshes
  the existing PR with the latest commits and merge state.


## 📝 Code Guidelines

### JavaScript/GJS Style
```javascript
// Use modern ES6+ features
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// Use consistent naming conventions
class ClipFlowManager {
    constructor(settings) {
        this._settings = settings;
        this._history = [];
    }
    
    // Private methods prefixed with underscore
    _onClipboardChanged() {
        // Implementation
    }
    
    // Public methods without underscore
    getHistory() {
        return this._history;
    }
}

// Use descriptive variable names
const maxClipboardEntries = this._settings.get_int('max-entries');

// Add comments for complex logic
// Monitor clipboard changes and filter duplicates
this._clipboard.connect('owner-changed', () => {
    this._onClipboardChanged();
});
```

### CSS Style Guidelines
```css
/* Use consistent naming with clipflow prefix */
.clipflow-entry-item {
    padding: 8px 12px;
    margin: 2px 0;
    border-radius: 6px;
    transition: all 0.2s ease;
}

/* Support accessibility features */
@media (prefers-reduced-motion: reduce) {
    .clipflow-entry-item {
        transition: none;
    }
}

/* Use semantic class names */
.clipflow-action-delete {
    color: #e01b24;
}
```

### Commit Message Format
Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

feat: add new clipboard search functionality
fix: resolve memory leak in history storage
docs: update installation instructions
style: improve CSS consistency
refactor: reorganize clipboard manager code
test: add unit tests for search functionality
chore: update build dependencies
```

## 🌍 Translation Guide

### Adding a New Language

1. **Create Language Directory**
   ```bash
   mkdir -p locale/[LANG_CODE]/LC_MESSAGES/
   # Example: mkdir -p locale/es/LC_MESSAGES/
   ```

2. **Copy Template**
   ```bash
   cp locale/clipflow-pro.pot locale/[LANG_CODE]/LC_MESSAGES/clipflow-pro.po
   ```

3. **Translate Strings**
   Edit the `.po` file and translate all `msgstr` entries:
   ```po
   msgid "Show Clipboard Menu"
   msgstr "Mostrar Menú del Portapapeles"  # Spanish example
   ```

4. **Compile Translations**
   ```bash
   msgfmt locale/[LANG_CODE]/LC_MESSAGES/clipflow-pro.po \
          -o locale/[LANG_CODE]/LC_MESSAGES/clipflow-pro.mo
   ```

5. **Test Translation**
   ```bash
   LANG=[LANG_CODE] gnome-shell  # Test with your language
   ```

### Translation Guidelines
- Keep translations concise and clear
- Maintain consistent terminology
- Test UI layout with longer translations
- Consider cultural context
- Update both code strings and documentation

## 🧪 Testing

### Manual Testing Checklist
- [ ] Extension loads without errors
- [ ] Clipboard monitoring works correctly
- [ ] Search functionality operates properly
- [ ] Pin/star features work as expected
- [ ] Settings save and load correctly
- [ ] Keyboard shortcuts function properly
- [ ] File manager integration works
- [ ] No memory leaks during extended use

### Automated Testing
```bash
make validate    # Validate all files
make test       # Run extension tests
journalctl --user -f | grep clipflow-pro  # Monitor for errors
```

## 📋 Pull Request Guidelines

### Before Submitting
- [ ] Code follows project style guidelines
- [ ] All tests pass (`make test`)
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventional format
- [ ] No merge conflicts with main branch

### Pull Request Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Code refactoring

## Testing
- [ ] Manual testing completed
- [ ] Automated tests pass
- [ ] Works on multiple GNOME Shell versions

## Screenshots (if applicable)
Add screenshots for UI changes

## Additional Notes
Any additional information or context
```

## 🐛 Issue Guidelines

### Bug Reports
Include:
- **System Information**: GNOME Shell version, distribution, display server
- **Steps to Reproduce**: Clear, numbered steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Logs**: Relevant error messages from `journalctl`
- **Screenshots**: If applicable

### Feature Requests
Include:
- **Problem**: What problem does this solve?
- **Solution**: Proposed solution or feature
- **Alternatives**: Alternative solutions considered
- **Use Cases**: Real-world scenarios where this helps

## 🏆 Recognition

Contributors are recognized in:
- `CONTRIBUTORS.md` file
- GitHub contributors list
- Release notes for significant contributions
- Extension about page (for major contributors)

## 📞 Getting Help

- **GitHub Discussions**: General questions and ideas
- **GitHub Issues**: Bug reports and specific problems
- **Code Review**: All pull requests receive thorough review
- **Documentation**: Comprehensive guides in the repository

## 📄 License

By contributing to ClipFlow Pro, you agree that your contributions will be licensed under the GPL-3.0-or-later license.

## 🙏 Thank You

Every contribution, no matter how small, makes ClipFlow Pro better for everyone. Thank you for taking the time to contribute!

---

**Happy Contributing!** 🎉
