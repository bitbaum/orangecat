---
created_date: 2025-06-05
last_modified_date: 2025-06-05
last_modified_summary: Added documentation standards including creation and modification dates
---

# 📖 Contributing Guidelines

Thank you for your interest in contributing to OrangeCat! This document provides guidelines and instructions for contributing to our project.

## Code of Conduct

Please read and follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/orangecat.git`
3. Create a new branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Push to your fork: `git push origin feature/your-feature-name`
6. Create a Pull Request

## Development Setup

1. Install dependencies: `pnpm install`
2. Create a `.env.local` file based on `.env.example`
3. Start the development server: `pnpm run dev`

## Pull Request Process

1. Run `pnpm run verify` (the same gate CI runs) and make sure it passes
2. Update the docs your change makes untrue, in the same pull request
   (and add a line to the root `CHANGELOG.md` when the change is visible to people)
3. Open a non-draft pull request when the work is ready to ship. Nobody merges
   by hand: once CI is green, `.github/workflows/auto-merge.yml` merges it and
   CD deploys it (see "Shipping" in the root `CLAUDE.md`). Open a draft, or add
   a `hold` label, if it is not ready

## Style Guide

- Follow the existing code style
- Use TypeScript for all new code
- Write tests for new features
- Document your code
- Keep commits focused and atomic

## Questions?

Feel free to open an issue if you have any questions!
