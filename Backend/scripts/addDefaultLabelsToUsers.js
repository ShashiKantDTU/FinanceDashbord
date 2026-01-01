const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const User = require('../models/Userschema');

const DEFAULT_LABELS = [
  { name: "Foreman", color: "#06b6d4" },
  { name: "Mason", color: "#ef4444" },
  { name: "Helper", color: "#a855f7" }
];

async function addDefaultLabels() {
  try {
    console.log('🔍 Connecting to database...');
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
        throw new Error("MONGO_URI is not defined in .env");
    }
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    // Fetch users with lean() to see actual DB state (ignoring schema defaults)
    const users = await User.find({}).lean();
    console.log(`Found ${users.length} users. Checking labels...`);

    let updatedCount = 0;

    for (const user of users) {
      let needsUpdate = false;
      const currentLabels = user.customLabels || [];
      
      // Check if any default label is missing in the raw DB document
      for (const defaultLabel of DEFAULT_LABELS) {
        const exists = currentLabels.some(
          l => l.name.toLowerCase() === defaultLabel.name.toLowerCase()
        );
        if (!exists) {
          needsUpdate = true;
          break;
        }
      }

      if (needsUpdate) {
        // Fetch full document to update
        const userDoc = await User.findById(user._id);
        if (!userDoc) continue;

        // If customLabels was undefined in DB, Mongoose might have initialized it from default schema
        // But we want to ensure we merge correctly if there were existing ones (though lean check handles that)
        
        // Actually, since we added default to schema, userDoc.customLabels might already have them!
        // But we need to save to persist them.
        
        // Let's explicitly check and push to be safe, avoiding duplicates
        // Note: userDoc.customLabels might contain the defaults now because of schema change.
        // If so, we just need to save.
        
        // To be absolutely sure we don't duplicate:
        // We can filter userDoc.customLabels to remove defaults, then re-add them? 
        // Or just trust Mongoose's default application?
        
        // If Mongoose applied defaults, userDoc.isModified('customLabels') might be true?
        // Let's just check what's in userDoc.customLabels.
        
        let docModified = false;
        
        // If the DB had no labels, userDoc.customLabels will be the defaults (from schema).
        // In that case, we just need to save.
        
        // If the DB had SOME labels, userDoc.customLabels will be those labels + defaults (maybe? depends on how Mongoose merges defaults)
        // Usually Mongoose only applies default if the path is undefined.
        // If it was empty array [], default is NOT applied.
        
        if (!userDoc.customLabels) {
            userDoc.customLabels = [];
        }

        for (const defaultLabel of DEFAULT_LABELS) {
            const exists = userDoc.customLabels.some(
              l => l.name.toLowerCase() === defaultLabel.name.toLowerCase()
            );
    
            if (!exists) {
              userDoc.customLabels.push(defaultLabel);
              docModified = true;
            }
        }

        // If we found it needed update via lean(), but docModified is false, 
        // it means Mongoose applied defaults in memory. We should still save.
        // But wait, if Mongoose applied defaults, isModified should be true?
        // Let's force save if we detected need for update via lean().
        
        await userDoc.save();
        updatedCount++;
        process.stdout.write('.'); 
      }
    }

    console.log(`\n✅ Process complete. Updated ${updatedCount} users.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addDefaultLabels();
