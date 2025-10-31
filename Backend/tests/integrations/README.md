# Integration Tests

Tests for external service integrations like WhatsApp Media API and smart retry mechanisms.

## Files in This Directory

### test-media-expiry.js
**Purpose**: Test WhatsApp media ID expiry management  
**What it tests**:
- Current media storage status
- Media refresh requirements
- Media ID validation
- Automatic refresh mechanism
- Media expiry tracking

**Usage**:
```bash
node tests/integrations/test-media-expiry.js
```

**What it checks**:
- Media storage for each language (en, hi, hing)
- Days until media expires
- Whether media needs refresh
- Automatic refresh functionality

**Output Example**:
```
📋 Current Media Storage:
{
  "media": {
    "en": "1234567890",
    "hi": "0987654321",
    "hing": "1122334455"
  },
  "expiresAt": "2025-11-28T00:00:00.000Z"
}

🔍 Checking Refresh Status:
en: ✅ Valid (30 days left)
hi: ✅ Valid (30 days left)
hing: ⚠️  NEEDS REFRESH (2 days left)
```

---

### test-smart-retry.js
**Purpose**: Test automatic retry mechanism with media refresh  
**What it tests**:
- Normal message send with valid media
- Automatic retry when media expires
- Media ID refresh on failure
- Retry limit enforcement (prevents infinite loops)
- Error handling in retry logic

**Usage**:
```bash
node tests/integrations/test-smart-retry.js
```

**Test Scenarios**:
1. ✅ Normal send with valid media ID
2. 🔄 Send with expired/invalid media ID (triggers auto-retry)
3. ⚠️  Verify only 1 retry attempt (no infinite loops)

**Configuration**:
Edit test constants in the file:
```javascript
const TEST_PHONE = '919354739451';
const TEST_NAME = 'Test User';
const TEST_LANGUAGE = 'en';
```

**Dependencies**: Meta WhatsApp API credentials

---

## Running Integration Tests

### Run Individual Test
```bash
# Media expiry check
node tests/integrations/test-media-expiry.js

# Smart retry mechanism
node tests/integrations/test-smart-retry.js
```

### Future: Main Test Runner Integration
```bash
node run-tests.js --integration-tests
```

## Prerequisites

### Environment Variables Required
```bash
META_ACCESS_TOKEN=your_token
META_PHONE_NUMBER_ID=your_phone_id
```

### External Services
- **Meta WhatsApp Business API**: Must be configured and active
- **Valid Media IDs**: Must have uploaded media to WhatsApp

## When to Run These Tests

### Media Expiry Test
- Before deploying to production
- When media IDs are expiring soon (< 7 days)
- After updating media refresh logic
- When troubleshooting template message failures

### Smart Retry Test
- After modifying retry mechanism
- When testing error recovery
- Before production deployment
- When WhatsApp API changes

## Common Issues

### Media Expiry Test Fails
**Symptom**: "Media not found" error  
**Solution**: 
- Check if media IDs exist in `config/whatsappTemplateConfig.js`
- Verify media was uploaded to WhatsApp
- Run media refresh manually

### Smart Retry Test Fails
**Symptom**: "Invalid phone number" or "Message send failed"  
**Solution**:
- Update TEST_PHONE to a valid test number
- Ensure phone number is registered with WhatsApp
- Check META_ACCESS_TOKEN is valid
- Verify you're within 24-hour customer window (for non-template messages)

## Best Practices

1. **Check Media Expiry Weekly**: Run media expiry test weekly to catch expiring media
2. **Test Retry Before Deploy**: Always test retry mechanism after API changes
3. **Use Test Phone Numbers**: Never use production phone numbers for testing
4. **Monitor Rate Limits**: WhatsApp has rate limits, space out test runs

## Integration with Main Test Suite

These tests can be added to `run-tests.js` as:

```javascript
// In run-tests.js menu
console.log('🔌 INTEGRATION TESTS');
console.log('  14. Check Media Expiry Status');
console.log('  15. Test Smart Retry Mechanism');
```

See `TESTING_GUIDE.md` for instructions on extending the test suite.
