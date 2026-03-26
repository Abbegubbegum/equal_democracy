import {
	Proposal,
	FinalVote,
	TopProposal,
	MunicipalSession,
	Settings,
	User,
} from "./models";
import { sendSessionResultsEmail } from "./email";
import { createLogger } from "./logger";

const log = createLogger("SessionClose");

/**
 * Closes a standard session: determines winners, archives proposals, updates session status.
 * For survey/ranking sessions, use archiveSession() instead.
 *
 * @param {Object} session - Mongoose Session document (must be already fetched)
 * @param {Object} options
 * @param {boolean} options.sendEmails - Whether to send result emails to participants (default: false)
 * @returns {Object} { topProposals: Array } - The winning proposals that were saved
 */
export async function closeStandardSession(session, { sendEmails = false } = {}) {
	const topProposals = await Proposal.find({
		sessionId: session._id,
		status: "top3",
	});

	const savedProposals = [];

	if (session.singleResult) {
		// Single result mode: find proposal with highest net result (yesVotes - noVotes)
		// If tied: start 30-second tiebreaker round (once). If still tied: all win.
		let bestResult = -Infinity;
		const proposalsWithVotes = [];

		// During tiebreaker, only evaluate the tied proposals
		let evaluationProposals = topProposals;
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

		const tiedProposals = proposalsWithVotes.filter(item => item.result === bestResult);

		// Tie detected and no tiebreaker yet: start tiebreaker round
		if (tiedProposals.length > 1 && !session.tiebreakerActive) {
			const tiedIds = tiedProposals.map(item => item.proposal._id);
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
				tiedProposalIds: tiedIds.map(id => id.toString()),
				scheduledTime,
				secondsRemaining: 30,
			};
		}

		// Save winners (single winner or co-winners after tiebreaker)
		for (const item of tiedProposals) {
			const topProposal = await TopProposal.create({
				sessionId: session._id,
				sessionPlace: session.place,
				sessionStartDate: session.startDate || session.createdAt || new Date(),
				proposalId: item.proposal._id,
				title: item.proposal.title,
				problem: item.proposal.problem,
				solution: item.proposal.solution,
				authorName: item.proposal.authorName,
				yesVotes: item.yesVotes,
				noVotes: item.noVotes,
				archivedAt: new Date(),
			});
			savedProposals.push(topProposal);
		}
	} else {
		// Normal mode: save all proposals with yes-majority
		for (const proposal of topProposals) {
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
				const topProposal = await TopProposal.create({
					sessionId: session._id,
					sessionPlace: session.place,
					sessionStartDate: session.startDate || session.createdAt || new Date(),
					proposalId: proposal._id,
					title: proposal.title,
					problem: proposal.problem,
					solution: proposal.solution,
					authorName: proposal.authorName,
					yesVotes,
					noVotes,
					archivedAt: new Date(),
				});
				savedProposals.push(topProposal);
			}
		}
	}

	// Archive all proposals in this session
	await Proposal.updateMany(
		{ sessionId: session._id },
		{ status: "archived" }
	);

	// Close the session
	session.status = "closed";
	session.phase = "closed";
	session.tiebreakerActive = false;
	session.endDate = new Date();
	await session.save();

	log.info("Session closed successfully", {
		sessionId: session._id.toString(),
		savedProposals: savedProposals.length,
	});

	// Auto-archive municipal item when its linked session closes
	if (session.sessionType === "municipal") {
		await MunicipalSession.updateOne(
			{ "items.sessionId": session._id },
			{
				$set: {
					"items.$.status": "closed",
					"items.$.closedAt": new Date(),
				},
			}
		);
		log.info("Municipal item auto-archived", { sessionId: session._id.toString() });
	}

	// Optionally send result emails to all participants
	if (sendEmails) {
		await sendResultEmails(session, savedProposals);
	}

	return { topProposals: savedProposals };
}

/**
 * Archives a survey/ranking session: sets status to archived and closes it.
 *
 * @param {Object} session - Mongoose Session document (must be already fetched)
 * @returns {Object} { success: true }
 */
export async function archiveRankingSession(session) {
	session.status = "archived";
	session.endDate = new Date();
	await session.save();

	log.info("Ranking session archived", {
		sessionId: session._id.toString(),
		place: session.place,
	});

	return { success: true };
}

/**
 * Closes any session type - delegates to the appropriate method.
 *
 * @param {Object} session - Mongoose Session document
 * @param {Object} options
 * @param {boolean} options.sendEmails - Whether to send result emails (only for standard sessions)
 * @returns {Object} Result from the appropriate close function
 */
export async function closeSession(session, options = {}) {
	if (session.sessionType === "survey") {
		return archiveRankingSession(session);
	}
	return closeStandardSession(session, options);
}

async function sendResultEmails(session, savedProposals) {
	try {
		const settings = await Settings.findOne();
		const language = settings?.language || "sv";

		const participantIds = session.activeUsers || [];
		const participants = await User.find({
			_id: { $in: participantIds },
		});

		for (const user of participants) {
			try {
				await sendSessionResultsEmail(
					user.email,
					session.place,
					savedProposals.map((tp) => ({
						title: tp.title,
						yesVotes: tp.yesVotes,
						noVotes: tp.noVotes,
					})),
					language
				);
			} catch (emailError) {
				log.error("Failed to send results email", {
					email: user.email,
					error: emailError.message,
				});
			}
		}
	} catch (emailError) {
		log.error("Email sending process failed", { error: emailError.message });
	}
}
