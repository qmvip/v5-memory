# Contributing to V5 Memory

> Welcome! This project follows the "本质、极简、落地" philosophy.

## Quick Start

```bash
# Clone
git clone https://github.com/wangyi/v5-memory.git
cd v5-memory

# Install
npm install

# Develop
npm run dev
```

## Project Structure

```
v5-memory/
├── src/core/           # Core engine
│   ├── engine/         # V5 meta engine
│   ├── adapt/          # Platform adapters
│   ├── security/       # Security layer
│   ├── storage/        # Storage layer
│   └── ...
├── src/complete/       # CLI version
├── src/web/            # Chrome extension
└── src/ide/           # VS Code plugin
```

## Development Guidelines

### Code Style
- Use ES modules (import/export)
- Add JSDoc comments for public APIs
- Keep functions small and focused

### V5 Equation
All memory operations use the V5 barrier equation:
```
P = 1 / (1 + e^(-2γ(Input-B)))
```

### Testing
```bash
npm test
```

## Submitting Changes

1. Fork the repo
2. Create a feature branch
3. Make changes
4. Submit a PR

## Commit Messages

Format: `<type>: <description>`

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `refactor`: Code refactoring
- `test`: Tests

## License

MIT - see [LICENSE](./LICENSE)
