require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const { Session, Proposal, FinalVote } = require('../lib/models');

async function testAutoClose() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const session = await Session.findOne({ status: 'active' }).sort({ startDate: -1 });

    if (!session) {
      console.log('No active session found');
      await mongoose.connection.close();
      return;
    }

    console.log('\n=== SESSION INFO ===');
    console.log('Place:', session.place);
    console.log('Phase:', session.phase);
    console.log('Single Result:', session.singleResult);
    console.log('Active Users:', session.activeUsers);
    console.log('Active Users Count:', session.activeUsers?.length || 0);

    const proposals = await Proposal.find({ sessionId: session._id, status: 'top3' });
    console.log('\n=== PROPOSALS ===');
    console.log('Top3 Proposals:', proposals.length);
    proposals.forEach(p => console.log(`  - ${p.title}`));

    const votes = await FinalVote.find({ sessionId: session._id });
    console.log('\n=== VOTES ===');
    console.log('Total Votes:', votes.length);

    const votedUserIds = await FinalVote.distinct('userId', { sessionId: session._id });
    console.log('Unique Voters:', votedUserIds.length);
    console.log('Voted User IDs:', votedUserIds.map(id => id.toString()));

    console.log('\n=== AUTO-CLOSE CHECK ===');
    const activeUserIds = session.activeUsers || [];
    console.log('Active User IDs:', activeUserIds.map(id => id.toString()));

    if (session.phase !== 'phase2') {
      console.log('❌ Not in phase2, cannot auto-close');
    } else if (activeUserIds.length === 0) {
      console.log('❌ No active users registered');
    } else {
      const allUsersVoted = activeUserIds.every(userId =>
        votedUserIds.some(votedId => votedId.toString() === userId.toString())
      );

      console.log('All users voted?', allUsersVoted);

      if (allUsersVoted) {
        console.log('✅ CONDITIONS MET - Session should auto-close!');
      } else {
        console.log('❌ Not all active users have voted yet');
        activeUserIds.forEach(userId => {
          const hasVoted = votedUserIds.some(votedId => votedId.toString() === userId.toString());
          console.log(`  User ${userId}: ${hasVoted ? 'voted ✓' : 'not voted ✗'}`);
        });
      }
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

testAutoClose();
