# Security Policy

## Supported Versions

| Version    | Supported |
| ---------- | --------- |
| main       | ✅        |
| release/\* | ✅        |
| older      | ❌        |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues by emailing **varunrachakatla0708@gmail.com** with the subject line `[SECURITY] nevereveralone`.

Include:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You will receive an acknowledgement within **48 hours** and a resolution timeline within **7 days**.

## Security Measures

- All API endpoints require JWT authentication
- Passwords hashed with bcryptjs (cost factor 12)
- Rate limiting on all public endpoints
- Helmet.js security headers
- Input validation via express-validator
- npm audit run on every PR
- GitHub CodeQL static analysis on every push to main
- Dependency vulnerability scanning via Dependabot
