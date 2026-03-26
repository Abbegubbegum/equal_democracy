require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const { Session, TopProposal, FinalVote } = require('../lib/models');

async function forceCloseSession() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the active session
    const session = await Session.findOne({ status: 'active' }).sort({ startDate: -1 });

    if (!session) {
      console.log('No active session found');
      await mongoose.connection.close();
      return;
    }

    console.log(`Found active session: ${session.place}`);
    console.log(`Session ID: ${session._id}`);
    console.log(`Single result mode: ${session.singleResult}`);

    // Get top 3 proposals from Proposal collection (not from session.top3Proposals array)
    const Proposal = require('../lib/models').Proposal;
    const top3Proposals = await Proposal.find({
      sessionId: session._id,
      status: 'top3'
    });
    console.log(`Top 3 proposals count: ${top3Proposals.length}`);

    if (top3Proposals.length === 0) {
      console.log('No proposals to process, just closing session');
      session.status = 'closed';
      session.endDate = new Date();
      await session.save();
      console.log('Session closed successfully');
      await mongoose.connection.close();
      return;
    }

    const topProposals = [];

    if (session.singleResult) {
      console.log('Processing in single result mode with tie handling...');
      let bestResult = -Infinity;
      const proposalsWithVotes = [];

      // First pass: calculate results
      for (const proposal of top3Proposals) {
        const votes = await FinalVote.find({ proposalId: proposal._id });
        const yesVotes = votes.filter((v) => v.choice === 'yes').length;
        const noVotes = votes.filter((v) => v.choice === 'no').length;
        const result = yesVotes - noVotes;

        console.log(`Proposal: ${proposal.title}`);
        console.log(`  Yes: ${yesVotes}, No: ${noVotes}, Result: ${result}`);

        proposalsWithVotes.push({ proposal, yesVotes, noVotes, result });

        if (result > bestResult) {
          bestResult = result;
        }
      }

      console.log(`Best result: ${bestResult}`);

      // Second pass: save all proposals with best result
      for (const item of proposalsWithVotes) {
        if (item.result === bestResult) {
          console.log(`Saving winner: ${item.proposal.title}`);
          const topProposal = await TopProposal.create({
            sessionId: session._id,
            sessionPlace: session.place,
            sessionStartDate: session.startDate,
            proposalId: item.proposal._id,
            title: item.proposal.title,
            problem: item.proposal.problem,
            solution: item.proposal.solution,
            authorName: item.proposal.authorName,
            yesVotes: item.yesVotes,
            noVotes: item.noVotes,
            archivedAt: new Date(),
          });
          topProposals.push(topProposal);
        }
      }
    } else {
      console.log('Processing in normal mode...');
      // Normal mode: save all with yes-majority
      for (const proposal of top3Proposals) {
        const votes = await FinalVote.find({ proposalId: proposal._id });
        const yesVotes = votes.filter((v) => v.choice === 'yes').length;
        const noVotes = votes.filter((v) => v.choice === 'no').length;

        console.log(`Proposal: ${proposal.title}`);
        console.log(`  Yes: ${yesVotes}, No: ${noVotes}`);

        if (yesVotes > noVotes) {
          console.log(`  Saving as winner`);
          const topProposal = await TopProposal.create({
            sessionId: session._id,
            sessionPlace: session.place,
            sessionStartDate: session.startDate,
            proposalId: proposal._id,
            title: proposal.title,
            problem: proposal.problem,
            solution: proposal.solution,
            authorName: proposal.authorName,
            yesVotes: yesVotes,
            noVotes: noVotes,
            archivedAt: new Date(),
          });
          topProposals.push(topProposal);
        }
      }
    }

    console.log(`Saved ${topProposals.length} winning proposal(s)`);

    // Close the session
    session.status = 'closed';
    session.endDate = new Date();
    await session.save();

    console.log('✓ Session closed successfully!');
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

forceCloseSession();
