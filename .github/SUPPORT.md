# Support

Thank you for using ClipFlow Pro! We're here to help you get the most out of your clipboard manager.

## 📚 Documentation

- **[README.md](../README.md)** - Comprehensive overview and features
- **[INSTALL.md](../INSTALL.md)** - Installation instructions
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Guide for contributors
- **[SECURITY_PRIVACY.md](../docs/SECURITY_PRIVACY.md)** - Privacy and security information

## 💬 Getting Help

### Before Asking

Please check these resources first:
1. Read the [README.md](../README.md)
2. Search [existing issues](https://github.com/nickotmazgin/clipflow-pro/issues)
3. Check [previous discussions](https://github.com/nickotmazgin/clipflow-pro/discussions)

### Ask for Help

**GitHub Discussions** (Recommended)
- Ask questions: https://github.com/nickotmazgin/clipflow-pro/discussions
- Search previous questions
- Get help from community

**GitHub Issues**
- Report bugs: https://github.com/nickotmazgin/clipflow-pro/issues/new?template=bug_report.md
- Request features: https://github.com/nickotmazgin/clipflow-pro/issues/new?template=feature_request.md

## 🐛 Reporting Bugs

When reporting a bug, please include:

1. **Environment**
   - GNOME Shell version
   - Extension version
   - Operating system
   - Distribution

2. **Steps to Reproduce**
   - Clear steps to reproduce the issue
   - What you expected to happen
   - What actually happened

3. **Logs**
   - Enable debug logging in extension settings
   - Check `journalctl /usr/bin/gnome-shell -f`

## 💡 Feature Requests

Have an idea? We'd love to hear it!

- Request a feature: https://github.com/nickotmazgin/clipflow-pro/issues/new?template=feature_request.md
- Check [ENHANCEMENT_PROPOSALS.md](../docs/ENHANCEMENT_PROPOSALS.md) for planned features

## 🛠️ Troubleshooting

### Extension Not Showing

1. Enable the extension:
   ```bash
   gnome-extensions enable clipflow-pro@nickotmazgin.github.io
   ```

2. Restart GNOME Shell:
   - Press `Alt+F2`
   - Type `r` and press Enter

### Settings Not Working

1. Recompile schemas:
   ```bash
   glib-compile-schemas ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/schemas/
   ```

2. Restart GNOME Shell

### Keyboard Shortcuts Not Working

1. Check GNOME Settings → Keyboard → Shortcuts
2. Ensure no conflicts with other extensions
3. Reset shortcuts in extension settings

### Performance Issues

1. Reduce maximum entries in settings
2. Reduce entry length limit
3. Enable auto-clear sensitive data
4. Clear clipboard history regularly

## 🔒 Privacy & Security

- **No Data Collection**: All data stored locally
- **No Network**: Zero network connections
- **Privacy First**: Full control over your data

For more details, see [SECURITY_PRIVACY.md](../docs/SECURITY_PRIVACY.md)

## 🤝 Contributing

Want to help improve ClipFlow Pro?

- Read [CONTRIBUTING.md](../CONTRIBUTING.md)
- Fork the repository
- Create a pull request

## 📞 Contact

- **GitHub Issues**: https://github.com/nickotmazgin/clipflow-pro/issues
- **Discussions**: https://github.com/nickotmazgin/clipflow-pro/discussions

## 🌟 Show Your Support

- ⭐ Star the repository
- 📢 Share with others
- 🐛 Report bugs
- 💡 Suggest features
- 🤝 Contribute code
- 💰 [Donate via PayPal](https://www.paypal.com/donate/?hosted_button_id=4HM44VH47LSMW)

Thank you for using ClipFlow Pro! ❤️
