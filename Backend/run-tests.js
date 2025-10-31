/**
 * 🧪 WhatsApp Report Test Suite - Unified Test Runner
 * 
 * Consolidates all WhatsApp report testing into a single, organized interface
 * - Monthly Reports (Template & Custom Message)
 * - Weekly Reports (Template & Custom Message)
 * - Template Validation
 * - Interactive CLI Menu
 * 
 * Usage:
 *   node run-tests.js                    # Interactive menu
 *   node run-tests.js --monthly          # Monthly template test
 *   node run-tests.js --monthly-custom   # Monthly custom message test
 *   node run-tests.js --weekly           # Weekly template test
 *   node run-tests.js --list             # List all available tests
 */

require('dotenv').config();
const readline = require('readline');

// Import test utilities
const { 
    connectToDatabase, 
    closeDatabase,
    getTestConfig,
    displayTestInfo
} = require('./tests/utils/test-helpers');

// Import test suites
const monthlyTests = require('./tests/monthly-report-tests');
const weeklyTests = require('./tests/weekly-report-tests');
const templateTests = require('./tests/template-validation-tests');

// ANSI color codes for pretty output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

/**
 * Display main menu
 */
function displayMenu() {
    console.clear();
    console.log(colors.bright + colors.cyan + '╔════════════════════════════════════════════════════════════════╗');
    console.log('║          🧪 WhatsApp Report Test Suite                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝' + colors.reset);
    console.log('');
    console.log(colors.bright + '📅 MONTHLY REPORTS' + colors.reset);
    console.log('  1. Monthly Report - Template Mode (Production)');
    console.log('  2. Monthly Report - Custom Message Mode (24hr window)');
    console.log('');
    console.log(colors.bright + '📊 WEEKLY REPORTS' + colors.reset);
    console.log('  3. Weekly Report - Template Mode (Production)');
    console.log('  4. Weekly Report - Custom Message Mode (24hr window)');
    console.log('');
    console.log(colors.bright + '🔍 VALIDATION & DIAGNOSTICS' + colors.reset);
    console.log('  5. Validate WhatsApp Templates');
    console.log('  6. Test PDF Generation Only');
    console.log('  7. Test Excel Generation Only');
    console.log('  8. Test S3 Upload');
    console.log('');
    console.log(colors.bright + '⚙️  CONFIGURATION' + colors.reset);
    console.log('  9. View Current Test Configuration');
    console.log('  10. Edit Test Parameters');
    console.log('');
    console.log(colors.bright + '🚀 BULK TESTS' + colors.reset);
    console.log('  11. Run All Template Tests');
    console.log('  12. Run All Custom Message Tests');
    console.log('  13. Run Complete Test Suite');
    console.log('');
    console.log('  0. Exit');
    console.log('');
    console.log(colors.yellow + '═'.repeat(70) + colors.reset);
    console.log('');
}

/**
 * Get user input from CLI
 */
function getUserInput(prompt) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

/**
 * Run selected test
 */
async function runTest(testNumber) {
    console.log('\n' + colors.cyan + '═'.repeat(70) + colors.reset);
    
    try {
        // Connect to database once
        const connected = await connectToDatabase();
        if (!connected) {
            throw new Error('Failed to connect to database');
        }

        let result;
        
        switch(testNumber) {
            case '1':
                console.log(colors.bright + '\n📅 Running: Monthly Report - Template Mode\n' + colors.reset);
                result = await monthlyTests.testMonthlyReportTemplate();
                break;
                
            case '2':
                console.log(colors.bright + '\n📅 Running: Monthly Report - Custom Message Mode\n' + colors.reset);
                result = await monthlyTests.testMonthlyReportCustomMessage();
                break;
                
            case '3':
                console.log(colors.bright + '\n📊 Running: Weekly Report - Template Mode\n' + colors.reset);
                result = await weeklyTests.testWeeklyReportTemplate();
                break;
                
            case '4':
                console.log(colors.bright + '\n📊 Running: Weekly Report - Custom Message Mode\n' + colors.reset);
                result = await weeklyTests.testWeeklyReportCustomMessage();
                break;
                
            case '5':
                console.log(colors.bright + '\n🔍 Running: Template Validation\n' + colors.reset);
                result = await templateTests.validateAllTemplates();
                break;
                
            case '6':
                console.log(colors.bright + '\n📄 Running: PDF Generation Test\n' + colors.reset);
                result = await monthlyTests.testPdfGenerationOnly();
                break;
                
            case '7':
                console.log(colors.bright + '\n📊 Running: Excel Generation Test\n' + colors.reset);
                result = await monthlyTests.testExcelGenerationOnly();
                break;
                
            case '8':
                console.log(colors.bright + '\n☁️  Running: S3 Upload Test\n' + colors.reset);
                result = await monthlyTests.testS3UploadOnly();
                break;
                
            case '9':
                console.log(colors.bright + '\n⚙️  Current Test Configuration\n' + colors.reset);
                displayTestInfo();
                result = { success: true, message: 'Configuration displayed' };
                break;
                
            case '10':
                console.log(colors.bright + '\n⚙️  Edit Test Parameters\n' + colors.reset);
                await editTestParameters();
                result = { success: true, message: 'Parameters updated' };
                break;
                
            case '11':
                console.log(colors.bright + '\n🚀 Running: All Template Tests\n' + colors.reset);
                result = await runAllTemplateTests();
                break;
                
            case '12':
                console.log(colors.bright + '\n🚀 Running: All Custom Message Tests\n' + colors.reset);
                result = await runAllCustomMessageTests();
                break;
                
            case '13':
                console.log(colors.bright + '\n🚀 Running: Complete Test Suite\n' + colors.reset);
                result = await runCompleteTestSuite();
                break;
                
            default:
                console.log(colors.red + '❌ Invalid option' + colors.reset);
                result = { success: false, message: 'Invalid option' };
        }

        // Display result
        console.log('\n' + colors.cyan + '═'.repeat(70) + colors.reset);
        if (result.success) {
            console.log(colors.green + '✅ TEST PASSED' + colors.reset);
            console.log(colors.bright + 'Result: ' + colors.reset + result.message);
        } else {
            console.log(colors.red + '❌ TEST FAILED' + colors.reset);
            console.log(colors.bright + 'Error: ' + colors.reset + result.message);
        }
        
        // Display additional info if available
        if (result.details) {
            console.log(colors.bright + '\nDetails:' + colors.reset);
            Object.entries(result.details).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
        }

    } catch (error) {
        console.log('\n' + colors.red + '❌ TEST ERROR' + colors.reset);
        console.log(colors.bright + 'Error: ' + colors.reset + error.message);
        console.error('\nStack Trace:', error.stack);
    } finally {
        // Always close database
        await closeDatabase();
    }
    
    console.log('\n' + colors.cyan + '═'.repeat(70) + colors.reset);
}

/**
 * Edit test parameters interactively
 */
async function editTestParameters() {
    const config = getTestConfig();
    
    console.log('\nCurrent Configuration:');
    console.log(`  Phone: ${config.phoneNumber}`);
    console.log(`  Site ID: ${config.siteId}`);
    console.log(`  Month: ${config.month}`);
    console.log(`  Year: ${config.year}`);
    console.log(`  Week: ${config.week}`);
    console.log('');
    
    console.log('Enter new values (press Enter to keep current):');
    console.log('');
    
    // Note: In a real implementation, you'd save these to a config file
    console.log(colors.yellow + 'Note: To change test parameters, edit tests/utils/test-config.js' + colors.reset);
}

/**
 * Run all template-based tests
 */
async function runAllTemplateTests() {
    const results = [];
    
    console.log('Testing Monthly Template...');
    results.push(await monthlyTests.testMonthlyReportTemplate());
    
    console.log('\nTesting Weekly Template...');
    results.push(await weeklyTests.testWeeklyReportTemplate());
    
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    
    return {
        success: passed === total,
        message: `${passed}/${total} tests passed`,
        details: { passed, failed: total - passed, total }
    };
}

/**
 * Run all custom message tests
 */
async function runAllCustomMessageTests() {
    const results = [];
    
    console.log('Testing Monthly Custom Message...');
    results.push(await monthlyTests.testMonthlyReportCustomMessage());
    
    console.log('\nTesting Weekly Custom Message...');
    results.push(await weeklyTests.testWeeklyReportCustomMessage());
    
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    
    return {
        success: passed === total,
        message: `${passed}/${total} tests passed`,
        details: { passed, failed: total - passed, total }
    };
}

/**
 * Run complete test suite
 */
async function runCompleteTestSuite() {
    const results = [];
    
    console.log('Running all tests...\n');
    
    console.log('1. Template Validation...');
    results.push(await templateTests.validateAllTemplates());
    
    console.log('\n2. PDF Generation...');
    results.push(await monthlyTests.testPdfGenerationOnly());
    
    console.log('\n3. Excel Generation...');
    results.push(await monthlyTests.testExcelGenerationOnly());
    
    console.log('\n4. Monthly Template...');
    results.push(await monthlyTests.testMonthlyReportTemplate());
    
    console.log('\n5. Weekly Template...');
    results.push(await weeklyTests.testWeeklyReportTemplate());
    
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    
    return {
        success: passed === total,
        message: `Complete suite: ${passed}/${total} tests passed`,
        details: { passed, failed: total - passed, total }
    };
}

/**
 * Main interactive menu loop
 */
async function interactiveMode() {
    let running = true;
    
    while (running) {
        displayMenu();
        const choice = await getUserInput(colors.bright + 'Select an option (0-13): ' + colors.reset);
        
        if (choice === '0') {
            console.log('\n' + colors.cyan + '👋 Goodbye!' + colors.reset + '\n');
            running = false;
        } else {
            await runTest(choice);
            
            // Wait for user to press Enter
            await getUserInput('\nPress Enter to continue...');
        }
    }
}

/**
 * Command-line mode (with arguments)
 */
async function commandLineMode() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (command === '--list' || command === '-l') {
        console.log('\nAvailable test commands:');
        console.log('  --monthly              Monthly report (template)');
        console.log('  --monthly-custom       Monthly report (custom message)');
        console.log('  --weekly               Weekly report (template)');
        console.log('  --weekly-custom        Weekly report (custom message)');
        console.log('  --validate             Validate templates');
        console.log('  --pdf                  Test PDF generation');
        console.log('  --excel                Test Excel generation');
        console.log('  --all-template         All template tests');
        console.log('  --all-custom           All custom message tests');
        console.log('  --all                  Complete test suite');
        console.log('  --list                 Show this list');
        console.log('');
        return;
    }
    
    const commandMap = {
        '--monthly': '1',
        '--monthly-custom': '2',
        '--weekly': '3',
        '--weekly-custom': '4',
        '--validate': '5',
        '--pdf': '6',
        '--excel': '7',
        '--s3': '8',
        '--config': '9',
        '--all-template': '11',
        '--all-custom': '12',
        '--all': '13'
    };
    
    const testNumber = commandMap[command];
    
    if (testNumber) {
        await runTest(testNumber);
    } else {
        console.log(colors.red + `\n❌ Unknown command: ${command}` + colors.reset);
        console.log('Use --list to see available commands\n');
        process.exit(1);
    }
}

/**
 * Main entry point
 */
async function main() {
    try {
        // Check if running with command-line arguments
        if (process.argv.length > 2) {
            await commandLineMode();
        } else {
            // Interactive menu mode
            await interactiveMode();
        }
        
        process.exit(0);
    } catch (error) {
        console.error(colors.red + '\n❌ Fatal Error:' + colors.reset, error.message);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = {
    runTest,
    displayMenu
};
