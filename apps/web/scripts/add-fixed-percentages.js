/**
 * Script to add fixedPercentage to budget categories
 * Example: 70% of Social services, 100% of school vouchers
 */

const fs = require('fs');
const mongoose = require('mongoose');

// Read MongoDB URI from .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
const match = envContent.match(/MONGODB_URI=(.+)/);
const MONGODB_URI = match ? match[1].trim() : null;

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

async function addFixedPercentages() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const BudgetSession = mongoose.connection.collection('budgetsessions');

    // Find all budget sessions
    const sessions = await BudgetSession.find({}).toArray();
    console.log(`Found ${sessions.length} budget sessions`);

    for (const session of sessions) {
      console.log(`\nProcessing session: ${session.name} (${session.sessionId})`);

      const updates = {
        categories: session.categories.map(cat => {
          // Add fixedPercentage based on category name
          let fixedPercentage = 0;

          // 70% of Socialnämnden (Social services)
          if (cat.name.toLowerCase().includes('social')) {
            fixedPercentage = 70;
            console.log(`  - ${cat.name}: Setting fixedPercentage to 70%`);
          }
          // 100% of Skolpeng (School vouchers) and Gymnasieskolpeng (High school vouchers)
          else if (cat.name.toLowerCase().includes('skolpeng') ||
                   cat.name.toLowerCase().includes('gymnasie')) {
            fixedPercentage = 100;
            console.log(`  - ${cat.name}: Setting fixedPercentage to 100%`);
          }

          return {
            ...cat,
            fixedPercentage
          };
        })
      };

      // Update the session
      await BudgetSession.updateOne(
        { _id: session._id },
        { $set: updates }
      );
    }

    console.log('\n✅ All budget sessions updated with fixed percentages');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addFixedPercentages();
