# Contributing Guidelines

Thank you for considering contributing to the YouTube Account Manager project! This document provides guidelines and best practices for contributing.

## 📋 Table of Contents

- [Code Structure](#code-structure)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Adding New Features](#adding-new-features)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)

## 🏗️ Code Structure

Please read [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) to understand the project architecture before making changes.

### Key Principles

1. **Separation of Concerns**: Keep controllers, services, and helpers separate
2. **Single Responsibility**: Each module should have one clear purpose
3. **DRY (Don't Repeat Yourself)**: Extract common logic into helpers/utilities
4. **Constants**: Use `src/config/constants.js` for configuration values

## 🚀 Development Setup

### Prerequisites

- Node.js 14+
- MySQL 5.7+
- Git

### Installation

```bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

## 📝 Coding Standards

### JavaScript Style Guide

#### 1. **Use Async/Await**

✅ Good:
```javascript
async function createChannel(page, channelName) {
  try {
    const result = await channelService.createChannel(page, channelName);
    return result;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}
```

❌ Bad:
```javascript
function createChannel(page, channelName) {
  return channelService.createChannel(page, channelName)
    .then(result => result)
    .catch(error => {
      console.error('Error:', error);
      throw error;
    });
}
```

#### 2. **Error Handling**

Always use try-catch blocks:

✅ Good:
```javascript
async function someFunction() {
  try {
    await doSomething();
  } catch (error) {
    console.error('Error:', error);
    throw error; // or handle appropriately
  }
}
```

❌ Bad:
```javascript
async function someFunction() {
  await doSomething(); // No error handling
}
```

#### 3. **Logging**

Use emoji prefixes for visual clarity:

```javascript
console.log('📺 Creating channel...');    // Info
console.log('✅ Success!');               // Success
console.log('⚠️  Warning...');            // Warning
console.error('❌ Error occurred');       // Error
console.log('🔍 Searching...');           // Debug
console.log('⏳ Waiting...');             // Waiting
console.log('🖼️  Uploading image...');    // Upload
console.log('💾 Saving to database...');  // Database
```

#### 4. **Function Documentation**

Use JSDoc comments:

```javascript
/**
 * Create a new YouTube channel
 * @param {Page} page - Puppeteer page instance
 * @param {string} channelName - Name for the channel
 * @returns {Promise<{created: boolean, channelName?: string}>}
 * @throws {Error} If channel creation fails after all retries
 */
async function createChannel(page, channelName) {
  // Implementation
}
```

#### 5. **Naming Conventions**

- **Variables/Functions**: camelCase (`channelName`, `createChannel`)
- **Classes**: PascalCase (`YoutubeService`, `AccountYoutube`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- **Files**: kebab-case (`channel.service.js`, `name.generator.js`)

#### 6. **Constants**

Never hardcode values in logic:

✅ Good:
```javascript
const { SELECTORS, TIMEOUTS } = require('../config/constants');

await page.waitForSelector(SELECTORS.CHANNEL_CREATE_BUTTON, {
  timeout: TIMEOUTS.DEFAULT
});
```

❌ Bad:
```javascript
await page.waitForSelector('button#create-channel', {
  timeout: 30000
});
```

### File Organization

```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── services/        # Business logic
│   └── youtube/     # Sub-services for specific domains
├── helpers/         # Utility functions
├── models/          # Database models
├── routes/          # API routes
└── middlewares/     # Express middlewares
```

## ✨ Adding New Features

### 1. Create a New Service

If adding a new major feature:

```bash
# Create service file
touch src/services/my-feature.service.js

# If it's complex, create a sub-folder
mkdir src/services/my-feature/
touch src/services/my-feature/index.js
touch src/services/my-feature/sub-service.js
```

Template:

```javascript
/**
 * My Feature Service
 * 
 * Description of what this service does
 */

class MyFeatureService {
  /**
   * Main function description
   * @param {Type} param - Parameter description
   * @returns {Promise<ReturnType>}
   */
  async doSomething(param) {
    try {
      // Implementation
      return result;
    } catch (error) {
      console.error('❌ Error:', error.message);
      throw error;
    }
  }
}

module.exports = new MyFeatureService();
```

### 2. Add a New Helper

For utility functions:

```javascript
// src/helpers/my-helper.js

/**
 * Description of what this helper does
 */

/**
 * Function description
 * @param {Type} param - Parameter description
 * @returns {ReturnType}
 */
function helperFunction(param) {
  // Implementation
  return result;
}

module.exports = {
  helperFunction
};
```

Don't forget to export in `src/helpers/index.js`:

```javascript
const myHelper = require('./my-helper');

module.exports = {
  // ...existing exports,
  myHelper
};
```

### 3. Add Constants

Always add new configuration to `src/config/constants.js`:

```javascript
module.exports = {
  // ...existing constants,
  
  MY_FEATURE: {
    SETTING_1: 'value1',
    SETTING_2: 'value2',
    TIMEOUT: 5000
  }
};
```

### 4. Add a New Controller

```javascript
// src/controllers/my-feature.controller.js

const myFeatureService = require('../services/my-feature.service');

class MyFeatureController {
  async handleRequest(req, res) {
    try {
      const result = await myFeatureService.doSomething(req.body);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ Controller Error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new MyFeatureController();
```

### 5. Add Routes

```javascript
// src/routes/v1/my-feature.routes.js

const express = require('express');
const router = express.Router();
const myFeatureController = require('../../controllers/my-feature.controller');

router.post('/do-something', myFeatureController.handleRequest);

module.exports = router;
```

Register in `src/routes/v1/index.js`:

```javascript
const myFeatureRoutes = require('./my-feature.routes');

router.use('/my-feature', myFeatureRoutes);
```

## 🧪 Testing

### Manual Testing

```bash
# Start the server
npm start

# Test your endpoint
curl -X POST http://localhost:3000/api/v1/my-feature/do-something \
  -H "Content-Type: application/json" \
  -d '{"param": "value"}'
```

### Adding Unit Tests (Future)

When we add testing framework:

```javascript
// tests/services/my-feature.service.test.js

describe('MyFeatureService', () => {
  it('should do something correctly', async () => {
    const result = await myFeatureService.doSomething('input');
    expect(result).toBe('expected');
  });
});
```

## 📥 Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feature/my-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

- Follow coding standards
- Add comments where necessary
- Update documentation if needed

### 3. Test Your Changes

- Test manually
- Ensure no breaking changes
- Check error handling

### 4. Commit

Use meaningful commit messages:

```bash
git add .
git commit -m "feat: add new feature for X"
# or
git commit -m "fix: resolve issue with Y"
# or
git commit -m "refactor: improve Z service"
```

Commit message prefixes:
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### 5. Update CHANGELOG.md

Add your changes to the "Unreleased" section:

```markdown
## [Unreleased]

### Added
- New feature X that does Y
```

### 6. Push and Create PR

```bash
git push origin feature/my-feature-name
```

Then create a Pull Request with:
- Clear title
- Description of changes
- Screenshots (if UI changes)
- Testing steps

## ❓ Questions?

If you have questions about contributing, please:
1. Check existing documentation
2. Look at similar code in the project
3. Open an issue for discussion

## 📚 Resources

- [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) - Project architecture
- [CHANGELOG.md](./CHANGELOG.md) - Version history
- [README.md](./README.md) - Main documentation

Thank you for contributing! 🎉
