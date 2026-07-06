import mongoose from "mongoose";
import { Proposal, FinalVote, WinningProposal, Settings, User } from "./models";
import { sendSessionResultsEmail } from "./email";
import { createLogger } from "./logger";

const log = createLogger("SessionClose");

/** Shape of a Mongoose Session document as used in close operations */
interface SessionDocument {
  _id: mongoose.Types.ObjectId;
  title: string;
  singleResult: boolean;
  tiebreakerActive: boolean;
  tiebreakerProposals: mongoose.Types.ObjectId[];
  tiebreakerScheduled?: Date;
  phase2TerminationScheduled?: Date;
  startDate?: Date;
  createdAt?: Date;
  status: string;
  phase: string;
  endDate?: Date;
  activeUsers?: mongoose.Types.ObjectId[];
  save(): Promise<unknown>;
}

interface CloseOptions {
  sendEmails?: boolean;
}

export async function closeSession(
  session: SessionDocument,
  { sendEmails = false }: CloseOptions = {},
) {
  const finalistProposals = await Proposal.find({
    sessionId: session._id,
    status: "finalist",
  });

  const savedProposals = [];

  if (session.singleResult) {
    let bestResult = -Infinity;
    const proposalsWithVotes = [];

    let evaluationProposals = finalistProposals;
    if (session.tiebreakerActive) {
      evaluationProposals = await Proposal.find({
        _id: { $in: session.tiebreakerProposals },
      });
    }

    for (const proposal of evaluationProposals) {
      const yesVotes = await FinalVote.countDocuments({
        sessionId: session._id,
        proposalId: proposal._id,
        choice: "yes",
      });
      const noVotes = await FinalVote.countDocuments({
        sessionId: session._id,
        proposalId: proposal._id,
        choice: "no",
      });
      const result = yesVotes - noVotes;

      proposalsWithVotes.push({ proposal, yesVotes, noVotes, result });

      if (result > bestResult) {
        bestResult = result;
      }
    }

    const tiedProposals = proposalsWithVotes.filter(
      (item) => item.result === bestResult,
    );

    if (tiedProposals.length > 1 && !session.tiebreakerActive) {
      const tiedIds = tiedProposals.map((item) => item.proposal._id);
      const scheduledTime = new Date(Date.now() + 30 * 1000);

      session.tiebreakerActive = true;
      session.tiebreakerProposals = tiedIds;
      session.tiebreakerScheduled = scheduledTime;
      session.phase2TerminationScheduled = scheduledTime;
      await session.save();

      log.info("Tiebreaker started", {
        sessionId: session._id.toString(),
        tiedCount: tiedIds.length,
      });

      return {
        tiebreakerStarted: true,
        tiedProposalIds: tiedIds.map((id) => id.toString()),
        scheduledTime,
        secondsRemaining: 30,
      };
    }

    for (const item of tiedProposals) {
      const winningProposal = await WinningProposal.create({
        sessionId: session._id,
        sessionTitle: session.title,
        sessionStartDate: session.startDate || session.createdAt || new Date(),
        proposalId: item.proposal._id,
        title: item.proposal.title,
        problem: item.proposal.problem,
        solution: item.proposal.solution,
        yesVotes: item.yesVotes,
        noVotes: item.noVotes,
        archivedAt: new Date(),
      });
      savedProposals.push(winningProposal);
    }
  } else {
    for (const proposal of finalistProposals) {
      const yesVotes = await FinalVote.countDocuments({
        sessionId: session._id,
        proposalId: proposal._id,
        choice: "yes",
      });
      const noVotes = await FinalVote.countDocuments({
        sessionId: session._id,
        proposalId: proposal._id,
        choice: "no",
      });

      if (yesVotes > noVotes) {
        const winningProposal = await WinningProposal.create({
          sessionId: session._id,
          sessionTitle: session.title,
          sessionStartDate:
            session.startDate || session.createdAt || new Date(),
          proposalId: proposal._id,
          title: proposal.title,
          problem: proposal.problem,
          solution: proposal.solution,
          yesVotes,
          noVotes,
          archivedAt: new Date(),
        });
        savedProposals.push(winningProposal);
      }
    }
  }

  await Proposal.updateMany({ sessionId: session._id }, { status: "archived" });

  session.status = "closed";
  session.phase = "closed";
  session.tiebreakerActive = false;
  session.endDate = new Date();
  await session.save();

  log.info("Session closed successfully", {
    sessionId: session._id.toString(),
    savedProposals: savedProposals.length,
  });

  if (sendEmails) {
    await sendResultEmails(session, savedProposals);
  }

  return { topProposals: savedProposals };
}

async function sendResultEmails(
  session: SessionDocument,
  savedProposals: Array<{ title: string; yesVotes: number; noVotes: number }>,
) {
  try {
    const settings = await Settings.findOne();
    const language = (settings?.language as string) || "sv";

    const participantIds = session.activeUsers || [];
    const participants = await User.find({
      _id: { $in: participantIds },
    });

    for (const user of participants) {
      try {
        await sendSessionResultsEmail(
          user.email as string,
          session.title,
          savedProposals.map((tp) => ({
            title: tp.title,
            yesVotes: tp.yesVotes,
            noVotes: tp.noVotes,
          })),
          language,
        );
      } catch (emailError) {
        log.error("Failed to send results email", {
          email: user.email,
          error: (emailError as Error).message,
        });
      }
    }
  } catch (emailError) {
    log.error("Email sending process failed", {
      error: (emailError as Error).message,
    });
  }
}
